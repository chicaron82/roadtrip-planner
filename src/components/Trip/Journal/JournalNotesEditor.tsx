import { useState } from 'react';
import { PenLine } from 'lucide-react';
import { Button } from '../../UI/Button';

interface JournalNotesEditorProps {
  notes?: string;
  onSave: (notes: string) => void;
}

export function JournalNotesEditor({ notes, onSave }: JournalNotesEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(notes ?? '');

  const handleSave = () => {
    onSave(value);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setValue(notes ?? '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Write about your experience here..."
          className="w-full h-24 p-3 text-sm border rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            Save Notes
          </Button>
        </div>
      </div>
    );
  }

  if (notes) {
    return (
      <div
        className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setIsEditing(true)}
      >
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
    >
      <PenLine className="h-3 w-3" />
      Add notes...
    </button>
  );
}
