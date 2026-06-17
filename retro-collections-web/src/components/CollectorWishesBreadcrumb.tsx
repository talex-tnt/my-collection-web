import { useState, useRef, useEffect } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import type { Wishlist } from '../api/firestore/services/misc/userWishlists';

interface BreadcrumbProps {
  currentWishlistId: string | null;
  wishlists: Wishlist[];
  onNavigate: (path: string) => void;
}

function CollectorWishesBreadcrumb({
  currentWishlistId,
  wishlists,
  onNavigate,
}: BreadcrumbProps) {
  const currentWishlist = wishlists.find((c) => c.id === currentWishlistId);

  const tabColor = 'text-primary';
  const tertiaryColor = 'text-accent';

  const [openDropdown, setOpenDropdown] = useState<'wishlist' | null>(null);
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

  const toggleDropdown = (menu: 'wishlist') => {
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
      className="p-4 pt-2 px-2 pb-0 mb-2 text-sm breadcrumbs overflow-visible"
    >
      <ul className="flex-wrap row-gap-1">
        <li className="whitespace-normal">
          <div className="flex items-center gap-1 hover:no-underline">
            <span
              className={`font-bold capitalize select-none cursor-default ${tabColor} hover:no-underline`}
            >
              Wishlists
            </span>
          </div>
        </li>

        {currentWishlistId && (
          <li className="whitespace-normal">
            <div className="flex items-center gap-1">
              <button
                onClick={() => onNavigate(`/wishlists/${currentWishlistId}`)}
                className={`link font-bold inline-block no-underline hover:underline bg-transparent border-none p-0 min-h-0 h-auto text-left ${tertiaryColor}`}
                title={currentWishlist?.name}
              >
                {currentWishlist?.name || 'Loading...'}
              </button>

              <div
                className={`dropdown dropdown-end ${openDropdown === 'wishlist' ? 'dropdown-open' : ''}`}
              >
                <button
                  onClick={() => toggleDropdown('wishlist')}
                  className={`btn btn-ghost btn-xs p-0 min-h-0 h-5 w-3 rounded ${tertiaryColor}`}
                >
                  <FiChevronDown className="h-3 w-3" />
                </button>
                <ul className="dropdown-content z-[50] menu p-2 shadow bg-base-100 rounded-box w-56 max-h-60 overflow-y-auto mt-2">
                  <li className="menu-title text-xs opacity-50">
                    Switch Wishlist
                  </li>
                  {wishlists.map((col) => (
                    <li key={col.id}>
                      <button
                        className={
                          col.id === currentWishlistId
                            ? 'bg-accent/10 text-accent font-bold'
                            : ''
                        }
                        onClick={() =>
                          handleAction(() => onNavigate(`/wishlists/${col.id}`))
                        }
                      >
                        {col.name}
                      </button>
                    </li>
                  ))}
                  {wishlists.length === 0 && (
                    <li className="disabled text-xs p-2 italic">
                      No other wishlists
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

export default CollectorWishesBreadcrumb;
