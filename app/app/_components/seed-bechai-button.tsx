"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { seedBechaiAction } from "../actions";

export function SeedBechaiButton() {
  const [pending, startTransition] = useTransition();
  function onClick() {
    startTransition(async () => {
      const res = await seedBechaiAction();
      // Success path redirects, so any return is an error.
      if (res?.error) toast.error(res.error);
    });
  }
  return (
    <Button variant="outline" onClick={onClick} disabled={pending}>
      <Sparkles className="w-4 h-4" />
      {pending ? "Seeding…" : "Seed bechai.ai"}
    </Button>
  );
}
