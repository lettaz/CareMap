import { cn } from "@/lib/utils";

interface CareMapLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

export function CareMapLogo({
  size = 24,
  className,
  showText = true,
  textClassName,
}: CareMapLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Background circle */}
        <rect width="32" height="32" rx="8" fill="url(#cm-grad)" />

        {/* Node network — three connected dots representing data pipeline nodes */}
        <circle cx="10" cy="11" r="3" fill="white" fillOpacity="0.95" />
        <circle cx="22" cy="11" r="3" fill="white" fillOpacity="0.95" />
        <circle cx="16" cy="22" r="3.5" fill="white" />

        {/* Connecting lines */}
        <path d="M12.5 12.5L14 19.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
        <path d="M19.5 12.5L18 19.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
        <path d="M13 11H19" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />

        {/* Pulse ring on bottom node — represents active harmonization */}
        <circle cx="16" cy="22" r="5.5" stroke="white" strokeWidth="1" strokeOpacity="0.3" />

        <defs>
          <linearGradient id="cm-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366f1" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      {showText && (
        <span className={cn("text-lg font-semibold tracking-tight", textClassName)}>
          CareMap
        </span>
      )}
    </span>
  );
}

export function CareMapMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="url(#cm-mark-grad)" />
      <circle cx="10" cy="11" r="3" fill="white" fillOpacity="0.95" />
      <circle cx="22" cy="11" r="3" fill="white" fillOpacity="0.95" />
      <circle cx="16" cy="22" r="3.5" fill="white" />
      <path d="M12.5 12.5L14 19.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
      <path d="M19.5 12.5L18 19.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
      <path d="M13 11H19" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
      <circle cx="16" cy="22" r="5.5" stroke="white" strokeWidth="1" strokeOpacity="0.3" />
      <defs>
        <linearGradient id="cm-mark-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  );
}
