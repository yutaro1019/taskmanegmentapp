"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/Button";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskFormModal, type TaskFormValues } from "@/components/tasks/TaskFormModal";
import type { MemberWithId, TaskStatus, TaskWithId } from "@/lib/types";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "未着手" },
  { status: "in_progress", label: "進行中" },
  { status: "done", label: "完了" },
];

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<TaskWithId[]>([]);
  const [members, setMembers] = useState<MemberWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalState, setModalState] = useState<{ task: TaskWithId | null; status: TaskStatus } | null>(
    null
  );

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
    if (authLoading || !user) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, TaskWithId[]> = { todo: [], in_progress: [], done: [] };
    for (const task of tasks) grouped[task.status].push(task);
    return grouped;
  }, [tasks]);

  async function handleFormSubmit(values: TaskFormValues) {
    const payload = {
      title: values.title,
      description: values.description,
      status: values.status,
      assigneeId: values.assigneeId || null,
      dueDate: values.dueDate || null,
    };
    if (modalState?.task) {
      await apiFetch(`/api/tasks/${modalState.task.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
    }
    await loadAll();
  }

  async function handleMove(task: TaskWithId, status: TaskStatus) {
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    }
  }

  async function handleDelete(task: TaskWithId) {
    if (!window.confirm(`「${task.title}」を削除しますか?`)) return;
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">タスク</h1>
        <Button variant="primary" onClick={() => setModalState({ task: null, status: "todo" })}>
          <Plus size={15} />
          新しいタスク
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">読み込み中...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map(({ status, label }) => (
            <div key={status} className="flex flex-col gap-2 rounded-lg bg-gray-100/70 p-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-gray-700">
                  {label}
                  <span className="ml-1.5 text-xs font-normal text-gray-400">
                    {tasksByStatus[status].length}
                  </span>
                </h2>
                <button
                  onClick={() => setModalState({ task: null, status })}
                  aria-label={`${label}にタスクを追加`}
                  className="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-700"
                >
                  <Plus size={15} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {tasksByStatus[status].length === 0 ? (
                  <p className="px-1 text-xs text-gray-400">タスクはありません</p>
                ) : (
                  tasksByStatus[status].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={() => setModalState({ task, status: task.status })}
                      onDelete={() => handleDelete(task)}
                      onMove={(newStatus) => handleMove(task, newStatus)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalState && (
        <TaskFormModal
          task={modalState.task}
          defaultStatus={modalState.status}
          members={members}
          onClose={() => setModalState(null)}
          onSubmit={handleFormSubmit}
        />
      )}
    </main>
  );
}
