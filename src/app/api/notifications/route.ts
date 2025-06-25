
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import Notification from '@/models/notification';
import User from '@/models/user';
import type { Notification as NotificationType } from '@/types';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    await dbConnect();
    
    const notifications = await Notification.find({ userId: session.user.id })
      .populate({ path: 'data.requestingUserId', model: User, select: 'name email' })
      .populate({ path: 'data.invitingUserId', model: User, select: 'name email' })
      .populate({ path: 'data.actorId', model: User, select: 'name email' })
      .sort({ createdAt: -1 });

    const formattedNotifications = notifications
      .map((notifDoc): NotificationType | null => {
        try {
          // Use .toObject() to work with a plain JS object
          const notif = notifDoc.toObject();

          // Basic data integrity check
          if (!notif || !notif._id || !notif.type || !notif.message || !notif.createdAt) {
            console.warn('Skipping malformed notification document:', notif);
            return null;
          }
          
          const data = notif.data || {};

          const requestingUserData = data.requestingUserId as any;
          const invitingUserData = data.invitingUserId as any;
          const actorData = data.actorId as any;

          // More granular checks for required populated data based on type
          if (notif.type === 'JOIN_REQUEST' && (!requestingUserData || !requestingUserData._id)) {
              console.warn(`Skipping JOIN_REQUEST notification ${notif._id} due to missing requesting user data.`);
              return null;
          }
          if (notif.type === 'TEAM_INVITE' && (!invitingUserData || !invitingUserData._id)) {
              console.warn(`Skipping TEAM_INVITE notification ${notif._id} due to missing inviting user data.`);
              return null;
          }
          const typesNeedingActor = ['TASK_ASSIGNED', 'TASK_CREATED', 'TASK_UPDATED', 'NEW_COMMENT', 'WELCOME_TO_TEAM'];
          if (typesNeedingActor.includes(notif.type) && (!actorData || !actorData._id)) {
               console.warn(`Skipping ${notif.type} notification ${notif._id} due to missing actor data.`);
               return null;
          }

          return {
            id: notif._id.toString(),
            type: notif.type,
            message: notif.message,
            data: {
              teamId: data.teamId?.toString(),
              teamName: data.teamName,
              taskId: data.taskId?.toString(),
              taskTitle: data.taskTitle,
              requestingUserId: requestingUserData?._id?.toString(),
              requestingUserName: requestingUserData?.name,
              invitingUserId: invitingUserData?._id?.toString(),
              invitingUserName: invitingUserData?.name,
              actorId: actorData?._id?.toString(),
              actorName: actorData?.name,
            },
            isRead: notif.isRead,
            createdAt: new Date(notif.createdAt).toISOString(),
          };
        } catch (e) {
          console.error(`Error processing individual notification ${notifDoc._id}:`, e);
          return null; // Return null for any notification that causes a processing error
        }
      })
      .filter((n): n is NotificationType => n !== null); // Filter out any null (invalid) entries

    return NextResponse.json(formattedNotifications, { status: 200 });
  } catch (error) {
    console.error('Critical error in GET /api/notifications:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
