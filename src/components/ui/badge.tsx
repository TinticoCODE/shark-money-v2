import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "warning" | "danger" | "success";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "default" && "bg-primary/10 text-primary",
        variant === "secondary" && "bg-muted text-muted-foreground",
        variant === "warning" && "bg-amber-100 text-amber-800",
        variant === "danger" && "bg-red-100 text-red-700",
        variant === "success" && "bg-emerald-100 text-emerald-800",
        className,
      )}
      {...props}
    />
  );
}
