"use client";

import { cn } from "@/lib/utils";

interface KycBadgeProps {
  verified: boolean;
  size?: "sm" | "md";
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
} as const;

const iconSizes = {
  sm: 8,
  md: 10,
} as const;

export function KycBadge({ verified, size = "md" }: KycBadgeProps) {
  if (!verified) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-blue-500 text-white shrink-0",
        sizeClasses[size],
      )}
      title="Identity Verified via KYC"
    >
      <svg
        width={iconSizes[size]}
        height={iconSizes[size]}
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M2.5 6L5 8.5L9.5 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">Identity Verified via KYC</span>
    </span>
  );
}
