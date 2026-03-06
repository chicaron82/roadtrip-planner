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
      // eslint-disable-next-line react-hooks/refs -- forwardRef intentionally uses ref during render
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
    const positionMap: Record<string, React.CSSProperties> = {
      top:    { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: sideOffset },
      bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: sideOffset },
      left:   { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: sideOffset },
      right:  { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: sideOffset },
    };

    return (
      <div
        ref={ref}
        role="tooltip"
        className={cn(
          "absolute z-50 hidden peer-hover:block overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 whitespace-nowrap",
          className
        )}
        style={positionMap[side]}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
