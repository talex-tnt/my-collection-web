import { useState, useRef, useEffect } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import type { Collection } from '../api/firestore/services/misc/userCollections';

interface BreadcrumbProps {
  tab: 'collections' | 'spare';
  currentCollectionId: string | null;
  collections: Collection[];
  onNavigate: (path: string) => void;
}

function CollectorItemsBreadcrumb({
  tab,
  currentCollectionId,
  collections,
  onNavigate,
}: BreadcrumbProps) {
  const currentCollection = collections.find(
    (c) => c.id === currentCollectionId
  );

  const tabColor = tab === 'collections' ? 'text-primary' : 'text-secondary';
  const tertiaryColor = 'text-accent';

  const [openDropdown, setOpenDropdown] = useState<'tab' | 'collection' | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleDropdown = (menu: 'tab' | 'collection') => {
    setOpenDropdown((prev) => (prev === menu ? null : menu));
  };

  const handleAction = (callback: () => void) => {
    setOpenDropdown(null);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    callback();
  };

  return (
    <div
      ref={containerRef}
      className="bg-base-200 p-4 rounded-xl text-sm breadcrumbs overflow-visible"
    >
      <ul>
        {/* 1st Segment: Category Tab */}
        <li>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onNavigate(`/${tab}`)}
              className={`link font-bold capitalize no-underline hover:underline bg-transparent border-none p-0 min-h-0 h-auto ${tabColor}`}
            >
              {tab === 'collections' ? 'Collections' : 'Spare Collectibles'}
            </button>

            <div
              className={`dropdown dropdown-bottom ${openDropdown === 'tab' ? 'dropdown-open' : ''}`}
            >
              <button
                onClick={() => toggleDropdown('tab')}
                className={`btn btn-ghost btn-xs p-0 min-h-0 h-5 w-5 rounded ${tabColor}`}
              >
                <FiChevronDown className="h-3 w-3" />
              </button>
              <ul className="dropdown-content z-[50] menu p-2 shadow bg-base-100 rounded-box w-44 mt-2">
                <li>
                  <button
                    onClick={() =>
                      handleAction(() => onNavigate('/collections'))
                    }
                    className="font-medium text-primary"
                  >
                    Collections
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleAction(() => onNavigate('/spare'))}
                    className="font-medium text-secondary"
                  >
                    Spare Collectibles
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </li>

        {/* 2nd Segment: Collection Switcher */}
        {tab === 'collections' && currentCollectionId && (
          <li>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  onNavigate(`/collections/${currentCollectionId}`)
                }
                className={`link font-bold max-w-[200px] truncate block no-underline hover:underline bg-transparent border-none p-0 min-h-0 h-auto text-left ${tertiaryColor}`}
              >
                {currentCollection?.name || 'Loading...'}
              </button>

              <div
                className={`dropdown dropdown-bottom ${openDropdown === 'collection' ? 'dropdown-open' : ''}`}
              >
                <button
                  onClick={() => toggleDropdown('collection')}
                  className={`btn btn-ghost btn-xs p-0 min-h-0 h-5 w-5 rounded ${tertiaryColor}`}
                >
                  <FiChevronDown className="h-3 w-3" />
                </button>
                <ul className="dropdown-content z-[50] menu p-2 shadow bg-base-100 rounded-box w-56 max-h-60 overflow-y-auto mt-2">
                  <li className="menu-title text-xs opacity-50">
                    Switch Collection
                  </li>
                  {collections.map((col) => (
                    <li key={col.id}>
                      <button
                        className={
                          col.id === currentCollectionId
                            ? 'bg-accent/10 text-accent font-bold'
                            : ''
                        }
                        onClick={() =>
                          handleAction(() =>
                            onNavigate(`/collections/${col.id}`)
                          )
                        }
                      >
                        {col.name}
                      </button>
                    </li>
                  ))}
                  {collections.length === 0 && (
                    <li className="disabled text-xs p-2 italic">
                      No other collections
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}

export default CollectorItemsBreadcrumb;
