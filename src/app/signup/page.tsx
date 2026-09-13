"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { getFirebaseAuth } from "@/lib/firebase/client";

function friendlyAuthError(error: FirebaseError): string {
  switch (error.code) {
    case "auth/email-already-in-use":
      return "このメールアドレスは既に登録されています";
    case "auth/weak-password":
      return "パスワードは6文字以上にしてください";
    case "auth/invalid-email":
      return "メールアドレスの形式が正しくありません";
    default:
      return `登録に失敗しました(${error.code})`;
  }
}

export default function SignupPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // 1. Firebase Authに直接アカウントを作る(サーバーを経由しない)。
      //    「アカウントを作ること自体」には許可判断が要らないため。
      const auth = getFirebaseAuth();
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      // 2. IDトークン(偽造できない身分証)を取得し、サーバーに組織作成をお願いする。
      const idToken = await credential.user.getIdToken();
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ orgName, displayName }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string" ? data.error : "組織の作成に失敗しました"
        );
      }

      // 3. サーバー側でCustom Claimsが更新されたので、トークンを強制的に取り直す。
      //    これをしないと、ブラウザ側は古い権限のままになってしまう。
      await credential.user.getIdToken(true);

      router.push("/");
    } catch (err) {
      if (err instanceof FirebaseError) {
        setError(friendlyAuthError(err));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("登録に失敗しました");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold text-gray-900">新規登録</h1>
        <p className="mb-5 text-xs text-gray-500">新しい組織を作成し、その管理者になります。</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-gray-500">組織名</span>
            <input
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-gray-500">お名前</span>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-gray-500">メールアドレス</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-gray-500">パスワード</span>
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {submitting ? "登録中..." : "登録する"}
          </button>
        </form>
      </div>
    </main>
  );
}
