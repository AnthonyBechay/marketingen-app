import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "../(auth)/actions";
import { requireUser } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="font-mono text-xs">
              {user.email}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <form action={logoutAction}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full text-left flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
