
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/task';
import Comment from '@/models/comment';
import User from '@/models/user';
import Team from '@/models/team';
import Notification from '@/models/notification';


async function checkTaskPermission(taskId: string, userId: string): Promise<boolean> {
  const task = await Task.findById(taskId);
  if (!task) return false;
  if (task.userId.toString() === userId) return true;
  if (task.teamId) {
    const team = await Team.findOne({ _id: task.teamId, members: userId });
    if (team) return true;
  }
  return false;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    await dbConnect();
    const { id } = params;
    
    if (!await checkTaskPermission(id, session.user.id)) {
      return NextResponse.json({ message: 'Not authorized to view comments for this task' }, { status: 403 });
    }

    const comments = await Comment.find({ taskId: id })
      .populate({ path: 'userId', model: User, select: 'name email' })
      .sort({ createdAt: 'asc' });

    const formattedComments = comments
      .map(comment => {
        const user = comment.userId as any;
        if (!user) {
          console.warn(`Skipping comment ${comment._id} because its author no longer exists.`);
          return null;
        }
        return {
          id: comment._id.toString(),
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
          user: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
          }
        };
      })
      .filter(Boolean); // Filter out null (deleted user) comments
    
    return NextResponse.json(formattedComments, { status: 200 });

  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.name) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  
  try {
    await dbConnect();
    const { id } = params;
    const { content } = await req.json();

    if (!content) {
      return NextResponse.json({ message: 'Comment content is required' }, { status: 400 });
    }

    if (!await checkTaskPermission(id, session.user.id)) {
      return NextResponse.json({ message: 'Not authorized to comment on this task' }, { status: 403 });
    }
    
    const task = await Task.findById(id);
    if (!task) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 });
    }

    const newComment = new Comment({
      taskId: id,
      userId: session.user.id,
      content,
    });
    await newComment.save();
    
    // --- Notification Logic ---
    const usersToNotify = new Set<string>();
    // 1. Task creator
    if (task.userId.toString() !== session.user.id) {
        usersToNotify.add(task.userId.toString());
    }
    // 2. Assigned user
    if (task.assignedTo && task.assignedTo.toString() !== session.user.id) {
        usersToNotify.add(task.assignedTo.toString());
    }
    // 3. Other commenters
    const otherCommenters = await Comment.find({ taskId: id }).distinct('userId');
    otherCommenters.forEach(userId => {
        if (userId.toString() !== session.user.id) {
            usersToNotify.add(userId.toString());
        }
    });

    const notifications = Array.from(usersToNotify).map(userId => ({
        userId: userId,
        type: 'NEW_COMMENT',
        message: `${session.user.name} commented on: "${task.title}"`,
        data: {
            taskId: task._id,
            taskTitle: task.title,
            actorId: session.user.id,
        }
    }));
    
    if (notifications.length > 0) {
        await Notification.insertMany(notifications);
    }
    // --- End Notification Logic ---

    await newComment.populate({ path: 'userId', model: User, select: 'name email' });
    
    const commentObject = newComment.toObject();

    return NextResponse.json({
        id: commentObject._id.toString(),
        content: commentObject.content,
        createdAt: commentObject.createdAt.toISOString(),
        user: {
            id: (commentObject.userId as any)._id.toString(),
            name: (commentObject.userId as any).name,
            email: (commentObject.userId as any).email,
        }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
