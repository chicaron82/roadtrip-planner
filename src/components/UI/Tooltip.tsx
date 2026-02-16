import * as React from "react"
import { cn } from "../../lib/utils"

/**
 * Native Tooltip components — replaces @radix-ui/react-tooltip which has
 * infinite re-render issues with React 19's ref callback handling.
 * Uses CSS :hover + absolute positioning for a lightweight tooltip.
 */

// Provider is a no-op (Radix needed it for delay context)
function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Root just wraps children in a relative container
function Tooltip({ children }: { children: React.ReactNode }) {
  return <div className="relative inline-flex">{children}</div>;
}

// Trigger renders children as-is via cloneElement when asChild, or wraps in span
interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
  children: React.ReactNode;
}

const TooltipTrigger = React.forwardRef<HTMLElement, TooltipTriggerProps>(
  ({ asChild, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<Record<string, unknown>>;
      return React.cloneElement(child, {
        ...props,
        ref,
        className: cn("peer", child.props.className as string),
      } as Record<string, unknown>);
    }
    return (
      <span ref={ref as React.Ref<HTMLSpanElement>} className="peer" {...props}>
        {children}
      </span>
    );
  }
);
TooltipTrigger.displayName = "TooltipTrigger";

// Content shows on peer hover
interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  sideOffset?: number;
  side?: "top" | "bottom" | "left" | "right";
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, sideOffset = 4, side = "top", children, ...props }, ref) => {
    const positionStyles: Record<string, string> = {
      top: `bottom-full left-1/2 -translate-x-1/2 mb-[${sideOffset}px]`,
      bottom: `top-full left-1/2 -translate-x-1/2 mt-[${sideOffset}px]`,
      left: `right-full top-1/2 -translate-y-1/2 mr-[${sideOffset}px]`,
      right: `left-full top-1/2 -translate-y-1/2 ml-[${sideOffset}px]`,
    };

    return (
      <div
        ref={ref}
        role="tooltip"
        className={cn(
          "absolute z-50 hidden peer-hover:block overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 whitespace-nowrap",
          positionStyles[side],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
