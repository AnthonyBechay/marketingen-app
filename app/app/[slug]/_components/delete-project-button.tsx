"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteProjectAction } from "../../actions";

export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const matches = confirm.trim() === projectName;

  function onDelete() {
    if (!matches) return;
    startTransition(async () => {
      try {
        const res = await deleteProjectAction(projectId);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(`Deleted "${projectName}"`);
        setOpen(false);
        router.push("/app");
        router.refresh();
      } catch (e) {
        toast.error(`Unexpected error: ${(e as Error).message}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirm(""); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/30">
          <Trash2 className="w-4 h-4" />
          Delete project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Delete this project?
          </DialogTitle>
          <DialogDescription className="pt-2 space-y-2">
            <span className="block">
              This permanently removes the project, its brand, campaign, idea
              queue, and all generated posts (DB cascade).
            </span>
            <span className="block">
              All slide PNGs and uploaded logos under this project&apos;s
              R2 prefix are deleted too.
            </span>
            <span className="block font-semibold text-foreground pt-2">
              This cannot be undone.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-delete">
            Type <span className="font-mono font-semibold text-foreground">{projectName}</span> to confirm:
          </Label>
          <Input
            id="confirm-delete"
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={projectName}
            className="font-mono"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={!matches || pending}
          >
            <Trash2 className="w-4 h-4" />
            {pending ? "Deleting…" : "Delete forever"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
