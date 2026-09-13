"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth/context";
import type { MemberWithId, TaskStatus, TaskWithId } from "@/lib/types";

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

const emptyForm = {
  title: "",
  description: "",
  status: "todo" as TaskStatus,
  assigneeId: "",
  dueDate: "",
};

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<TaskWithId[]>([]);
  const [members, setMembers] = useState<MemberWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [tasksRes, membersRes] = await Promise.all([
        apiFetch<{ tasks: TaskWithId[] }>("/api/tasks"),
        apiFetch<{ members: MemberWithId[] }>("/api/members"),
      ]);
      setTasks(tasksRes.tasks);
      setMembers(membersRes.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // page.goto()のようなフルリロード直後は、Firebase Authがログイン状態を
    // 復元し終わるまで一瞬 user が null になる。authLoading が終わるまで待つ。
    if (authLoading || !user) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  function startEdit(task: TaskWithId) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description,
      status: task.status,
      assigneeId: task.assigneeId ?? "",
      dueDate: task.dueDate ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      title: form.title,
      description: form.description,
      status: form.status,
      assigneeId: form.assigneeId || null,
      dueDate: form.dueDate || null,
    };

    try {
      if (editingId) {
        await apiFetch(`/api/tasks/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/tasks", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      cancelEdit();
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(task: TaskWithId, status: TaskStatus) {
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("このタスクを削除しますか?")) return;
    try {
      await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (editingId === id) cancelEdit();
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
      <h1 className="text-xl font-bold">タスク</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded border p-4">
        <h2 className="text-sm font-bold">{editingId ? "タスクを編集" : "新しいタスク"}</h2>
        <label className="flex flex-col gap-1 text-sm">
          タイトル
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          説明
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded border px-3 py-2"
            rows={3}
          />
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm">
            ステータス
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
              className="rounded border px-3 py-2"
            >
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            担当者
            <select
              value={form.assigneeId}
              onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
              className="rounded border px-3 py-2"
            >
              <option value="">(未割り当て)</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName || m.email}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            期限
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="rounded border px-3 py-2"
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {editingId ? "更新する" : "追加する"}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="rounded border px-4 py-2 text-sm">
              キャンセル
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">読み込み中...</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-gray-500">まだタスクがありません。</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-col gap-2 rounded border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold">{task.title}</p>
                  {task.description && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2 text-sm">
                  <button onClick={() => startEdit(task)} className="underline">
                    編集
                  </button>
                  <button onClick={() => handleDelete(task.id)} className="text-red-600 underline">
                    削除
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                  className="rounded border px-2 py-1"
                >
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <span>担当: {task.assigneeName ?? "未割り当て"}</span>
                <span>期限: {task.dueDate ?? "未設定"}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
