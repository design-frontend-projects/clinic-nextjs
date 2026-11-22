import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 font-sans text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 rounded-[var(--radius-button)] cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-active active:scale-[0.98] dark:font-bold dark:active:scale-100",
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-active active:scale-[0.98] dark:font-bold dark:active:scale-100",
        cta:
          "rounded-[var(--radius-cta)] bg-primary text-primary-foreground hover:bg-primary-active active:scale-[0.97] font-semibold dark:font-bold dark:active:scale-100",
        "cta-secondary":
          "rounded-[var(--radius-cta)] bg-surface text-foreground border border-hairline shadow-[var(--shadow-soft)] hover:bg-accent active:scale-[0.97] font-medium dark:bg-transparent dark:border-hairline dark:hover:bg-surface-elevated dark:font-bold dark:active:scale-100",
        secondary:
          "bg-secondary text-secondary-foreground border border-hairline shadow-[var(--shadow-soft)] hover:bg-accent",
        tertiary:
          "bg-muted text-foreground hover:bg-accent",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-hairline bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3.5",
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3.5 has-[>svg]:px-3",
        lg: "h-11 px-6 has-[>svg]:px-5 text-base",
        icon: "size-10",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
