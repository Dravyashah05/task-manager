
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/task';
import Team from '@/models/team';
import User from '@/models/user';
import Notification from '@/models/notification';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    await dbConnect();

    // Find all teams the user is a member of
    const userTeams = await Team.find({ members: session.user.id }).select('_id');
    const userTeamIds = userTeams.map(team => team._id);

    // Find tasks created by the user OR assigned to any of the user's teams
    const tasks = await Task.find({
      $or: [
        { userId: session.user.id }, // Personal tasks created by the user
        { teamId: { $in: userTeamIds } } // Tasks in teams the user is a member of
      ]
    })
      .populate({ path: 'userId', model: User, select: 'name email' })
      .populate({ path: 'teamId', model: Team, select: 'name' })
      .populate({ path: 'assignedTo', model: User, select: 'name email' })
      .sort({ createdAt: -1 });
    
    const formattedTasks = tasks.map(task => {
        const teamData = task.teamId as any; // Cast to access populated field
        const assignedToData = task.assignedTo as any;
        const createdByData = task.userId as any;
        return {
            id: task._id.toString(),
            title: task.title,
            notes: task.notes,
            status: task.status,
            category: task.category,
            priority: task.priority,
            createdAt: task.createdAt.getTime(),
            updatedAt: task.updatedAt.getTime(),
            completedAt: task.completedAt?.getTime(),
            teamId: teamData?._id.toString(),
            team: teamData ? { name: teamData.name } : undefined,
            assignedTo: assignedToData ? { id: assignedToData._id.toString(), name: assignedToData.name, email: assignedToData.email } : undefined,
            createdBy: { id: createdByData._id.toString(), name: createdByData.name, email: createdByData.email }
        };
    });

    return NextResponse.json(formattedTasks, { status: 200 });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.name) {
        return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    try {
        await dbConnect();
        const { title, notes, priority, teamId, assignedTo } = await req.json();

        if (!title) {
            return NextResponse.json({ message: 'Title is required' }, { status: 400 });
        }
        
        const newTaskData: any = {
            userId: session.user.id,
            title,
            notes,
            priority: priority && priority !== "none" ? priority : undefined,
        };

        if (teamId && teamId !== '__none__') {
            newTaskData.teamId = teamId;
        }

        if (assignedTo && assignedTo !== '__none__') {
            newTaskData.assignedTo = assignedTo;
        }

        const task = new Task(newTaskData);
        await task.save();

        if (teamId && teamId !== '__none__') {
            const team = await Team.findById(teamId);
            if (team) {
                const notifications = team.members
                    .filter(memberId => memberId.toString() !== session.user.id)
                    .map(memberId => ({
                        userId: memberId,
                        type: 'TASK_CREATED',
                        message: `${session.user.name} created a new task in ${team.name}: "${task.title}"`,
                        data: {
                            taskId: task._id,
                            taskTitle: task.title,
                            teamId: team._id,
                            teamName: team.name,
                            actorId: session.user.id,
                        }
                    }));
                if (notifications.length > 0) {
                    await Notification.insertMany(notifications);
                }
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
            team: teamData ? { name: teamData.name } : undefined,
            assignedTo: assignedToData ? { id: assignedToData._id.toString(), name: assignedToData.name, email: assignedToData.email } : undefined,
            teamId: teamData?._id.toString(),
            createdBy: { id: createdByData._id.toString(), name: createdByData.name, email: createdByData.email }
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating task:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
