import type { CSSProperties } from "react";
import type { SocialProvider } from "@prisma/client";

export function ProviderGlyph({
  provider,
  className,
  style,
}: {
  provider: SocialProvider;
  className?: string;
  style?: CSSProperties;
}) {
  if (provider === "instagram") {
    return (
      <svg
        className={className}
        style={style}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    );
  }
  if (provider === "linkedin") {
    return (
      <svg
        className={className}
        style={style}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14zM8.34 9.5h-2.6V18h2.6V9.5zM7.04 5.4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM18.26 18v-4.66c0-2.28-1.22-3.34-2.85-3.34a2.46 2.46 0 0 0-2.24 1.23V9.5h-2.6V18h2.6v-4.27c0-1.13.21-2.22 1.62-2.22 1.38 0 1.4 1.29 1.4 2.29V18h2.07z" />
      </svg>
    );
  }
  return null;
}
