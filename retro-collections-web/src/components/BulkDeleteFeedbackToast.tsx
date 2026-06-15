interface DeleteProgress {
  active: boolean;
  completed: number;
  total: number;
}

interface BulkDeleteNotice {
  type: 'success' | 'error' | null;
  message: string;
}

interface BulkDeleteFeedbackToastProps {
  deleteProgress: DeleteProgress;
  bulkDeleteNotice: BulkDeleteNotice;
  progressLabel?: string;
  onDismiss: () => void;
}

function BulkDeleteFeedbackToast({
  deleteProgress,
  bulkDeleteNotice,
  progressLabel = 'Deleting items...',
  onDismiss,
}: BulkDeleteFeedbackToastProps) {
  if (!deleteProgress.active && !bulkDeleteNotice.type) {
    return null;
  }

  return (
    <div className="toast toast-top toast-end z-50 w-80 max-w-[calc(100vw-2rem)]">
      {deleteProgress.active && (
        <div className="alert alert-info shadow-lg">
          <div className="w-full space-y-2">
            <div className="text-sm font-semibold">
              {progressLabel} {deleteProgress.completed}/{deleteProgress.total}
            </div>
            <progress
              className="progress progress-primary w-full"
              value={deleteProgress.completed}
              max={deleteProgress.total || 1}
            />
          </div>
        </div>
      )}

      {bulkDeleteNotice.type && !deleteProgress.active && (
        <div
          className={`alert shadow-lg mb-2 ${
            bulkDeleteNotice.type === 'success' ? 'alert-success' : 'alert-error'
          }`}
        >
          <div className="flex w-full items-start justify-between gap-3">
            <span className="text-sm">{bulkDeleteNotice.message}</span>
            <button
              className="btn btn-ghost btn-xs"
              onClick={onDismiss}
              aria-label="Dismiss notification"
            >
              x
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BulkDeleteFeedbackToast;