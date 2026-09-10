export type Role = "admin" | "member";

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Organization {
  name: string;
  createdAt: number;
  createdBy: string;
}

export interface Member {
  role: Role;
  email: string;
  displayName: string;
  joinedAt: number;
}

export interface Invite {
  email: string;
  role: Role;
  token: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  invitedBy: string;
  createdAt: number;
  expiresAt: number;
}

export interface Task {
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}
