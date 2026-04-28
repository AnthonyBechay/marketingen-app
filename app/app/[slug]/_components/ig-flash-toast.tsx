"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Reads ?ig_connected=1 / ?ig_error=... from the URL and shows a one-shot
 * toast, then strips the params so they don't fire again on refresh.
 */
export function IgFlashToast({
  connected,
  errorMsg,
}: {
  connected: boolean;
  errorMsg: string | null;
}) {
  const router = useRouter();
  useEffect(() => {
    if (connected) {
      toast.success("Instagram connected — scheduled posts will publish automatically.");
    } else if (errorMsg) {
      toast.error(`Instagram connect failed: ${errorMsg}`);
    }
    if (connected || errorMsg) {
      const url = new URL(window.location.href);
      url.searchParams.delete("ig_connected");
      url.searchParams.delete("ig_error");
      router.replace(url.pathname + (url.search ? url.search : ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
