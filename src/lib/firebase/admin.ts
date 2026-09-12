// サーバー側(API Routeなど)専用のFirebase初期化。
// "server-only" を import しておくと、もしこのファイルをうっかりクライアント側の
// コード(画面のコンポーネントなど)から import してしまった場合、ビルド時にエラーで
// 気づける(秘密鍵がブラウザに漏れる事故を防ぐガード)。
import "server-only";
import { cert, getApps, getApp, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function initAdminApp(): App {
  if (getApps().length) return getApp();

  // FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST が設定されている場合は
  // ローカルのエミュレータに接続する。エミュレータは認証情報を検証しないので、
  // 本物の秘密鍵(サービスアカウント)は不要。projectIdだけで初期化できる。
  const usingEmulator =
    !!process.env.FIRESTORE_EMULATOR_HOST || !!process.env.FIREBASE_AUTH_EMULATOR_HOST;

  if (usingEmulator) {
    return initializeApp({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID ?? "demo-taskapp",
    });
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin SDKの環境変数が設定されていません(.env.localを確認してください)"
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

// 遅延初期化(lazy initialization): モジュールが import された瞬間ではなく、
// 実際に getAdminAuth() / getAdminDb() が呼ばれた瞬間に初めて初期化する。
// こうしておかないと、.env.local が未設定の状態で `next build` がこのファイルを
// 読み込もうとしただけでエラーになってしまう(実際に遭遇したビルドエラー)。
let cachedAuth: Auth | undefined;
let cachedDb: Firestore | undefined;

export function getAdminAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(initAdminApp());
  }
  return cachedAuth;
}

export function getAdminDb(): Firestore {
  if (!cachedDb) {
    cachedDb = getFirestore(initAdminApp());
  }
  return cachedDb;
}
