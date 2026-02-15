import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../UI/Button';
import { Label } from '../UI/Label';
import { isAIEnabled } from '../../lib/ai-config';
import { cn } from '../../lib/utils';

interface NaturalLanguageTripInputProps {
  onGenerate: (description: string) => Promise<void>;
  disabled?: boolean;
}

export function NaturalLanguageTripInput({ onGenerate, disabled }: NaturalLanguageTripInputProps) {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aiEnabled = isAIEnabled();

  const handleGenerate = async () => {
    if (!description.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      await onGenerate(description);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate trip');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleGenerate();
    }
  };

  if (!aiEnabled) {
    return (
      <div className="p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-semibold mb-1">AI Trip Planning</div>
            <p className="text-sm text-muted-foreground mb-3">
              Describe your trip in plain English and let AI plan it for you!
            </p>
            <p className="text-xs text-muted-foreground italic">
              Enable AI in settings to use this feature.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-500" />
        <Label className="font-semibold">Describe Your Trip (AI will plan)</Label>
      </div>

      <div className="relative">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Example: 5-day scenic roadtrip from Vancouver to Banff. Budget-friendly hotels, 2 adults, avoid highways when possible."
          disabled={isGenerating || disabled}
          className={cn(
            "w-full min-h-[100px] px-3 py-2 rounded-lg border resize-none",
            "focus:outline-none focus:ring-2 focus:ring-primary",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "text-sm"
          )}
        />
        {description && (
          <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">
            {description.length} chars • Cmd/Ctrl+Enter to generate
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      <Button
        onClick={handleGenerate}
        disabled={!description.trim() || isGenerating || disabled}
        className="w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating Trip...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Trip with AI
          </>
        )}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-2 text-muted-foreground">OR plan manually below</span>
        </div>
      </div>
    </div>
  );
}
