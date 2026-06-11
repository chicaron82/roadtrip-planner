declare const __BUILD_DATE__: string;
declare const __BUILD_SHA__: string;

/**
 * Subtle always-visible build stamp: build date + short commit SHA, injected at
 * build time via vite `define`. A faint watermark pinned over the map (light
 * tone, non-interactive, low z so panels sit above it) so you can confirm which
 * deploy is live at a glance.
 */
export function BuildStamp() {
  return (
    <div className="pointer-events-none fixed bottom-1 inset-x-0 z-[5] text-center text-[9px] text-white/30 select-none tracking-[0.2em] font-mono">
      {__BUILD_DATE__} · {__BUILD_SHA__}
    </div>
  );
}
