"use client";
import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "../../(auth)/actions";

export function UserMenu({ email }: { email: string }) {
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
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onSignOut} disabled={pending} className="cursor-pointer">
          <LogOut className="w-4 h-4 mr-2" />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
