"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth/context";
import type { InviteWithToken, MemberWithId, Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = { admin: "管理者", member: "メンバー" };
const INVITE_STATUS_LABEL: Record<InviteWithToken["status"], string> = {
  pending: "招待中",
  accepted: "参加済み",
  revoked: "取り消し済み",
  expired: "期限切れ",
};

export default function UsersPage() {
  const { user, loading: authLoading, role: myRole } = useAuth();
  const isAdmin = myRole === "admin";

  const [members, setMembers] = useState<MemberWithId[]>([]);
  const [invites, setInvites] = useState<InviteWithToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const membersRes = await apiFetch<{ members: MemberWithId[] }>("/api/members");
      setMembers(membersRes.members);
      if (isAdmin) {
        const invitesRes = await apiFetch<{ invites: InviteWithToken[] }>("/api/invites");
        setInvites(invitesRes.invites);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // タスク画面と同じ理由: 認証状態の復元が終わるまで待つ。
    if (authLoading || !user) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isAdmin]);

  async function handleInviteSubmit(e: FormEvent) {
    e.preventDefault();
    setInviteSubmitting(true);
    setInviteError(null);
    setLastInviteUrl(null);
    try {
      const res = await apiFetch<InviteWithToken>("/api/invites", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setLastInviteUrl(`${window.location.origin}/invite/${res.token}`);
      setInviteEmail("");
      setInviteRole("member");
      await loadAll();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "招待の作成に失敗しました");
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function handleRevoke(token: string) {
    try {
      await apiFetch(`/api/invites/${token}/revoke`, { method: "POST" });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "取り消しに失敗しました");
    }
  }

  async function handleRoleChange(memberId: string, newRole: Role) {
    setError(null);
    try {
      await apiFetch(`/api/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ロール変更に失敗しました");
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // クリップボードが使えない環境では手動コピーしてもらう(入力欄はreadonlyで表示済み)
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <h1 className="text-xl font-bold">ユーザー管理</h1>

      {!isAdmin && (
        <p className="text-sm text-gray-500">
          メンバーの招待やロール変更は管理者のみ操作できます。
        </p>
      )}

      {isAdmin && (
        <form onSubmit={handleInviteSubmit} className="flex flex-col gap-3 rounded border p-4">
          <h2 className="text-sm font-bold">メンバーを招待</h2>
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1 text-sm">
              メールアドレス
              <input
                required
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="rounded border px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              ロール
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="rounded border px-3 py-2"
              >
                <option value="member">メンバー</option>
                <option value="admin">管理者</option>
              </select>
            </label>
          </div>
          {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
          <button
            type="submit"
            disabled={inviteSubmitting}
            className="w-fit rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            招待を作成
          </button>
          {lastInviteUrl && (
            <div className="flex flex-col gap-1 rounded bg-gray-50 p-3 text-sm">
              <p>招待リンクを発行しました。コピーして共有してください。</p>
              <div className="flex gap-2">
                <input readOnly value={lastInviteUrl} className="flex-1 rounded border px-2 py-1" />
                <button
                  type="button"
                  onClick={() => copyToClipboard(lastInviteUrl)}
                  className="rounded border px-3 py-1"
                >
                  コピー
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">読み込み中...</p>
      ) : (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-bold">メンバー一覧</h2>
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
                  <td className="py-2">
                    {isAdmin ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value as Role)}
                        className="rounded border px-2 py-1"
                      >
                        <option value="member">メンバー</option>
                        <option value="admin">管理者</option>
                      </select>
                    ) : (
                      ROLE_LABEL[m.role]
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && invites.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-bold">招待一覧</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-2">メールアドレス</th>
                <th className="py-2">ロール</th>
                <th className="py-2">状態</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.token} className="border-b">
                  <td className="py-2">{invite.email}</td>
                  <td className="py-2">{ROLE_LABEL[invite.role]}</td>
                  <td className="py-2">{INVITE_STATUS_LABEL[invite.status]}</td>
                  <td className="py-2">
                    {invite.status === "pending" && (
                      <button onClick={() => handleRevoke(invite.token)} className="text-red-600 underline">
                        取り消す
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
