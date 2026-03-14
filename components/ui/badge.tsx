import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "error" | "neutral" | "paused";
  className?: string;
}

export function Badge({ children, variant = "neutral", className }: BadgeProps) {
  const variantStyles = {
    success: "text-[#22C55E]",
    warning: "text-[#F59E0B]",
    error: "text-[#EF4444]",
    neutral: "text-[#7A7A7A]",
    paused: "text-[#7A7A7A]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-[10px] py-1 text-xs font-medium bg-[#E8E8E8]",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
