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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI Trip Assistant Settings</DialogTitle>
          <DialogDescription>
            Configure your AI provider to unlock intelligent trip planning features.
            Your API key is stored locally and never sent to our servers.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <AISettings onConfigChange={handleConfigChange} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
