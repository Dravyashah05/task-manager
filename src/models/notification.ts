
import mongoose, { Schema, models, model, Document } from 'mongoose';

export interface INotification extends Document {
  userId: Schema.Types.ObjectId; // The user to notify
  type: 'JOIN_REQUEST' | 'TEAM_INVITE' | 'TASK_ASSIGNED' | 'WELCOME_TO_TEAM' | 'TASK_CREATED' | 'TASK_UPDATED' | 'NEW_COMMENT'; // Notification type
  message: string;
  data: {
    teamId?: Schema.Types.ObjectId;
    teamName?: string;
    taskId?: Schema.Types.ObjectId;
    taskTitle?: string;
    requestingUserId?: Schema.Types.ObjectId; // for JOIN_REQUEST
    invitingUserId?: Schema.Types.ObjectId; // for TEAM_INVITE
    actorId?: Schema.Types.ObjectId; // User who performed the action
  };
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, enum: ['JOIN_REQUEST', 'TEAM_INVITE', 'TASK_ASSIGNED', 'WELCOME_TO_TEAM', 'TASK_CREATED', 'TASK_UPDATED', 'NEW_COMMENT'] },
  message: { type: String, required: true },
  data: {
    teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    teamName: { type: String },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
    taskTitle: { type: String },
    requestingUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    invitingUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

const Notification = models.Notification || model<INotification>('Notification', NotificationSchema);
export default Notification;
