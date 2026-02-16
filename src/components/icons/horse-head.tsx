import { cn } from "@/lib/utils";

interface HorseHeadIconProps {
  className?: string;
  size?: number;
}

export function HorseHeadIcon({ className, size = 24 }: HorseHeadIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Horse head side profile */}
      <path d="M4 18V9a4 4 0 0 1 4-4 3 3 0 0 1 2.5 1.2 4 4 0 0 1 .5 2.8V18" />
      <path d="M11 6c1 0 2 .5 2.5 1.5L15 11l2-.5" />
      <path d="M17 10c.5 1 .5 2.5 0 4v4" />
      <path d="M4 14h3" />
    </svg>
  );
}
