import type { Activity, OvernightStop } from '../../../types';
import { ActivityEditor } from './ActivityEditor';
import { OvernightEditor } from './OvernightEditor';
import { useItineraryEditContext } from './ItineraryEditContext';

interface EditingActivity {
  segmentIndex: number;
  activity?: Activity;
  locationName?: string;
}

interface EditingOvernight {
  dayNumber: number;
  overnight: OvernightStop;
}

interface EditingDayActivity {
  dayNumber: number;
  activityIndex: number;
  activity?: Activity;
}

interface TimelineDialogsProps {
  editingActivity: EditingActivity | null;
  setEditingActivity: (val: EditingActivity | null) => void;

  editingOvernight: EditingOvernight | null;
  setEditingOvernight: (val: EditingOvernight | null) => void;

  editingDayActivity: EditingDayActivity | null;
  setEditingDayActivity: (val: EditingDayActivity | null) => void;
}

export type { EditingDayActivity };

export function TimelineDialogs({
  editingActivity,
  setEditingActivity,
  editingOvernight,
  setEditingOvernight,
  editingDayActivity,
  setEditingDayActivity,
}: TimelineDialogsProps) {
  const {
    onUpdateActivity,
    onUpdateOvernight,
    onAddDayActivity,
    onUpdateDayActivity,
    onRemoveDayActivity,
  } = useItineraryEditContext();

  return (
    <>
      {/* Activity Editor Dialog */}
      {editingActivity && onUpdateActivity && (
        <ActivityEditor
          open={true}
          onOpenChange={(open) => !open && setEditingActivity(null)}
          activity={editingActivity.activity}
          locationName={editingActivity.locationName}
          onSave={(activity) => {
            onUpdateActivity(editingActivity.segmentIndex, activity);
            setEditingActivity(null);
          }}
          onRemove={editingActivity.activity ? () => {
            onUpdateActivity(editingActivity.segmentIndex, undefined);
            setEditingActivity(null);
          } : undefined}
        />
      )}

      {/* Overnight Hotel Editor Dialog */}
      {editingOvernight && onUpdateOvernight && (
        <OvernightEditor
          open={true}
          onOpenChange={(open) => !open && setEditingOvernight(null)}
          overnight={editingOvernight.overnight}
          onSave={(overnight) => {
            onUpdateOvernight(editingOvernight.dayNumber, overnight);
            setEditingOvernight(null);
          }}
        />
      )}

      {/* Standalone Activity Editor Dialog (for Free Days) */}
      {editingDayActivity && onAddDayActivity && onUpdateDayActivity && (
        <ActivityEditor
          open={true}
          onOpenChange={(open) => !open && setEditingDayActivity(null)}
          activity={editingDayActivity.activity}
          locationName={`Day ${editingDayActivity.dayNumber} Activity`}
          isStandalone={true}
          onSave={(activity) => {
            if (editingDayActivity.activityIndex === -1) {
              onAddDayActivity(editingDayActivity.dayNumber, activity);
            } else {
              onUpdateDayActivity(editingDayActivity.dayNumber, editingDayActivity.activityIndex, activity);
            }
            setEditingDayActivity(null);
          }}
          onRemove={editingDayActivity.activity && onRemoveDayActivity ? () => {
            onRemoveDayActivity(editingDayActivity.dayNumber, editingDayActivity.activityIndex);
            setEditingDayActivity(null);
          } : undefined}
        />
      )}
    </>
  );
}
