
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import Team from '@/models/team';
import Notification from '@/models/notification';
import mongoose from 'mongoose';

// Handle join requests (Accept/Reject)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    await dbConnect();
    const { id: teamId } = params;
    const { requestingUserId, action } = await req.json(); // action: 'accept' or 'reject'

    if (!requestingUserId || !action) {
      return NextResponse.json({ message: 'Missing required fields: requestingUserId and action' }, { status: 400 });
    }
    
    const team = await Team.findById(teamId);

    if (!team) {
      return NextResponse.json({ message: 'Team not found' }, { status: 404 });
    }

    // Only the team owner can handle requests
    if (team.ownerId.toString() !== session.user.id) {
      return NextResponse.json({ message: 'You are not authorized to manage this team' }, { status: 403 });
    }

    const requestingUserObjectId = new mongoose.Types.ObjectId(requestingUserId);

    // Check if the request exists
    const requestIndex = team.pendingRequests.findIndex(id => id.equals(requestingUserObjectId));
    if (requestIndex === -1) {
      return NextResponse.json({ message: 'Join request not found or already handled' }, { status: 404 });
    }
    
    // Remove the user from pending requests
    team.pendingRequests.splice(requestIndex, 1);

    if (action === 'accept') {
      // Add user to members if not already a member
      if (!team.members.includes(requestingUserObjectId)) {
        team.members.push(requestingUserObjectId);
      }
      // Create a welcome notification for the user who was accepted
      const welcomeNotification = new Notification({
        userId: requestingUserObjectId,
        type: 'WELCOME_TO_TEAM',
        message: `Welcome! You have been added to the team "${team.name}".`,
        data: {
          teamId: team._id,
          teamName: team.name,
          actorId: session.user.id, // The owner who accepted
        },
      });
      await welcomeNotification.save();
    }
    // For 'reject', we just remove them from pending, which is already done.
    
    await team.save();
    
    // After handling the request, delete the corresponding notification for the owner
    await Notification.deleteOne({
      'data.teamId': team._id,
      'data.requestingUserId': requestingUserObjectId,
      type: 'JOIN_REQUEST'
    });

    return NextResponse.json({ message: `Request has been ${action === 'accept' ? 'accepted' : 'rejected'}` }, { status: 200 });

  } catch (error) {
    console.error(`Error handling join request:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
