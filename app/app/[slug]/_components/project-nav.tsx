"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/app/${slug}`, label: "Overview" },
    { href: `/app/${slug}/calendar`, label: "Calendar" },
    { href: `/app/${slug}/posts`, label: "Posts" },
    { href: `/app/${slug}/generate`, label: "Generate" },
    { href: `/app/${slug}/campaign`, label: "Campaign" },
    { href: `/app/${slug}/brand`, label: "Brand" },
    { href: `/app/${slug}/connections`, label: "Connections" },
  ];
  return (
    <nav className="flex gap-1 mt-6 -mb-px overflow-x-auto">
      {tabs.map((tab) => {
        // Overview is the only exact-match tab; the others activate on prefix
        // so e.g. /posts/[id] highlights "Posts".
        const active =
          tab.href === `/app/${slug}`
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              active
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
