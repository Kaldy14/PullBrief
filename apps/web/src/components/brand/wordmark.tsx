import * as React from "react";

import { cn } from "@/lib/utils";

type WordmarkProps = React.ComponentProps<"span"> & {
  size?: "sm" | "md" | "lg";
};

function Wordmark({ className, size = "md", ...props }: WordmarkProps) {
  return (
    <span
      data-slot="wordmark"
      className={cn(
        "inline-flex items-baseline gap-[0.1em] font-sans font-semibold text-foreground select-none",
        size === "sm" && "text-sm",
        size === "md" && "text-base",
        size === "lg" && "text-xl",
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="pb-cursor text-primary leading-none">▍</span>
      <span className="tracking-tight">
        Pull<span className="font-normal text-muted-foreground">Brief</span>
      </span>
    </span>
  );
}

export { Wordmark };
