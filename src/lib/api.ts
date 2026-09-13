"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";

// API Routeを呼ぶ際に、毎回IDトークンをAuthorizationヘッダーに付ける処理をまとめたもの。
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const auth = getFirebaseAuth();
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) {
    throw new Error("ログインしてください");
  }

  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.error === "string" ? data.error : `リクエストに失敗しました (${res.status})`
    );
  }

  return res.json();
}
