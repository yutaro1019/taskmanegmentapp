import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/auth/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["admin", "member"];

// PATCH /api/members/[uid] — メンバーのロール変更(管理者のみ)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const auth = await requireOrgAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "管理者のみ実行できます" }, { status: 403 });
  }

  const { uid: targetUid } = await params;
  const body = await request.json();
  const newRole: Role | undefined = ROLES.includes(body.role) ? body.role : undefined;
  if (!newRole) {
    return NextResponse.json({ error: "ロールの指定が不正です" }, { status: 400 });
  }

  const db = getAdminDb();
  const orgRef = db.collection("organizations").doc(auth.orgId);
  const targetRef = orgRef.collection("members").doc(targetUid);
  const targetDoc = await targetRef.get();

  if (!targetDoc.exists) {
    return NextResponse.json({ error: "メンバーが見つかりません" }, { status: 404 });
  }

  const currentRole = targetDoc.data()?.role as Role;

  // 「組織の管理者が0人になる」事態を防ぐ。admin -> member への変更で、
  // かつ現在の管理者がこの1人しかいない場合はブロックする(自分自身に限らず、
  // 誰が実行しても最後の管理者を降格させることはできない)。
  if (currentRole === "admin" && newRole === "member") {
    const adminCountSnapshot = await orgRef
      .collection("members")
      .where("role", "==", "admin")
      .get();
    if (adminCountSnapshot.size <= 1) {
      return NextResponse.json(
        { error: "組織の管理者が1人もいなくなるため、この操作はできません" },
        { status: 400 }
      );
    }
  }

  await targetRef.update({ role: newRole });

  // ロールが変わったので、対象ユーザーのCustom Claimsも更新する。
  // (このAPIを呼んでいる管理者ではなく、ロールを変更された本人のトークンを更新する)
  const adminAuth = getAdminAuth();
  await adminAuth.setCustomUserClaims(targetUid, { orgId: auth.orgId, role: newRole });

  return NextResponse.json({ id: targetUid, role: newRole });
}
