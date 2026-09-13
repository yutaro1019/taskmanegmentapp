import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Member } from "@/lib/types";

// GET /api/members — 自分の組織のメンバー一覧(担当者選択・ユーザー管理画面で使う)
export async function GET(request: NextRequest) {
  const auth = await requireOrgMember(request);
  if (!auth) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const db = getAdminDb();
  const snapshot = await db
    .collection("organizations")
    .doc(auth.orgId)
    .collection("members")
    .get();

  const members = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Member) }));
  return NextResponse.json({ members });
}
