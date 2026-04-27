"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { seedBechaiAction } from "../actions";

export function SeedBechaiButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onClick() {
    startTransition(async () => {
      try {
        const res = await seedBechaiAction();
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(
          res.created
            ? "bechai.ai project seeded with brand, campaign, and 20-post queue"
            : "bechai.ai project already exists — opening it",
        );
        router.push(`/app/${res.slug}`);
        router.refresh();
      } catch (e) {
        toast.error(`Unexpected error: ${(e as Error).message}`);
      }
    });
  }

  return (
    <Button variant="outline" onClick={onClick} disabled={pending}>
      <Sparkles className="w-4 h-4" />
      {pending ? "Seeding…" : "Seed bechai.ai"}
    </Button>
  );
}
