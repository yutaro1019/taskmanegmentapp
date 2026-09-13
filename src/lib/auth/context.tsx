"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { Role } from "@/lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  orgId: string | null;
  role: Role | null;
  displayName: string | null;
  orgName: string | null;
}

const initialState: AuthState = {
  user: null,
  loading: true,
  orgId: null,
  role: null,
  displayName: null,
  orgName: null,
};

const AuthContext = createContext<AuthState>(initialState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    const auth = getFirebaseAuth();
    // onAuthStateChangedだとログイン/ログアウトにしか反応せず、
    // サインアップ後に getIdToken(true) でトークンだけ更新しても検知できなかった。
    // onIdTokenChanged はトークンの中身(Custom Claims)が変わった時にも呼ばれる。
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, loading: false, orgId: null, role: null, displayName: null, orgName: null });
        return;
      }
      const tokenResult = await user.getIdTokenResult();
      const orgId = typeof tokenResult.claims.orgId === "string" ? tokenResult.claims.orgId : null;
      const role = typeof tokenResult.claims.role === "string" ? (tokenResult.claims.role as Role) : null;

      // 表示名・組織名はCustom Claimsに入れていない(トークンを肥大化させたくないため)
      // ので、別途 /api/me から取得する。取れるまでは一旦nullのまま表示する。
      setState({ user, loading: false, orgId, role, displayName: null, orgName: null });

      if (orgId) {
        try {
          const idToken = await user.getIdToken();
          const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${idToken}` } });
          if (res.ok) {
            const data = await res.json();
            setState((prev) => ({
              ...prev,
              displayName: typeof data.displayName === "string" ? data.displayName : null,
              orgName: typeof data.orgName === "string" ? data.orgName : null,
            }));
          }
        } catch {
          // 表示専用の情報なので、取得に失敗してもログイン状態自体は維持する
        }
      }
    });
    return unsubscribe;
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
