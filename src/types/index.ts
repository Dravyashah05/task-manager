
export interface UserSubset {
  id: string;
  name: string;
  email: string;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  status: 'todo' | 'in-progress' | 'done';
  category?: string;
  priority?: 'high' | 'medium' | 'low' | string;
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  completedAt?: number; // timestamp
  teamId?: string;
  team?: { name: string };
  assignedTo?: UserSubset;
  createdBy: UserSubset;
  comments: Comment[];
}

export interface TeamMember extends UserSubset {}

export interface Comment {
  id: string;
  content: string;
  createdAt: string; // ISO date string
  user: UserSubset;
}


export interface SmartSortTaskInput {
  id: string;
  title:string;
  notes: string;
}

export interface Team {
  id: string;
  name: string;
  code: string;
  members: TeamMember[];
  createdAt: number; // timestamp
  ownerId: string;
  pendingRequests?: TeamMember[];
}

export type NotificationStyle = "dock" | "float";

export type NotificationType = "JOIN_REQUEST" | "TEAM_INVITE" | "TASK_ASSIGNED" | "WELCOME_TO_TEAM" | "TASK_CREATED" | "TASK_UPDATED" | "NEW_COMMENT";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  data: {
    teamId?: string;
    teamName?: string;
    taskId?: string;
    taskTitle?: string;
    requestingUserId?: string;
    requestingUserName?: string;
    invitingUserId?: string;
    invitingUserName?: string;
    actorId?: string;
    actorName?: string;
  };
  isRead: boolean;
  createdAt: string; // ISO date string
}
