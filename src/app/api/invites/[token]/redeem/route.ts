import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import type { Invite, Member } from "@/lib/types";

// POST /api/invites/[token]/redeem — 招待を承諾して組織に参加する。
// 呼び出す前提: ブラウザ側で既にFirebase Authのアカウント作成 or ログインが
// 完了しており、そのIDトークンを持っていること。
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const authHeader = request.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "トークンが無効です" }, { status: 401 });
  }

  const { token } = await params;
  const inviteRef = adminDb.collection("invites").doc(token);
  const inviteDoc = await inviteRef.get();

  if (!inviteDoc.exists) {
    return NextResponse.json({ error: "招待が見つかりません" }, { status: 404 });
  }

  const invite = inviteDoc.data() as Invite;

  if (invite.status !== "pending") {
    return NextResponse.json({ error: "この招待は既に使用済みか無効です" }, { status: 400 });
  }
  if (invite.expiresAt < Date.now()) {
    return NextResponse.json({ error: "この招待は有効期限が切れています" }, { status: 400 });
  }

  // 最重要チェック: 招待されたメールアドレスと、実際にログイン/登録した本人の
  // メールアドレスが一致するかをサーバー側で必ず確認する。これをやらないと、
  // 招待URLさえ知っていれば誰でも(別のメールアドレスで)そのロールで
  // 参加できてしまう。
  const decodedEmail = (decoded.email ?? "").toLowerCase();
  if (decodedEmail !== invite.email.toLowerCase()) {
    return NextResponse.json(
      { error: "招待されたメールアドレスと、ログイン中のアカウントのメールアドレスが一致しません" },
      { status: 403 }
    );
  }

  const uid = decoded.uid;

  const body = await request.json().catch(() => ({}));
  const displayName =
    typeof body.displayName === "string" && body.displayName.trim()
      ? body.displayName.trim()
      : decodedEmail;

  // 「1ユーザー1組織」ルール: 既にどこかの組織に所属していないか確認する。
  const existingUserDoc = await adminDb.collection("users").doc(uid).get();
  if (existingUserDoc.exists) {
    return NextResponse.json(
      { error: "既に別の組織に所属しています" },
      { status: 400 }
    );
  }

  const now = Date.now();
  const batch = adminDb.batch();

  const member: Member = {
    role: invite.role,
    email: decodedEmail,
    displayName,
    joinedAt: now,
  };
  batch.set(
    adminDb.collection("organizations").doc(invite.orgId).collection("members").doc(uid),
    member
  );
  batch.set(adminDb.collection("users").doc(uid), { email: decodedEmail, orgId: invite.orgId });
  batch.update(inviteRef, { status: "accepted" });

  await batch.commit();

  await adminAuth.setCustomUserClaims(uid, { orgId: invite.orgId, role: invite.role });

  return NextResponse.json({ orgId: invite.orgId, role: invite.role });
}
