import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { UserMenu } from "./_components/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/app" className="font-display text-lg font-bold tracking-tight">
            <span>marketing</span>
            <span className="accent-text">en</span>
          </Link>
        </div>
        <UserMenu email={user.email} isAdmin={isAdmin(user.email)} />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
