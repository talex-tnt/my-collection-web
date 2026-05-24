import { useGetPublicUserTagsQuery } from '../api/firestore/firestoreApi';

interface ItemsFiltersProps {
  userId: string;
  itemNameClientFilter: string;
  onItemNameClientFilterChange: (filter: string) => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  startWithNameFilter: string;
  onStartWithNameFilterChange: (filter: string) => void;
  nameContainsTokens: string;
  onNameContainsTokensChange: (filter: string) => void;
}

export default function ItemsFilters({
  userId,
  itemNameClientFilter,
  onItemNameClientFilterChange,
  selectedTags,
  setSelectedTags,
  startWithNameFilter,
  onStartWithNameFilterChange,
  nameContainsTokens,
  onNameContainsTokensChange,
}: ItemsFiltersProps) {
  // Fetch all tags for the user
  const { data: allTags = [] } = useGetPublicUserTagsQuery(
    { userId },
    { skip: !userId }
  );

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body space-y-6">
        <h2 className="card-title mb-2">Filter Collectibles</h2>
        {/* --- SERVER FILTERS --- */}
        <div>
          <div className="font-semibold text-xs mb-1 opacity-70">
            Server Filters
          </div>

          <div className="flex flex-wrap gap-2 mb-2 items-center">
            {allTags.map((tag) => {
              const isSelected = selectedTags.includes(tag.id);
              const style =
                isSelected && tag.style
                  ? {
                      backgroundColor: tag.style.backgroundColor || undefined,
                      color: tag.style.foregroundColor || undefined,
                      borderColor: tag.style.foregroundColor || undefined,
                    }
                  : undefined;
              return (
                <button
                  key={tag.id}
                  className={`badge badge-lg cursor-pointer select-none transition-opacity h-5 ${isSelected ? 'opacity-100' : 'badge-outline opacity-50 hover:opacity-80'}`}
                  style={isSelected && style ? style : undefined}
                  onClick={() => {
                    setSelectedTags(
                      isSelected
                        ? selectedTags.filter((t) => t !== tag.id)
                        : [...selectedTags, tag.id]
                    );
                  }}
                >
                  {tag.id}
                </button>
              );
            })}
            {allTags.length > 0 && (
              <button
                className="btn btn-xs ml-2"
                onClick={() => setSelectedTags([])}
                disabled={selectedTags.length === 0}
              >
                Clear
              </button>
            )}
          </div>

          {/* --- SERVER NAME FILTERS --- */}
          <div className="flex flex-col gap-2 mt-4">
            <label className="text-xs opacity-70 font-medium">
              Name starts with
            </label>
            <input
              type="text"
              className="input input-bordered input-xs w-full"
              value={startWithNameFilter}
              onChange={(e) => {
                onNameContainsTokensChange('');
                onStartWithNameFilterChange(e.target.value);
              }}
              placeholder="Start of name (server)"
            />
            <label className="text-xs opacity-70 font-medium">
              Name contains tokens
            </label>
            <input
              type="text"
              className="input input-bordered input-xs w-full"
              value={nameContainsTokens}
              onChange={(e) => {
                onStartWithNameFilterChange('');
                onNameContainsTokensChange(e.target.value);
              }}
              placeholder="Tokens (space separated, server)"
            />
          </div>
        </div>
        {/* --- CLIENT FILTERS --- */}
        <div>
          <div className="font-semibold text-xs mb-1 opacity-70">
            Client Filters
          </div>
          <input
            type="text"
            className="input input-bordered w-full"
            value={itemNameClientFilter}
            onChange={(e) => onItemNameClientFilterChange(e.target.value)}
            placeholder="Filter collectibles by name (client only)..."
          />
        </div>
      </div>
    </div>
  );
}
