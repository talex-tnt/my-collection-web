import { FiSettings, FiRefreshCw, FiCopy } from 'react-icons/fi';

interface ItemActionsDropdownProps {
  isPublicItem: boolean;
  onTriggerAction: (type: 'move' | 'duplicate', targetPublic: boolean) => void;
}

export default function ItemActionsDropdown({
  isPublicItem,
  onTriggerAction,
}: ItemActionsDropdownProps) {
  return (
    <div className="dropdown dropdown-end dropdown-bottom">
      {/* Interactive Trigger Button */}
      <div
        tabIndex={0}
        role="button"
        className="btn btn-sm btn-ghost tooltip"
        data-tip="Advanced management"
      >
        <FiSettings
          size={18}
          className="transition-transform duration-300 hover:rotate-45"
        />
      </div>

      {/* Floating Menu Portal */}
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-56 z-40 border border-base-300 text-base-content"
      >
        {/* Section 1: State Shifts */}
        <li className="menu-title text-[10px] uppercase tracking-wider opacity-50">
          Visibility Shift
        </li>
        <li>
          <button
            type="button"
            className="flex items-center gap-2 py-2"
            onClick={() => onTriggerAction('move', !isPublicItem)}
          >
            <FiRefreshCw size={14} className="text-primary" />
            <span>Move to {isPublicItem ? 'Private' : 'Public'}</span>
          </button>
        </li>

        <div className="divider my-1 opacity-40"></div>

        {/* Section 2: Pure Duplication */}
        <li className="menu-title text-[10px] uppercase tracking-wider opacity-50">
          Cloning Engines
        </li>
        <li>
          <button
            type="button"
            className="flex items-center gap-2 py-2"
            onClick={() => onTriggerAction('duplicate', true)}
          >
            <FiCopy size={14} className="text-success" />
            <span>Duplicate as Public</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className="flex items-center gap-2 py-2"
            onClick={() => onTriggerAction('duplicate', false)}
          >
            <FiCopy size={14} className="text-warning" />
            <span>Duplicate as Private</span>
          </button>
        </li>
      </ul>
    </div>
  );
}
