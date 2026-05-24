import { FiAlertTriangle, FiRefreshCw, FiTrash2 } from 'react-icons/fi';

interface ActionConflictModalProps {
  isOpen: boolean;
  type: 'move' | 'duplicate';
  targetPublic: boolean;
  onResolve: (resolution: 'overwrite' | 'merge') => void;
  onCancel: () => void;
}

export default function ActionConflictModal({
  isOpen,
  type,
  targetPublic,
  onResolve,
  onCancel,
}: ActionConflictModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-base-100 rounded-xl shadow-xl p-6 max-w-md w-full border border-base-300">
        {/* Warning Header */}
        <div className="flex items-center gap-3 text-warning mb-3">
          <FiAlertTriangle size={24} />
          <h3 className="font-bold text-lg text-base-content">
            {type === 'move'
              ? 'Confirm Target Destination'
              : 'Duplicate Collectible'}
          </h3>
        </div>

        {/* Context Description */}
        <p className="text-sm text-base-content/70 mb-5">
          You are about to {type} this item to{' '}
          <span className="font-bold text-primary">
            {targetPublic ? 'Public' : 'Private'}
          </span>
          . If a matching entry already exists in that space, how would you like
          to handle it?
        </p>

        {/* Action Strategy Grid */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline btn-warning justify-start gap-2"
            onClick={() => onResolve('merge')}
          >
            <FiRefreshCw size={14} /> Merge current data into existing record
          </button>

          <button
            type="button"
            className="btn btn-sm btn-error justify-start gap-2 text-white"
            onClick={() => onResolve('overwrite')}
          >
            <FiTrash2 size={14} /> Overwrite / Replace target entirely
          </button>

          <button
            type="button"
            className="btn btn-sm btn-ghost mt-2"
            onClick={onCancel}
          >
            Cancel Action
          </button>
        </div>
      </div>
    </div>
  );
}
