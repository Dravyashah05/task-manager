
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import Notification from '@/models/notification';
import User from '@/models/user';

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

    // Use reduce for safer transformation. If a notification is malformed, we can skip it.
    const formattedNotifications = notifications.reduce<any[]>((acc, notif) => {
      try {
        const requestingUserData = notif.data.requestingUserId as any;
        const invitingUserData = notif.data.invitingUserId as any;
        const actorData = notif.data.actorId as any;

        // Basic validation to prevent crashes from corrupted data
        if (!notif._id || !notif.type || !notif.message || !notif.createdAt) {
          console.warn('Skipping malformed notification:', notif);
          return acc;
        }

        acc.push({
          id: notif._id.toString(),
          type: notif.type,
          message: notif.message,
          data: {
            teamId: notif.data.teamId?.toString(),
            teamName: notif.data.teamName,
            taskId: notif.data.taskId?.toString(),
            taskTitle: notif.data.taskTitle,
            requestingUserId: requestingUserData?._id?.toString(),
            requestingUserName: requestingUserData?.name,
            invitingUserId: invitingUserData?._id?.toString(),
            invitingUserName: invitingUserData?.name,
            actorId: actorData?._id?.toString(),
            actorName: actorData?.name,
          },
          isRead: notif.isRead,
          createdAt: notif.createdAt.toISOString(),
        });
      } catch (e) {
        console.error(`Error processing notification ${notif._id}:`, e);
        // Do not add the malformed notification to the result array
      }
      return acc;
    }, []);

    return NextResponse.json(formattedNotifications, { status: 200 });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
