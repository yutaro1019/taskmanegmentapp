import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";

// GET /api/me — 画面表示用に、ログイン中の本人の表示名と所属組織名を返す。
// Custom Claimsには orgId と role しか入っていない(名前や組織名までトークンに
// 詰め込むと肥大化するため)ので、表示専用の情報は毎回Firestoreから引く。
export async function GET(request: NextRequest) {
  const auth = await requireOrgMember(request);
  if (!auth) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const db = getAdminDb();
  const [orgDoc, memberDoc] = await Promise.all([
    db.collection("organizations").doc(auth.orgId).get(),
    db.collection("organizations").doc(auth.orgId).collection("members").doc(auth.uid).get(),
  ]);

  return NextResponse.json({
    email: auth.email,
    role: auth.role,
    orgId: auth.orgId,
    orgName: (orgDoc.data()?.name as string) ?? "",
    displayName: (memberDoc.data()?.displayName as string) ?? auth.email,
  });
}
