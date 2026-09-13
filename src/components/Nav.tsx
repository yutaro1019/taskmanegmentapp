"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";

export function Nav() {
  const { user, loading } = useAuth();

  if (loading || !user) return null;

  async function handleLogout() {
    await signOut(getFirebaseAuth());
  }

  return (
    <nav className="flex items-center gap-4 border-b px-4 py-3 text-sm">
      <Link href="/" className="font-bold">
        タスク管理アプリ
      </Link>
      <Link href="/tasks">タスク</Link>
      <Link href="/users">ユーザー管理</Link>
      <button onClick={handleLogout} className="ml-auto text-gray-500">
        ログアウト
      </button>
    </nav>
  );
}
