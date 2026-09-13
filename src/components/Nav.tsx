"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { LayoutGrid, ListTodo, Users, LogOut } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { Avatar } from "@/components/ui/Avatar";

const LINKS = [
  { href: "/", label: "ホーム", icon: LayoutGrid },
  { href: "/tasks", label: "タスク", icon: ListTodo },
  { href: "/users", label: "ユーザー管理", icon: Users },
];

export function Nav() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading || !user) return null;

  async function handleLogout() {
    await signOut(getFirebaseAuth());
  }

  return (
    <header className="border-b bg-white">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2.5">
        <Link href="/" className="mr-4 text-sm font-bold text-gray-900">
          タスク管理アプリ
        </Link>
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Avatar name={user.email ?? "?"} />
            <span className="hidden sm:inline">{user.email}</span>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">ログアウト</span>
          </button>
        </div>
      </nav>
    </header>
  );
}
