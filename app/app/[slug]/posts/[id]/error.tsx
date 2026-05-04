"use client";
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PostDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to the browser console — production builds strip the message
    // from the React error overlay but the digest is enough to find the
    // server log line, and we still surface the message client-side here.
    console.error("post detail render failed:", error);
  }, [error]);

  return (
    <div className="card-surface p-8 max-w-2xl mx-auto mt-10">
      <div className="flex items-start gap-3 mb-4">
        <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold mb-1">Something went wrong rendering this post</h2>
          <p className="text-sm text-muted-foreground">
            The post is still safe in the database — only the view crashed. Try again,
            or go back to the posts list.
          </p>
        </div>
      </div>
      {error.digest && (
        <div className="text-xs font-mono text-muted-foreground mb-4">
          digest: {error.digest}
        </div>
      )}
      {error.message && (
        <pre className="text-xs font-mono bg-secondary/40 border border-border/60 rounded-md p-3 mb-4 overflow-auto max-h-48">
          {error.message}
        </pre>
      )}
      <div className="flex gap-2">
        <Button onClick={reset}>
          <RefreshCw className="w-4 h-4" /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="..">
            <ChevronLeft className="w-4 h-4" /> Back to posts
          </Link>
        </Button>
      </div>
    </div>
  );
}
