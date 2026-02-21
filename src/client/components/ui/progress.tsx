import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/client/lib/utils"

function Progress({
  className,
  value,
  variant = "default",
  active = false,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  variant?: "default" | "gradient" | "glow"
  active?: boolean
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      data-variant={variant}
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        variant === "glow" && "shadow-[0_0_8px_color-mix(in_oklch,var(--color-glow-1)_20%,transparent)]",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "relative h-full w-full flex-1 overflow-hidden transition-all duration-500 ease-out",
          variant === "default" && "bg-primary",
          variant === "gradient" && "gradient-primary",
          variant === "glow" && "gradient-primary",
          active && "after:absolute after:inset-0 after:animate-[progress-shimmer_1.5s_ease-in-out_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/25 after:to-transparent",
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
