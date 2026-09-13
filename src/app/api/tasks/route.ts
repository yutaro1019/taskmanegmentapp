import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Task, TaskStatus } from "@/lib/types";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

// GET /api/tasks — 自分の組織のタスク一覧
export async function GET(request: NextRequest) {
  const auth = await requireOrgMember(request);
  if (!auth) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const db = getAdminDb();
  const snapshot = await db
    .collection("organizations")
    .doc(auth.orgId)
    .collection("tasks")
    .orderBy("createdAt", "desc")
    .get();

  const tasks = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Task) }));
  return NextResponse.json({ tasks });
}

// POST /api/tasks — タスク作成(組織のメンバーなら誰でも作成可)
export async function POST(request: NextRequest) {
  const auth = await requireOrgMember(request);
  if (!auth) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const status: TaskStatus = STATUSES.includes(body.status) ? body.status : "todo";
  const dueDate = typeof body.dueDate === "string" && body.dueDate ? body.dueDate : null;
  const assigneeId = typeof body.assigneeId === "string" && body.assigneeId ? body.assigneeId : null;

  if (!title) {
    return NextResponse.json({ error: "タイトルを入力してください" }, { status: 400 });
  }

  const db = getAdminDb();
  const orgRef = db.collection("organizations").doc(auth.orgId);

  // 担当者は「同じ組織のメンバー」であることをサーバー側で確認する
  // (クライアントが送ってきたIDをそのまま信用しない)。
  let assigneeName: string | null = null;
  if (assigneeId) {
    const memberDoc = await orgRef.collection("members").doc(assigneeId).get();
    if (!memberDoc.exists) {
      return NextResponse.json({ error: "担当者が見つかりません" }, { status: 400 });
    }
    assigneeName = (memberDoc.data()?.displayName as string) ?? null;
  }

  const now = Date.now();
  const task: Task = {
    title,
    description,
    status,
    assigneeId,
    assigneeName,
    dueDate,
    createdBy: auth.uid,
    createdAt: now,
    updatedAt: now,
  };

  const taskRef = await orgRef.collection("tasks").add(task);
  return NextResponse.json({ id: taskRef.id, ...task }, { status: 201 });
}
