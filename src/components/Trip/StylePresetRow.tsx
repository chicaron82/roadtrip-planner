/**
 * StylePresetRow — compact travel style selector for Step 2
 *
 * Always visible above the budget inputs. Shows the active preset,
 * a "Change" picker, and a "Share My Style" action.
 *
 * "Make my MEE time, your MEE time." 💚
 */
import { useState } from 'react';
import { Share2, ChevronDown, Check } from 'lucide-react';
import type { TripMode } from '../../types';
import type { StylePreset } from '../../lib/style-presets';

const MODE_COLOR: Record<string, string> = {
  plan: '#22C55E',
  estimate: '#3B82F6',
  adventure: '#F59E0B',
};

interface StylePresetRowProps {
  activePreset: StylePreset;
  presetOptions: StylePreset[];
  onPresetChange: (preset: StylePreset) => void;
  tripMode: TripMode;
  /** Called when user clicks Share — caller handles clipboard + toast */
  onShare: () => void;
  /** Briefly true after copy to show "Copied!" */
  shareJustCopied?: boolean;
}

export function StylePresetRow({
  activePreset,
  presetOptions,
  onPresetChange,
  tripMode,
  onShare,
  shareJustCopied,
}: StylePresetRowProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const accentColor = MODE_COLOR[tripMode] ?? '#22C55E';

  const handleSelect = (preset: StylePreset) => {
    onPresetChange(preset);
    setPickerOpen(false);
  };

  return (
    <div className="mb-4 relative">
      {/* Row */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2 border"
        style={{
          borderColor: `${accentColor}30`,
          background: `${accentColor}08`,
        }}
      >
        {/* Label */}
        <span
          className="text-[10px] font-mono tracking-wider uppercase shrink-0"
          style={{ color: `${accentColor}99` }}
        >
          Travel Style
        </span>

        {/* Active preset pill + change trigger */}
        <button
          onClick={() => setPickerOpen(v => !v)}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all"
          style={{
            background: `${accentColor}18`,
            color: accentColor,
            border: `1px solid ${accentColor}40`,
          }}
        >
          {activePreset.name}
          <ChevronDown
            className="h-3 w-3 transition-transform"
            style={{ transform: pickerOpen ? 'rotate(180deg)' : 'none' }}
          />
        </button>

        {/* Share */}
        <button
          onClick={onShare}
          className="ml-auto flex items-center gap-1.5 text-[11px] font-medium transition-all shrink-0"
          style={{ color: shareJustCopied ? accentColor : 'rgba(156,163,175,0.9)' }}
          title="Make my MEE time, your MEE time."
        >
          <Share2 className="h-3 w-3" />
          {shareJustCopied ? 'Copied!' : 'Share'}
        </button>
      </div>

      {/* Inline picker */}
      {pickerOpen && (
        <div
          className="absolute left-0 right-0 top-full mt-1 rounded-lg border shadow-lg z-20 overflow-hidden"
          style={{
            background: 'hsl(var(--background))',
            borderColor: `${accentColor}25`,
          }}
        >
          <div
            className="px-3 pt-2 pb-1 text-[10px] font-mono tracking-wider uppercase"
            style={{ color: `${accentColor}80` }}
          >
            Choose a travel style
          </div>
          {presetOptions.map(preset => (
            <button
              key={preset.id}
              onClick={() => handleSelect(preset)}
              className="w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground">{preset.name}</span>
                  {preset.builtin && (
                    <span className="text-[9px] px-1.5 rounded-full bg-muted text-muted-foreground">
                      built-in
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  ${preset.hotelPricePerNight}/night hotel · ${preset.mealPricePerDay}/day meals
                </div>
                {preset.description && (
                  <div className="text-[10px] italic text-muted-foreground/60 mt-0.5 truncate">
                    {preset.description}
                  </div>
                )}
              </div>
              {activePreset.id === preset.id && (
                <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: accentColor }} />
              )}
            </button>
          ))}

          {/* Share invite */}
          <div
            className="px-3 py-2 border-t text-[10px] italic text-center"
            style={{ borderColor: `${accentColor}15`, color: 'rgba(156,163,175,0.6)' }}
          >
            "Make my MEE time, your MEE time."
          </div>
        </div>
      )}
    </div>
  );
}
