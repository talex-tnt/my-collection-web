import { useRef, useState } from 'react';
import {
  useCreatePublicUserTagMutation,
  useCreateUserWishMutation,
  useGetPublicUserTagsQuery,
} from '../api/firestore/firestoreApi';
import { useSearchGamesQuery } from '../api/games/rawgApi';
import { useSearchQuery } from '../api/wikipedia/wikipediaApi';
import { useRawgSettings, useWikiSettings } from '../utils/hooks';
import AutocompleteInput from './AutocompleteInput';
import CollapsePanel from './CollapsePanel';
import SelectTags from './SelectTags';
import ImportModal from './ImportModal';
import type { PreparedImportItem } from '../utils/useDriveImport';

interface NewWishProps {
  userId: string;
  isPublicWish: boolean;
  wishlistId?: string;
}

type Suggestion = { name: string };

function NewWish({ userId, isPublicWish, wishlistId }: NewWishProps) {
  const [wikiSettings] = useWikiSettings();
  const [rawgSettings] = useRawgSettings();
  const enableWikiSuggestions = wikiSettings?.enableSuggestions ?? false;
  const enableRawgSuggestions = rawgSettings?.enableSuggestions ?? false;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedWishTags, setSelectedWishTags] = useState<string[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const isGame = selectedWishTags
    .map((tag) => tag.toLowerCase())
    .includes('game');

  const { data: wikiResults, isLoading: isLoadingWikiSuggestions } =
    useSearchQuery(name, {
      skip: name.length < 3 || isGame || !enableWikiSuggestions,
    });
  const { data: rawgResults, isLoading: isLoadingGameSuggestions } =
    useSearchGamesQuery(name, {
      skip: name.length < 3 || !isGame || !enableRawgSuggestions,
    });

  const gameSuggestions: Suggestion[] =
    rawgResults?.results?.map((g) => ({ name: g.name })) || [];
  const wikiSuggestions: Suggestion[] = wikiResults?.results || [];
  const suggestions = isGame ? gameSuggestions : wikiSuggestions;

  const { data: allTags = [] } = useGetPublicUserTagsQuery(
    { userId },
    { skip: !userId }
  );

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const [createWish, { isLoading: isCreatingWish }] =
    useCreateUserWishMutation();
  const [createPublicUserTag] = useCreatePublicUserTagMutation();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;

    const payload: Record<string, unknown> = {
      name: name.trim(),
      userId,
      isPublicWish,
      wishlistId,
    };

    if (description.trim()) payload.description = description.trim();
    if (selectedWishTags.length > 0) payload.tags = selectedWishTags;

    await createWish(payload as Parameters<typeof createWish>[0]).unwrap();

    setName('');
    setDescription('');
    requestAnimationFrame(() => nameInputRef.current?.focus());
  };

  const handleBulkImport = async (
    items: PreparedImportItem[],
    importTag: string
  ) => {
    const cleanedTag = importTag.trim();
    if (!cleanedTag) return;

    await createPublicUserTag({ userId, tag: cleanedTag }).unwrap();

    for (const item of items) {
      const payload: Record<string, unknown> = {
        name: item.name,
        description: item.description,
        userId,
        metadata: item.metadata,
        isPublicWish,
        wishlistId,
      };

      if (selectedWishTags.length > 0) {
        payload.tags = importTag
          ? [...selectedWishTags, importTag]
          : selectedWishTags;
      } else if (importTag) {
        payload.tags = [importTag];
      }

      await createWish(payload as Parameters<typeof createWish>[0]).unwrap();
    }
  };

  return (
    <CollapsePanel
      title="New Wish"
      className="bg-base-100 shadow-xl h-fit border border-base-200"
      headerClassName="text-lg font-bold px-6 pt-5"
      contentClassName="space-y-4 px-6"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <label className="form-control w-full">
            <span className="label-text">Tags</span>
            <div className="flex flex-wrap gap-2 mt-1 items-center">
              <SelectTags
                selectedTags={selectedWishTags}
                userTags={allTags}
                onSelectedTagsChange={setSelectedWishTags}
              />
            </div>
          </label>

          <label className="form-control w-full">
            <span className="label-text mb-1">Name</span>
            <AutocompleteInput
              value={name}
              onChange={setName}
              suggestions={suggestions}
              isLoading={isLoadingWikiSuggestions || isLoadingGameSuggestions}
              placeholder="New wish name"
              getLabel={(g) => g.name}
              getKey={(g) => g.name}
            />
          </label>

          <label className="form-control w-full">
            <span className="label-text mb-1">Description</span>
            <textarea
              className="textarea textarea-bordered min-h-24 w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional wish description"
              disabled={isCreatingWish}
            />
          </label>
        </div>

        <div className="flex gap-2 mt-2 w-full">
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={isCreatingWish || !name.trim()}
          >
            {isCreatingWish ? 'Adding...' : 'Add Wish'}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-secondary"
            onClick={() => setIsImportModalOpen(true)}
          >
            Import Wishes
          </button>
        </div>
      </form>

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onConfirmImport={handleBulkImport}
      />
    </CollapsePanel>
  );
}

export default NewWish;
