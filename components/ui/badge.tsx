import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border-2 border-foreground px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide transition-all shadow-[2px_2px_0_0_hsl(var(--border))]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground",
        secondary:
          "bg-muted text-foreground",
        destructive:
          "bg-comic-red text-white",
        outline: 
          "bg-white text-foreground",
        success:
          "bg-comic-green text-white",
        warning:
          "bg-comic-yellow text-foreground",
        x402:
          "bg-comic-blue text-white",
        signed:
          "bg-comic-green text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
