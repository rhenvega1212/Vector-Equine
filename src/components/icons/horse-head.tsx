import { cn } from "@/lib/utils";

interface HorseHeadIconProps {
  className?: string;
  size?: number;
}

/** Horseshoe icon for Train tab - realistic U-shape band, open at top */
export function HorseHeadIcon({ className, size = 24 }: HorseHeadIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("shrink-0", className)}
    >
      {/* Horseshoe: thick band, open at top (heels), rounded toe at bottom */}
      <path
        fillRule="evenodd"
        d="M6 5  L5 14  Q12 20 19 14  L18 5  L14 5  L15 12  Q12 16 9 12  L10 5  Z"
      />
    </svg>
  );
}
