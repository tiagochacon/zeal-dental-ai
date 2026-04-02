import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  /* DS token: badge — pill shape, Reflect DS badge/pill pattern */
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] duration-200 overflow-hidden",
  {
    variants: {
      variant: {
        /* DS token: badge.default — primary purple */
        default:
          "border-transparent bg-primary/90 text-primary-foreground shadow-[inset_0_-4px_8px_rgba(186,156,255,0.15)] [a&]:hover:bg-primary/75",
        /* DS token: badge.secondary — subtle surface pill */
        secondary:
          "border-border/50 bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/70",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        /* DS token: badge.outline — ghost pill with border */
        outline:
          "border-border/60 text-foreground bg-transparent [a&]:hover:bg-secondary [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
