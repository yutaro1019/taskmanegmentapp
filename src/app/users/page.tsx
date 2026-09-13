"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Copy, UserPlus, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth/context";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { InviteWithToken, MemberWithId, Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = { admin: "管理者", member: "メンバー" };
const INVITE_STATUS_VARIANT: Record<InviteWithToken["status"], "amber" | "green" | "gray" | "red"> = {
  pending: "amber",
  accepted: "green",
  revoked: "gray",
  expired: "red",
};
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
  const [copied, setCopied] = useState(false);

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
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボードが使えない環境では手動コピーしてもらう(入力欄はreadonlyで表示済み)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <h1 className="text-lg font-semibold text-gray-900">ユーザー管理</h1>

      {!isAdmin && (
        <p className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-500">
          メンバーの招待やロール変更は管理者のみ操作できます。
        </p>
      )}

      {isAdmin && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <UserPlus size={15} />
            メンバーを招待
          </h2>
          <form onSubmit={handleInviteSubmit} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-1 min-w-[200px] flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-gray-500">メールアドレス</span>
              <input
                required
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-gray-500">ロール</span>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
              >
                <option value="member">メンバー</option>
                <option value="admin">管理者</option>
              </select>
            </label>
            <Button type="submit" variant="primary" disabled={inviteSubmitting}>
              招待を作成
            </Button>
          </form>
          {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
          {lastInviteUrl && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-gray-50 p-2.5">
              <input
                readOnly
                value={lastInviteUrl}
                className="flex-1 truncate bg-transparent text-sm text-gray-600 focus:outline-none"
              />
              <Button type="button" variant="secondary" onClick={() => copyToClipboard(lastInviteUrl)}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "コピーしました" : "コピー"}
              </Button>
            </div>
          )}
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">読み込み中...</p>
      ) : (
        <section className="rounded-lg border border-gray-200 bg-white">
          <h2 className="border-b px-4 py-3 text-sm font-semibold text-gray-900">
            メンバー ({members.length})
          </h2>
          <ul>
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
                <Avatar name={m.displayName || m.email} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{m.displayName}</p>
                  <p className="truncate text-xs text-gray-500">{m.email}</p>
                </div>
                {isAdmin ? (
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value as Role)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-gray-500 focus:outline-none"
                  >
                    <option value="member">メンバー</option>
                    <option value="admin">管理者</option>
                  </select>
                ) : (
                  <Badge variant={m.role === "admin" ? "purple" : "gray"}>{ROLE_LABEL[m.role]}</Badge>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAdmin && invites.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white">
          <h2 className="border-b px-4 py-3 text-sm font-semibold text-gray-900">招待</h2>
          <ul>
            {invites.map((invite) => (
              <li
                key={invite.token}
                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-900">{invite.email}</p>
                </div>
                <Badge variant="gray">{ROLE_LABEL[invite.role]}</Badge>
                <Badge variant={INVITE_STATUS_VARIANT[invite.status]}>
                  {INVITE_STATUS_LABEL[invite.status]}
                </Badge>
                {invite.status === "pending" && (
                  <button
                    onClick={() => handleRevoke(invite.token)}
                    aria-label="招待を取り消す"
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <X size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
