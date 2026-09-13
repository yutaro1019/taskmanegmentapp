import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Invite, InviteWithToken, Role } from "@/lib/types";

const ROLES: Role[] = ["admin", "member"];
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7日間

// GET /api/invites — 自分の組織が発行した招待の一覧(管理者のみ)
export async function GET(request: NextRequest) {
  const auth = await requireOrgAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "管理者のみ実行できます" }, { status: 403 });
  }

  const db = getAdminDb();
  const snapshot = await db.collection("invites").where("orgId", "==", auth.orgId).get();

  const now = Date.now();
  const invites: InviteWithToken[] = snapshot.docs
    .map((doc) => {
      const invite = doc.data() as Invite;
      // GET /api/invites/[token] と同じ基準で期限切れを都度計算する。
      // Firestore上のstatusは"pending"のままでも、表示上は「期限切れ」にする。
      const status = invite.status === "pending" && invite.expiresAt < now ? "expired" : invite.status;
      return { token: doc.id, ...invite, status };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  return NextResponse.json({ invites });
}

// POST /api/invites — 招待を作成(管理者のみ)。実際のメール送信はせず、
// 発行したURLを画面に表示し、管理者が手動で共有する運用。
export async function POST(request: NextRequest) {
  const auth = await requireOrgAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "管理者のみ実行できます" }, { status: 403 });
  }

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role: Role = ROLES.includes(body.role) ? body.role : "member";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "有効なメールアドレスを入力してください" }, { status: 400 });
  }

  const db = getAdminDb();
  const orgDoc = await db.collection("organizations").doc(auth.orgId).get();
  const orgName = (orgDoc.data()?.name as string) ?? "";

  // tokenをそのままドキュメントIDにする。招待された側はまだ組織に属していない
  // (=orgIdを知らない)ので、トークン1つだけで招待内容を引けるようにするため
  // organizationsのサブコレクションではなくトップレベルの invites/{token} に置く。
  const token = randomUUID();
  const now = Date.now();
  const invite: Invite = {
    orgId: auth.orgId,
    orgName,
    email,
    role,
    status: "pending",
    invitedBy: auth.uid,
    createdAt: now,
    expiresAt: now + INVITE_TTL_MS,
  };

  await db.collection("invites").doc(token).set(invite);

  return NextResponse.json({ token, ...invite }, { status: 201 });
}
