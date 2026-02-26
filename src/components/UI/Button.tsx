import * as React from "react"
import { type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"
import { buttonVariants } from "./button-variants"

/**
 * Native Button component — replaces @radix-ui/react-slot usage which has
 * infinite re-render issues with React 19's ref callback handling.
 * asChild merges props onto the single child element instead of rendering a <button>.
 */

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      // Merge button styles onto the child element (Slot-like behavior)
      const child = children as React.ReactElement<Record<string, unknown>>;
      // eslint-disable-next-line react-hooks/refs -- forwardRef intentionally uses ref during render
      return React.cloneElement(child, {
        ...props,
        ref,
        className: cn(buttonVariants({ variant, size, className }), child.props.className as string),
      } as Record<string, unknown>);
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

// buttonVariants is exported from ./button-variants directly — re-exporting it
// here causes a react-refresh/only-export-components violation (mixes component
// and non-component exports in the same file).
export { Button }
