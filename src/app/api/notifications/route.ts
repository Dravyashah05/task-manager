
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import Notification from '@/models/notification';
import User from '@/models/user';
import Team from '@/models/team';
import type { Notification as NotificationType, UserSubset } from '@/types';
import mongoose from 'mongoose';

// Helper function to convert a Mongoose User document to a UserSubset
const toUserSubset = (user: any): UserSubset | null => {
  if (!user) return null;
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  };
};

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }
    
    await dbConnect();

    // 1. Fetch raw notifications without populating
    const rawNotifications = await Notification.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .lean(); // Use .lean() for plain JS objects, which is faster

    // 2. Gather all unique IDs for users and teams from all notifications
    const userIds = new Set<string>();
    const teamIds = new Set<string>();

    rawNotifications.forEach(notif => {
      if (notif.data) {
        if (notif.data.requestingUserId) userIds.add(notif.data.requestingUserId.toString());
        if (notif.data.invitingUserId) userIds.add(notif.data.invitingUserId.toString());
        if (notif.data.actorId) userIds.add(notif.data.actorId.toString());
        if (notif.data.teamId) teamIds.add(notif.data.teamId.toString());
      }
    });

    // 3. Fetch all required User and Team documents in batch
    const userObjectIds = Array.from(userIds).filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
    const teamObjectIds = Array.from(teamIds).filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));

    const [userDocs, teamDocs] = await Promise.all([
      User.find({ _id: { $in: userObjectIds } }).select('name email').lean(),
      Team.find({ _id: { $in: teamObjectIds } }).select('name').lean()
    ]);
    
    // 4. Create lookup maps for efficient access
    const userMap = new Map(userDocs.map(user => [user._id.toString(), user]));
    const teamMap = new Map(teamDocs.map(team => [team._id.toString(), team]));
    
    // 5. Manually "populate" and format notifications, safely handling missing data
    const formattedNotifications: NotificationType[] = rawNotifications.map(notif => {
      const { data = {} } = notif;
      
      const actor = toUserSubset(userMap.get(data.actorId?.toString()));
      const requestingUser = toUserSubset(userMap.get(data.requestingUserId?.toString()));
      const invitingUser = toUserSubset(userMap.get(data.invitingUserId?.toString()));
      const team = teamMap.get(data.teamId?.toString());
      
      // Basic validation for the notification itself
      if (!notif._id || !notif.type || !notif.message || !notif.createdAt) {
        console.warn('Skipping malformed notification document:', notif);
        return null; // This will be filtered out
      }
      
      // More specific validation based on notification type
      if (notif.type === 'JOIN_REQUEST' && (!requestingUser || !team)) {
        console.warn(`Skipping JOIN_REQUEST notification ${notif._id} due to missing user or team.`);
        return null;
      }
       if (notif.type === 'TEAM_INVITE' && (!invitingUser || !team)) {
        console.warn(`Skipping TEAM_INVITE notification ${notif._id} due to missing user or team.`);
        return null;
      }
      const typesNeedingActor = ['TASK_ASSIGNED', 'TASK_CREATED', 'TASK_UPDATED', 'NEW_COMMENT', 'WELCOME_TO_TEAM'];
      if (typesNeedingActor.includes(notif.type) && !actor) {
        console.warn(`Skipping ${notif.type} notification ${notif._id} due to missing actor.`);
        return null;
      }

      return {
        id: notif._id.toString(),
        type: notif.type,
        message: notif.message,
        data: {
          teamId: data.teamId?.toString(),
          teamName: team?.name || data.teamName, // Fallback to stored name
          taskId: data.taskId?.toString(),
          taskTitle: data.taskTitle,
          requestingUserId: requestingUser?.id,
          requestingUserName: requestingUser?.name,
          invitingUserId: invitingUser?.id,
          invitingUserName: invitingUser?.name,
          actorId: actor?.id,
          actorName: actor?.name,
        },
        isRead: notif.isRead,
        createdAt: new Date(notif.createdAt).toISOString(),
      };
    }).filter((n): n is NotificationType => n !== null); // Filter out any null values

    return NextResponse.json(formattedNotifications, { status: 200 });

  } catch (error) {
    console.error('Critical error in GET /api/notifications:', error);
    // This is a last resort catch block. The logic above should prevent most errors.
    return NextResponse.json({ message: 'Internal Server Error', error: (error as Error).message }, { status: 500 });
  }
}
