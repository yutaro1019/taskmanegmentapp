import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import type { Organization, Member } from "@/lib/types";

// POST /api/organizations
// 新しい組織を作成し、リクエストした本人をその組織の admin にする。
// 「組織を新規に作る」という操作自体は誰にでも許可されているが、
// - Custom Claims の書き込みはサーバー(Admin SDK)でしかできない
// - 組織作成・メンバー登録・所属登録の3つの書き込みをセットで行いたい
// という2つの理由でAPI Routeを経由させている。
export async function POST(request: NextRequest) {
  // 1. 身分証(IDトークン)を取り出して検証する。
  //    ここで得られる uid は、リクエスト元が自己申告した値ではなく、
  //    Firebase(Google)が署名したトークンを検証して得られる「確実な本人のuid」。
  const authHeader = request.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "トークンが無効です" }, { status: 401 });
  }

  const uid = decodedToken.uid;
  const email = decodedToken.email ?? "";

  // 2. 「1ユーザー1組織」ルール: 既にどこかの組織に所属していないか確認する。
  const existingUserDoc = await adminDb.collection("users").doc(uid).get();
  if (existingUserDoc.exists) {
    return NextResponse.json(
      { error: "既に組織に所属しています" },
      { status: 400 }
    );
  }

  // 3. リクエスト本文を読み取る。ブラウザが送ってくる値は型すら信用しない。
  const body = await request.json();
  const orgName = typeof body.orgName === "string" ? body.orgName.trim() : "";
  const displayName =
    typeof body.displayName === "string" && body.displayName.trim()
      ? body.displayName.trim()
      : email;

  if (!orgName) {
    return NextResponse.json(
      { error: "組織名を入力してください" },
      { status: 400 }
    );
  }

  // 4. Firestoreへの書き込みをひとまとめに行う(全部成功 or 全部なかったことに)。
  const orgRef = adminDb.collection("organizations").doc();
  const now = Date.now();
  const batch = adminDb.batch();

  const organization: Organization = { name: orgName, createdAt: now, createdBy: uid };
  batch.set(orgRef, organization);

  const member: Member = { role: "admin", email, displayName, joinedAt: now };
  batch.set(orgRef.collection("members").doc(uid), member);

  batch.set(adminDb.collection("users").doc(uid), { email, orgId: orgRef.id });

  await batch.commit();

  // 5. Custom Claims を設定する。これはサーバー(Admin SDK)でしかできない。
  //    以後このuidのIDトークンには { orgId, role: "admin" } が焼き込まれる
  //    (ただし、ログイン中のクライアントに反映されるにはトークンの再取得が必要)。
  await adminAuth.setCustomUserClaims(uid, { orgId: orgRef.id, role: "admin" });

  return NextResponse.json({ orgId: orgRef.id });
}
