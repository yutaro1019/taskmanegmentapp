"use client";

import Link from "next/link";
import { ListTodo, Users } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

export default function Home() {
  const { user, loading, orgId, role } = useAuth();

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-5 px-4 text-center">
        <h1 className="text-xl font-bold text-gray-900">タスク管理アプリ</h1>
        <p className="text-sm text-gray-500">組織単位でタスクとメンバーを管理できます。</p>
        <div className="flex gap-3">
          <Link href="/login" className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
            ログイン
          </Link>
          <Link href="/signup" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            新規登録
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10">
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <Avatar name={user.email ?? "?"} size="md" />
          <div>
            <p className="text-sm font-medium text-gray-900">{user.email}</p>
            <p className="text-xs text-gray-500">組織ID: {orgId ?? "(未設定)"}</p>
          </div>
          <div className="ml-auto">
            <Badge variant={role === "admin" ? "purple" : "gray"}>
              {role === "admin" ? "管理者" : role === "member" ? "メンバー" : "(未設定)"}
            </Badge>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/tasks"
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600">
            <ListTodo size={18} />
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900">タスク</p>
            <p className="text-xs text-gray-500">一覧・作成・編集</p>
          </div>
        </Link>
        <Link
          href="/users"
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-purple-50 text-purple-600">
            <Users size={18} />
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900">ユーザー管理</p>
            <p className="text-xs text-gray-500">メンバー・招待・ロール</p>
          </div>
        </Link>
      </div>
    </main>
  );
}
