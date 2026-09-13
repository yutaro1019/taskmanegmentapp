import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { TaskStatus } from "@/lib/types";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

// PATCH /api/tasks/[id] — タスク更新(組織のメンバーなら誰でも編集可。担当者限定にはしない)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrgMember(request);
  if (!auth) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await params;
  const db = getAdminDb();
  const orgRef = db.collection("organizations").doc(auth.orgId);
  const taskRef = orgRef.collection("tasks").doc(id);

  const existing = await taskRef.get();
  if (!existing.exists) {
    return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 });
  }

  const body = await request.json();
  const update: Record<string, unknown> = { updatedAt: Date.now() };

  if (typeof body.title === "string" && body.title.trim()) {
    update.title = body.title.trim();
  }
  if (typeof body.description === "string") {
    update.description = body.description.trim();
  }
  if (STATUSES.includes(body.status)) {
    update.status = body.status;
  }
  if (typeof body.dueDate === "string" || body.dueDate === null) {
    update.dueDate = body.dueDate || null;
  }
  if ("assigneeId" in body) {
    if (body.assigneeId === null || body.assigneeId === "") {
      update.assigneeId = null;
      update.assigneeName = null;
    } else if (typeof body.assigneeId === "string") {
      const memberDoc = await orgRef.collection("members").doc(body.assigneeId).get();
      if (!memberDoc.exists) {
        return NextResponse.json({ error: "担当者が見つかりません" }, { status: 400 });
      }
      update.assigneeId = body.assigneeId;
      update.assigneeName = (memberDoc.data()?.displayName as string) ?? null;
    }
  }

  await taskRef.update(update);
  const updated = await taskRef.get();
  return NextResponse.json({ id: updated.id, ...updated.data() });
}

// DELETE /api/tasks/[id] — タスク削除(組織のメンバーなら誰でも削除可)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrgMember(request);
  if (!auth) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await params;
  const db = getAdminDb();
  const taskRef = db
    .collection("organizations")
    .doc(auth.orgId)
    .collection("tasks")
    .doc(id);

  const existing = await taskRef.get();
  if (!existing.exists) {
    return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 });
  }

  await taskRef.delete();
  return NextResponse.json({ ok: true });
}
