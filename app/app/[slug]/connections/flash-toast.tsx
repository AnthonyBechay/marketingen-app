"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function ConnectionsFlashToast({
  connected,
  errorMsg,
}: {
  connected: string | null;
  errorMsg: string | null;
}) {
  const router = useRouter();
  useEffect(() => {
    if (connected) {
      const label = connected.charAt(0).toUpperCase() + connected.slice(1);
      toast.success(`${label} connected`);
      router.replace(window.location.pathname);
    } else if (errorMsg) {
      toast.error(decodeURIComponent(errorMsg));
      router.replace(window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, errorMsg]);
  return null;
}
