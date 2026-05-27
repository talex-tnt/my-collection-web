import { useRef, useState } from 'react';

import {
  useCreateUserItemMutation,
  useGetPublicUserTagsQuery,
} from '../api/firestore/firestoreApi';
import { useSearchGamesQuery } from '../api/games/rawgApi';
import { useSearchQuery } from '../api/wikipedia/wikipediaApi';
import { useRawgSettings, useWikiSettings } from '../utils/hooks';
import AddTagInput from './AddTagInput'; // <-- Imported your new component
import AutocompleteInput from './AutocompleteInput';
import CollapsePanel from './CollapsePanel';

interface NewItemProps {
  userId: string;
  collectionId?: string;
}

type Suggestion = {
  name: string;
};

function NewItem({
  userId,
  isPublicItem = true,
  collectionId,
}: NewItemProps & { isPublicItem: boolean }) {
  const [wikiSettings] = useWikiSettings();
  const [rawgSettings] = useRawgSettings();
  const enableWikiSuggestions = wikiSettings?.enableSuggestions ?? false;
  const enableRawgSuggestions = rawgSettings?.enableSuggestions ?? false;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagError, setTagError] = useState<string | null>(null);

  const isGame = selectedTags.map((tag) => tag.toLowerCase()).includes('game');

  const { data: wikiResults, isLoading: isLoadingWikiSuggestions } =
    useSearchQuery(name, {
      skip: name.length < 3 || isGame || !enableWikiSuggestions,
    });
  const { data: rawgResults, isLoading: isLoadingGameSuggestions } =
    useSearchGamesQuery(name, {
      skip: name.length < 3 || !isGame || !enableRawgSuggestions,
    });
  const gameSuggestions =
    rawgResults?.results?.map((g) => ({ name: g.name })) ||
    ([] as Suggestion[]);

  const isLoadingSuggestions =
    isLoadingWikiSuggestions || isLoadingGameSuggestions;

  const wikiSuggestions = wikiResults?.results || ([] as Suggestion[]);

  const suggestions = isGame ? gameSuggestions : wikiSuggestions;

  // Fetch all tags for the user
  const { data: allTags = [] } = useGetPublicUserTagsQuery(
    { userId },
    { skip: !userId }
  );

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const [createItem, { isLoading: isCreatingItem }] =
    useCreateUserItemMutation();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) return;

    try {
      const itemData: Record<string, unknown> = {
        name: name.trim(),
        userId,
      };

      if (description.trim()) {
        itemData.description = description.trim();
      }

      if (selectedTags.length > 0) {
        itemData.tags = selectedTags;
      }

      await createItem({
        ...itemData,
        isPublicItem,
        collectionId,
      } as Parameters<typeof createItem>[0]).unwrap();

      setName('');
      setDescription('');
      setSelectedTags([]); // Clear selected tags on successful submit
      setTagError(null);

      // ✅ restore focus AFTER submit
      requestAnimationFrame(() => {
        nameInputRef.current?.focus();
      });
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  return (
    <CollapsePanel
      title="New Collectible"
      className="bg-base-100 shadow-xl h-fit border border-base-200"
      headerClassName="text-lg font-bold px-6 pt-5"
      contentClassName="space-y-4 px-6 pb-5"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {/* TAG SELECTION */}
          <label className="form-control w-full">
            <span className="label-text">Tags</span>
            <div className="flex flex-wrap gap-2 mt-1 items-center">
              {allTags.length === 0 && (
                <span className="text-xs opacity-60">No tags available</span>
              )}
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
                    type="button"
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

              {/* INTEGRATED REUSABLE ADD TAG MENU */}
              <AddTagInput
                userId={userId}
                collectionId={collectionId}
                isPublicItem={isPublicItem}
                assignedTags={selectedTags}
                userTags={allTags}
                onTagsChange={(updatedTags) => setSelectedTags(updatedTags)}
                onError={setTagError}
              />

              {selectedTags.length > 0 && (
                <button
                  type="button"
                  className="btn btn-xs ml-2"
                  onClick={() => setSelectedTags([])}
                >
                  Clear
                </button>
              )}
            </div>
            {tagError && (
              <div className="text-xs text-error mt-1">{tagError}</div>
            )}
          </label>

          {/* NAME INPUT WITH AUTOCOMPLETE */}
          <label className="form-control w-full">
            <span className="label-text mb-1">Name</span>
            <AutocompleteInput
              value={name}
              onChange={setName}
              suggestions={suggestions}
              isLoading={isLoadingSuggestions}
              placeholder={'New collectible name'}
              getLabel={(g) => g.name}
              getKey={(g) => g.name}
            />
          </label>

          {/* DESCRIPTION */}
          <label className="form-control w-full">
            <span className="label-text mb-1">Description</span>
            <textarea
              className="textarea textarea-bordered min-h-24 w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional collectible description"
              disabled={isCreatingItem}
            />
          </label>
        </div>

        {/* SUBMIT BUTTON */}
        <button
          type="submit"
          className="btn btn-primary mt-2"
          disabled={isCreatingItem || !name.trim()}
        >
          {isCreatingItem ? 'Adding...' : 'Add Collectible'}
        </button>
      </form>
    </CollapsePanel>
  );
}

export default NewItem;
