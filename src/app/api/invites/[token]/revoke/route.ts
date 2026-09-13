import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Invite } from "@/lib/types";

// POST /api/invites/[token]/revoke — 招待の取り消し(管理者のみ、自分の組織の招待のみ)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const auth = await requireOrgAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "管理者のみ実行できます" }, { status: 403 });
  }

  const { token } = await params;
  const db = getAdminDb();
  const ref = db.collection("invites").doc(token);
  const doc = await ref.get();

  if (!doc.exists) {
    return NextResponse.json({ error: "招待が見つかりません" }, { status: 404 });
  }

  const invite = doc.data() as Invite;
  // 他の組織の招待を取り消せてしまわないよう、orgIdが一致するか確認する。
  if (invite.orgId !== auth.orgId) {
    return NextResponse.json({ error: "この招待を操作する権限がありません" }, { status: 403 });
  }

  await ref.update({ status: "revoked" });
  return NextResponse.json({ ok: true });
}
