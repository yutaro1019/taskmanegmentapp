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
}

const initialState: AuthState = {
  user: null,
  loading: true,
  orgId: null,
  role: null,
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
        setState({ user: null, loading: false, orgId: null, role: null });
        return;
      }
      const tokenResult = await user.getIdTokenResult();
      setState({
        user,
        loading: false,
        orgId: typeof tokenResult.claims.orgId === "string" ? tokenResult.claims.orgId : null,
        role: typeof tokenResult.claims.role === "string" ? (tokenResult.claims.role as Role) : null,
      });
    });
    return unsubscribe;
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
