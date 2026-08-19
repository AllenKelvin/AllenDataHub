import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" +
" hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border border-primary-border",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm border-destructive-border",
        outline:
          "border [border-color:var(--button-outline)] shadow-xs active:shadow-none",
        secondary:
          "border bg-secondary text-secondary-foreground border border-secondary-border",
        ghost: "border border-transparent",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  processing?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, processing = false, onClick, children, disabled, ...props }, ref) => {
    const [isProcessing, setIsProcessing] = React.useState(processing)
    const busy = processing || isProcessing
    const Comp = asChild ? Slot : "button"

    React.useEffect(() => {
      setIsProcessing(processing)
    }, [processing])

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!onClick || busy) return

      setIsProcessing(true)
      try {
        const result = (onClick as unknown as (event: React.MouseEvent<HTMLButtonElement>) => unknown)(event)
        if (result && typeof (result as Promise<unknown>).then === "function") {
          void (result as Promise<unknown>).finally(() => setIsProcessing(false))
        } else {
          queueMicrotask(() => setIsProcessing(false))
        }
      } catch (error) {
        setIsProcessing(false)
        throw error
      }
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        onClick={handleClick}
        {...props}
      >
        {busy && !asChild ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
