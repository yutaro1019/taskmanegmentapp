"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth/context";
import type { MemberWithId } from "@/lib/types";

const ROLE_LABEL = { admin: "管理者", member: "メンバー" } as const;

export default function UsersPage() {
  const { user, loading: authLoading, role } = useAuth();
  const [members, setMembers] = useState<MemberWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // タスク画面と同じ理由: 認証状態の復元が終わるまで待つ。
    if (authLoading || !user) return;
    apiFetch<{ members: MemberWithId[] }>("/api/members")
      .then((res) => setMembers(res.members))
      .catch((err) => setError(err instanceof Error ? err.message : "読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-bold">ユーザー管理</h1>

      {/* 招待の発行・ロール変更は管理者のみ操作可能な機能として別途実装予定 */}
      {role !== "admin" && (
        <p className="text-sm text-gray-500">
          メンバーの招待やロール変更は管理者のみ操作できます。
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">読み込み中...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-2">名前</th>
              <th className="py-2">メールアドレス</th>
              <th className="py-2">ロール</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b">
                <td className="py-2">{m.displayName}</td>
                <td className="py-2">{m.email}</td>
                <td className="py-2">{ROLE_LABEL[m.role]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
