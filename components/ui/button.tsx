import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-bold uppercase tracking-wider border-3 border-foreground transition-all disabled:pointer-events-none disabled:opacity-50 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[4px_4px_0_0_hsl(var(--border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--border))]",
        destructive:
          "bg-comic-red text-white shadow-[4px_4px_0_0_hsl(var(--border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--border))]",
        outline:
          "bg-white text-foreground shadow-[4px_4px_0_0_hsl(var(--border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--border))]",
        secondary:
          "bg-muted text-foreground shadow-[4px_4px_0_0_hsl(var(--border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--border))]",
        ghost: "bg-transparent hover:bg-muted",
        link: "text-primary underline-offset-4 hover:underline border-none shadow-none",
        poker: "bg-comic-blue text-white shadow-[4px_4px_0_0_hsl(var(--border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--border))]",
        fold: "bg-comic-red text-white shadow-[4px_4px_0_0_hsl(var(--border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--border))]",
        call: "bg-comic-green text-white shadow-[4px_4px_0_0_hsl(var(--border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--border))]",
        raise: "bg-comic-yellow text-foreground shadow-[4px_4px_0_0_hsl(var(--border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--border))]",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-4",
        lg: "h-12 px-8",
        xl: "h-14 px-10 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
