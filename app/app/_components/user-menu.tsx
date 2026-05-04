"use client";
import { useTransition } from "react";
import Link from "next/link";
import { LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "../../(auth)/actions";

export function UserMenu({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const [pending, startTransition] = useTransition();

  function onSignOut(e: Event) {
    // Prevent Radix from closing the menu before our action fires
    // (it closes anyway after, when the redirect kicks in).
    e.preventDefault();
    startTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="font-mono text-xs">
          {email}
          {isAdmin && <Shield className="w-3 h-3 ml-1.5 text-accent" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isAdmin && (
          <>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/admin/oauth">
                <Shield className="w-4 h-4 mr-2" /> OAuth apps
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={onSignOut} disabled={pending} className="cursor-pointer">
          <LogOut className="w-4 h-4 mr-2" />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
