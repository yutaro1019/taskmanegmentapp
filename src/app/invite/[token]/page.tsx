"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = { admin: "管理者", member: "メンバー" };

interface InviteInfo {
  orgName: string;
  email: string;
  role: Role;
  status: "pending" | "accepted" | "revoked" | "expired";
}

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "招待の確認に失敗しました");
        setInvite(data);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "招待の確認に失敗しました"));
  }, [token]);

  async function redeem() {
    const auth = getFirebaseAuth();
    const idToken = await auth.currentUser?.getIdToken();
    const res = await fetch(`/api/invites/${token}/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ displayName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "参加処理に失敗しました");

    // Custom Claimsが更新されたので、トークンを取り直す。
    await auth.currentUser?.getIdToken(true);
    router.push("/");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!invite) return;
    setError(null);
    setSubmitting(true);

    try {
      const auth = getFirebaseAuth();
      if (mode === "signup") {
        try {
          await createUserWithEmailAndPassword(auth, invite.email, password);
        } catch (err) {
          if (err instanceof FirebaseError && err.code === "auth/email-already-in-use") {
            // 既にこのメールアドレスでアカウントが存在する場合は、
            // 新規登録ではなくログインに切り替えてもらう。
            setMode("login");
            setError("このメールアドレスは既に登録されています。ログインしてください");
            setSubmitting(false);
            return;
          }
          throw err;
        }
      } else {
        await signInWithEmailAndPassword(auth, invite.email, password);
      }

      await redeem();
    } catch (err) {
      if (err instanceof FirebaseError) {
        setError(`認証に失敗しました(${err.code})`);
      } else {
        setError(err instanceof Error ? err.message : "処理に失敗しました");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-red-600">{loadError}</p>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </main>
    );
  }

  if (invite.status !== "pending") {
    const message =
      invite.status === "accepted"
        ? "この招待は既に使用済みです"
        : invite.status === "revoked"
          ? "この招待は取り消されています"
          : "この招待は有効期限が切れています";
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-red-600">{message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-xl font-bold">組織への招待</h1>
      <p className="text-sm">
        「{invite.orgName}」に <b>{ROLE_LABEL[invite.role]}</b> として招待されています。
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          メールアドレス
          <input value={invite.email} disabled className="rounded border bg-gray-100 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          お名前
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          パスワード
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {submitting ? "処理中..." : mode === "signup" ? "登録して参加する" : "ログインして参加する"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          className="text-sm underline"
        >
          {mode === "signup" ? "既にアカウントをお持ちの場合はこちら" : "新規登録する場合はこちら"}
        </button>
      </form>
    </main>
  );
}
