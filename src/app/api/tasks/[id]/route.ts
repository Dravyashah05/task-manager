
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/task';
import User from '@/models/user';
import Team from '@/models/team';
import Notification from '@/models/notification';

async function checkTaskPermission(taskId: string, userId: string): Promise<boolean> {
    const task = await Task.findById(taskId);
    if (!task) {
        return false; // Task doesn't exist
    }

    if (task.userId.toString() === userId) {
        return true; // User is the owner
    }

    if (task.teamId) {
        const team = await Team.findOne({ _id: task.teamId, members: userId });
        if (team) {
            return true; // User is a member of the team assigned to the task
        }
    }

    return false;
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.name) {
        return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    try {
        await dbConnect();
        const { id } = params;
        const hasPermission = await checkTaskPermission(id, session.user.id);

        if (!hasPermission) {
            return NextResponse.json({ message: 'Task not found or you do not have permission to edit it' }, { status: 404 });
        }
        
        const task = await Task.findById(id);
        if (!task) {
             return NextResponse.json({ message: 'Task not found' }, { status: 404 });
        }

        const originalTask = task.toObject();
        const body = await req.json();
        const { title, notes, priority, teamId, assignedTo, category, status } = body;
        
        if (title !== undefined) task.title = title;
        if (notes !== undefined) task.notes = notes;
        if (priority !== undefined) task.priority = (priority === 'none' || priority === '') ? undefined : priority;
        if (teamId !== undefined) task.teamId = (teamId === '__none__' || teamId === "") ? undefined : teamId;
        if (assignedTo !== undefined) task.assignedTo = (assignedTo === '__none__' || assignedTo === "") ? undefined : assignedTo;
        if (status !== undefined) {
          task.status = status;
          if (status === 'done' && !task.completedAt) {
            task.completedAt = new Date();
          } else if (status !== 'done') {
            task.completedAt = undefined;
          }
        }
        
        if (category !== undefined) {
          task.category = category;
        }
        
        await task.save();

        if (session.user.name) {
            const originalAssignee = originalTask.assignedTo?.toString();
            const newAssignee = task.assignedTo?.toString();
            if (newAssignee && newAssignee !== originalAssignee && newAssignee !== session.user.id) {
                await new Notification({
                    userId: newAssignee,
                    type: 'TASK_ASSIGNED',
                    message: `${session.user.name} assigned you a new task: "${task.title}"`,
                    data: { taskId: task._id, taskTitle: task.title, actorId: session.user.id }
                }).save();
            }

            if (status && status !== originalTask.status) {
                const usersToNotify = new Set<string>();
                if (task.userId.toString() !== session.user.id) usersToNotify.add(task.userId.toString());
                if (task.assignedTo && task.assignedTo.toString() !== session.user.id) usersToNotify.add(task.assignedTo.toString());
                
                const notifications = Array.from(usersToNotify).map(userId => ({
                    userId,
                    type: 'TASK_UPDATED',
                    message: `${session.user.name} updated the status of "${task.title}" to "${status}"`,
                    data: { taskId: task._id, taskTitle: task.title, actorId: session.user.id }
                }));

                if (notifications.length > 0) await Notification.insertMany(notifications);
            }
        }
        
        await task.populate([
            { path: 'userId', model: User, select: 'name email' },
            { path: 'teamId', model: Team, select: 'name' },
            { path: 'assignedTo', model: User, select: 'name email' }
        ]);
        const taskObject = task.toObject();
        
        const teamData = taskObject.teamId as any;
        const assignedToData = taskObject.assignedTo as any;
        const createdByData = taskObject.userId as any;


        return NextResponse.json({
            ...taskObject,
            id: task._id.toString(),
            status: task.status,
            createdAt: task.createdAt.getTime(),
            updatedAt: task.updatedAt.getTime(),
            completedAt: task.completedAt?.getTime(),
            team: teamData ? { name: teamData.name } : undefined,
            assignedTo: assignedToData ? { id: assignedToData._id.toString(), name: assignedToData.name, email: assignedToData.email } : undefined,
            teamId: teamData?._id.toString(),
            createdBy: { id: createdByData._id.toString(), name: createdByData.name, email: createdByData.email }
        }, { status: 200 });

    } catch (error) {
        console.error('Error updating task:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    try {
        await dbConnect();
        const { id } = params;
        
        const hasPermission = await checkTaskPermission(id, session.user.id);
        
        if (!hasPermission) {
            return NextResponse.json({ message: 'Task not found or you do not have permission to delete it' }, { status: 404 });
        }

        await Task.deleteOne({ _id: id });

        return new NextResponse(null, { status: 204 });

    } catch (error) {
        console.error('Error deleting task:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
