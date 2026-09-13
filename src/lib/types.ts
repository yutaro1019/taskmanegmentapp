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

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

// invites/{token} というトップレベルのコレクションに置く(orgIdを事前に知らない
// 状態でもトークンだけでドキュメントを引けるようにするため、組織のサブコレクションに
// はしない)。詳細は docs/BACKEND_DESIGN.md 参照。
export interface Invite {
  orgId: string;
  orgName: string; // 招待画面にorgId抜きで表示するための非正規化
  email: string;
  role: Role;
  status: InviteStatus;
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

// API Routeはドキュメントのidを含めて返すので、それを表す型
export type MemberWithId = Member & { id: string };
export type TaskWithId = Task & { id: string };
export type InviteWithToken = Invite & { token: string };
