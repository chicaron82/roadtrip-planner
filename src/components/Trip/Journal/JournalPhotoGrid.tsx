import { X } from 'lucide-react';
import type { JournalPhoto } from '../../../types';

interface JournalPhotoGridProps {
  photos: JournalPhoto[];
  onRemovePhoto: (photoId: string) => void;
}

export function JournalPhotoGrid({ photos, onRemovePhoto }: JournalPhotoGridProps) {
  if (photos.length === 0) return null;

  return (
    <div className="space-y-2">
      <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Photos ({photos.length})
      </h5>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group">
            <img
              src={photo.dataUrl}
              alt={photo.caption || 'Trip photo'}
              className="w-full h-20 object-cover rounded-lg"
            />
            <button
              onClick={() => onRemovePhoto(photo.id)}
              className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
            {photo.caption && (
              <p className="text-xs text-gray-600 mt-1 truncate">{photo.caption}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
