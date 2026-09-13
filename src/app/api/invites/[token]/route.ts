import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Invite } from "@/lib/types";

// GET /api/invites/[token] — 招待リンクを開いた人が「どの組織の、何ロールの招待か」を
// 確認するための公開エンドポイント。まだアカウントを持っていない人がアクセスするので
// 認証は要求しない。ただし返す情報は表示に必要な最小限に絞る。
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const db = getAdminDb();
  const doc = await db.collection("invites").doc(token).get();

  if (!doc.exists) {
    return NextResponse.json({ error: "招待が見つかりません" }, { status: 404 });
  }

  const invite = doc.data() as Invite;
  const isExpired = invite.status === "pending" && invite.expiresAt < Date.now();
  const status = isExpired ? "expired" : invite.status;

  return NextResponse.json({
    orgName: invite.orgName,
    email: invite.email,
    role: invite.role,
    status,
  });
}
