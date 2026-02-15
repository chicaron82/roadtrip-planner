import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../UI/Dialog';
import { AISettings } from './AISettings';
import type { AIConfig } from '../../lib/ai-config';

interface AISettingsModalProps {
  open: boolean;
  onClose: () => void;
  onConfigChange?: (config: AIConfig | null) => void;
}

export function AISettingsModal({ open, onClose, onConfigChange }: AISettingsModalProps) {
  const handleConfigChange = (config: AIConfig | null) => {
    onConfigChange?.(config);
    // Optionally close modal after save
    // onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>AI Trip Assistant</DialogTitle>
          <DialogDescription>
            Configure your AI provider. Keys stored locally - never sent to our servers.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          <AISettings onConfigChange={handleConfigChange} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
