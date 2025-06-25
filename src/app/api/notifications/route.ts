
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

    const notificationsDocs = await Notification.find({ userId: session.user.id })
      .populate({ path: 'data.requestingUserId', model: User, select: 'name email' })
      .populate({ path: 'data.invitingUserId', model: User, select: 'name email' })
      .populate({ path: 'data.actorId', model: User, select: 'name email' })
      .sort({ createdAt: -1 });

    const formattedNotifications: NotificationType[] = [];

    for (const doc of notificationsDocs) {
      try {
        const notif = doc.toObject();

        if (!notif._id || !notif.type || !notif.message || !notif.createdAt) {
          console.warn('Skipping malformed notification document:', notif);
          continue;
        }
        
        const data = notif.data || {};
        
        const requestingUserData = data.requestingUserId as any;
        const invitingUserData = data.invitingUserId as any;
        const actorData = data.actorId as any;

        // If a populated document was deleted, it will be `null`.
        // These checks will now skip any notification with a broken reference.
        if (notif.type === 'JOIN_REQUEST' && !requestingUserData) {
          console.warn(`Skipping JOIN_REQUEST notification ${notif._id} because the requesting user was not found.`);
          continue;
        }
        if (notif.type === 'TEAM_INVITE' && !invitingUserData) {
          console.warn(`Skipping TEAM_INVITE notification ${notif._id} because the inviting user was not found.`);
          continue;
        }
        const typesNeedingActor = ['TASK_ASSIGNED', 'TASK_CREATED', 'TASK_UPDATED', 'NEW_COMMENT', 'WELCOME_TO_TEAM'];
        if (typesNeedingActor.includes(notif.type) && !actorData) {
          console.warn(`Skipping ${notif.type} notification ${notif._id} because the actor was not found.`);
          continue;
        }

        const formattedNotification: NotificationType = {
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

        formattedNotifications.push(formattedNotification);

      } catch (error) {
        console.error(`Error processing individual notification ${doc._id}:`, error);
        // Continue to the next notification if an unexpected error occurs
      }
    }

    return NextResponse.json(formattedNotifications, { status: 200 });

  } catch (error) {
    console.error('Critical error in GET /api/notifications:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
