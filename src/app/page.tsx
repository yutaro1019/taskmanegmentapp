"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/context";

export default function Home() {
  const { user, loading, orgId, role } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-bold">タスク管理アプリ</h1>
        <div className="flex gap-4">
          <Link href="/login" className="rounded bg-black px-4 py-2 text-white">
            ログイン
          </Link>
          <Link href="/signup" className="rounded border px-4 py-2">
            新規登録
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-16">
      <h1 className="text-xl font-bold">ログイン中</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-500">メールアドレス</dt>
        <dd>{user.email}</dd>
        <dt className="text-gray-500">組織ID</dt>
        <dd>{orgId ?? "(未設定)"}</dd>
        <dt className="text-gray-500">ロール</dt>
        <dd>{role ?? "(未設定)"}</dd>
      </dl>
      <div className="flex gap-4 text-sm">
        <Link href="/tasks" className="underline">
          タスク一覧へ
        </Link>
        <Link href="/users" className="underline">
          ユーザー管理へ
        </Link>
      </div>
    </main>
  );
}
