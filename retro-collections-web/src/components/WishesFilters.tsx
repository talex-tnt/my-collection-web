import { useGetPublicUserTagsQuery } from '../api/firestore/firestoreApi';
import CollapsePanel from './CollapsePanel';
import SelectTags from './SelectTags';

interface WishesFiltersProps {
  userId: string;
  wishNameClientFilter: string;
  onWishNameClientFilterChange: (filter: string) => void;
  selectedWishTags: string[];
  setSelectedWishTags: (tags: string[]) => void;
  startWithNameFilter: string;
  onStartWithNameFilterChange: (filter: string) => void;
  nameContainsTokens: string;
  onNameContainsTokensChange: (filter: string) => void;
}

export default function WishesFilters({
  userId,
  wishNameClientFilter,
  onWishNameClientFilterChange,
  selectedWishTags,
  setSelectedWishTags,
  startWithNameFilter,
  onStartWithNameFilterChange,
  nameContainsTokens,
  onNameContainsTokensChange,
}: WishesFiltersProps) {
  const { data: allTags = [] } = useGetPublicUserTagsQuery(
    { userId },
    { skip: !userId }
  );

  return (
    <CollapsePanel
      title="Filter Wishes"
      className="bg-base-100 shadow-md border border-base-200 h-fit"
      headerClassName="text-lg font-bold px2 sm:px-6 pt-5"
      contentClassName="space-y-6 px-2sm:px-6"
    >
      <div>
        <div className="font-semibold text-xs mb-1 opacity-70">Server Filters</div>

        <div className="flex flex-wrap gap-2 mb-2 items-center">
          <label className="text-xs opacity-70 font-medium">Tags</label>
          <SelectTags
            selectedTags={selectedWishTags}
            userTags={allTags}
            onSelectedTagsChange={setSelectedWishTags}
          />
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <label className="text-xs opacity-70 font-medium">Name starts with</label>
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
          <label className="text-xs opacity-70 font-medium">Name contains tokens</label>
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

      <div>
        <div className="font-semibold text-xs mb-1 opacity-70">Client Filters</div>
        <input
          type="text"
          className="input input-bordered input-xs w-full"
          value={wishNameClientFilter}
          onChange={(e) => onWishNameClientFilterChange(e.target.value)}
          placeholder="Filter wishes by name (client)"
        />
      </div>
    </CollapsePanel>
  );
}
