// ブラウザ側で使うFirebaseの初期化。このファイルは画面のコードから import されるので、
// ブラウザに送られる前提で書く(だから .env.local の NEXT_PUBLIC_ が付いた値だけを使う)。
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function initClientApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

// 遅延初期化: importされた瞬間ではなく、実際に getFirebaseAuth() / getFirebaseDb() が
// 呼ばれた瞬間(= ブラウザでボタンが押された時など)に初めて初期化する。
// "use client" なページも、初回HTML生成のためにビルド時に一度サーバーで実行されるため、
// トップレベルで即座に初期化すると .env.local が無い状態でビルドが失敗してしまう。
let cachedAuth: Auth | undefined;
let cachedDb: Firestore | undefined;

const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

export function getFirebaseAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(initClientApp());
    if (useEmulator) {
      connectAuthEmulator(cachedAuth, "http://127.0.0.1:9099");
    }
  }
  return cachedAuth;
}

export function getFirebaseDb(): Firestore {
  if (!cachedDb) {
    cachedDb = getFirestore(initClientApp());
    if (useEmulator) {
      connectFirestoreEmulator(cachedDb, "127.0.0.1", 8080);
    }
  }
  return cachedDb;
}
