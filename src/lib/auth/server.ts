import "server-only";
import type { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export interface AuthorizedRequest {
  uid: string;
  email: string;
  orgId: string;
}

// 各API Routeで繰り返していた「IDトークンを検証し、所属組織を確定する」処理の共通化。
// Custom Claimsではなく、あえてFirestoreのusersドキュメントを正として読みに行く
// (Custom Claimsは更新が非同期でズレることがあるため、サーバー側の重要な判定は
//  常に最新のFirestoreを見る、という設計方針)。
export async function requireOrgMember(request: NextRequest): Promise<AuthorizedRequest | null> {
  const authHeader = request.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return null;

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return null;
  }

  const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
  if (!userDoc.exists) return null;

  const orgId = userDoc.data()?.orgId;
  if (typeof orgId !== "string") return null;

  return { uid: decoded.uid, email: decoded.email ?? "", orgId };
}
