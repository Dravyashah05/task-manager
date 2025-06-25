
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import Team from '@/models/team';
import User from '@/models/user';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    await dbConnect();
    // Find teams where the current user is a member
    const teams = await Team.find({ members: session.user.id })
      .populate({ path: 'members', model: User, select: 'id name email' })
      .populate({ path: 'pendingRequests', model: User, select: 'id name email' })
      .sort({ createdAt: -1 });
    
    const formattedTeams = teams.map(team => {
      const isOwner = team.ownerId.toString() === session.user.id;
      return {
        id: team._id.toString(),
        name: team.name,
        code: team.code,
        ownerId: team.ownerId.toString(),
        members: team.members.filter(Boolean).map((member: any) => ({
            id: member._id.toString(),
            name: member.name,
            email: member.email,
        })),
        createdAt: team.createdAt.getTime(),
        pendingRequests: isOwner ? team.pendingRequests.filter(Boolean).map((member: any) => ({
            id: member._id.toString(),
            name: member.name,
            email: member.email,
        })) : undefined,
      };
    });

    return NextResponse.json(formattedTeams, { status: 200 });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.email) {
        return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    try {
        await dbConnect();
        const { name, code } = await req.json();

        if (!name || !code) {
            return NextResponse.json({ message: 'Team name and code are required' }, { status: 400 });
        }
        
        const existingTeam = await Team.findOne({ code });
        if (existingTeam) {
            return NextResponse.json({ message: 'Team code already in use' }, { status: 409 });
        }

        const newTeam = new Team({
            name,
            code,
            ownerId: session.user.id,
            members: [session.user.id], // The creator is the first member
            pendingRequests: [],
        });
        await newTeam.save();

        const newTeamObject = newTeam.toObject();

        return NextResponse.json({
            id: newTeamObject._id.toString(),
            name: newTeamObject.name,
            code: newTeamObject.code,
            ownerId: newTeamObject.ownerId.toString(),
            members: [{ id: session.user.id, name: session.user.name, email: session.user.email }],
            createdAt: newTeamObject.createdAt.getTime(),
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating team:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
