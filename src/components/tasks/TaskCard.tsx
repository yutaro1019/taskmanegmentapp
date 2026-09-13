"use client";

import { Calendar, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { TaskStatus, TaskWithId } from "@/lib/types";

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done"];

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

export function TaskCard({
  task,
  onEdit,
  onDelete,
  onMove,
}: {
  task: TaskWithId;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (status: TaskStatus) => void;
}) {
  const index = STATUS_ORDER.indexOf(task.status);
  const overdue = task.status !== "done" && isOverdue(task.dueDate);

  return (
    <div className="group rounded-md border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900">{task.title}</p>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onEdit}
            aria-label="編集"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            aria-label="削除"
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-gray-500">{task.description}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          {task.assigneeName ? (
            <>
              <Avatar name={task.assigneeName} />
              <span>{task.assigneeName}</span>
            </>
          ) : (
            <span className="text-gray-400">未割り当て</span>
          )}
        </div>
        {task.dueDate && (
          <span
            className={`inline-flex items-center gap-1 text-xs ${overdue ? "font-medium text-red-600" : "text-gray-400"}`}
          >
            <Calendar size={12} />
            {task.dueDate}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 border-t border-gray-100 pt-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          disabled={index === 0}
          onClick={() => onMove(STATUS_ORDER[index - 1])}
          aria-label="前のステータスへ"
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:invisible"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          disabled={index === STATUS_ORDER.length - 1}
          onClick={() => onMove(STATUS_ORDER[index + 1])}
          aria-label="次のステータスへ"
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:invisible"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
