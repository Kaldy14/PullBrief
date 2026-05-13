import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs font-medium uppercase tracking-[0.06em] tabular leading-none whitespace-nowrap border",
  {
    variants: {
      variant: {
        neutral:
          "border-border bg-subtle text-subtle-foreground",
        outline:
          "border-border bg-transparent text-muted-foreground",
        accent:
          "border-transparent bg-primary/15 text-primary",
        riskHigh:
          "border-transparent bg-risk-high/20 text-risk-high",
        riskMed:
          "border-transparent bg-risk-med/15 text-risk-med",
        riskLow:
          "border-transparent bg-risk-low/15 text-risk-low",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
