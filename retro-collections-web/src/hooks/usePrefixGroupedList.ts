import { useMemo, useState } from 'react';

type PrefixGroupedEntry<T> = {
  item: T;
  childLabel: string;
};

type PrefixGroupedSection<T> = {
  groupLabel: string;
  entries: PrefixGroupedEntry<T>[];
};

type UsePrefixGroupedListOptions<T> = {
  items: T[];
  getLabel: (item: T) => string | null | undefined;
  getKey: (item: T) => string;
  separator?: string;
  minGroupSize?: number;
};

export const usePrefixGroupedList = <T>({
  items,
  getLabel,
  getKey,
  separator = ' - ',
  minGroupSize = 2,
}: UsePrefixGroupedListOptions<T>) => {
  const [filterText, setFilterText] = useState('');
  const [isGroupingEnabled, setIsGroupingEnabled] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );

  const filteredItems = useMemo(() => {
    const normalizedFilter = filterText.trim().toLowerCase();

    if (normalizedFilter.length === 0) {
      return items;
    }

    return items.filter((item) =>
      (getLabel(item) || '').toLowerCase().includes(normalizedFilter)
    );
  }, [items, filterText, getLabel]);

  const { groupedEntries, standaloneItems } = useMemo(() => {
    const groupedItemMap = new Map<string, PrefixGroupedEntry<T>[]>();

    filteredItems.forEach((item) => {
      const fullName = (getLabel(item) || '').trim();
      const separatorIndex = fullName.indexOf(separator);

      if (
        separatorIndex <= 0 ||
        separatorIndex + separator.length >= fullName.length
      ) {
        return;
      }

      const prefix = fullName.slice(0, separatorIndex).trim();
      const childLabel = fullName
        .slice(separatorIndex + separator.length)
        .trim();

      if (!prefix || !childLabel) {
        return;
      }

      const groupLabel = `${prefix} -`;
      const existing = groupedItemMap.get(groupLabel) || [];
      existing.push({ item, childLabel });
      groupedItemMap.set(groupLabel, existing);
    });

    const sortedGroupedEntries: PrefixGroupedSection<T>[] = Array.from(
      groupedItemMap.entries()
    )
      .filter(([, entries]) => entries.length >= minGroupSize)
      .sort(([a], [b]) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      )
      .map(([groupLabel, entries]) => ({
        groupLabel,
        entries: entries.sort((a, b) =>
          a.childLabel.localeCompare(b.childLabel, undefined, {
            sensitivity: 'base',
          })
        ),
      }));

    const groupedItemKeys = new Set(
      sortedGroupedEntries.flatMap((group) =>
        group.entries.map((entry) => getKey(entry.item))
      )
    );

    const sortedStandaloneItems = filteredItems
      .filter((item) => !groupedItemKeys.has(getKey(item)))
      .sort((a, b) =>
        (getLabel(a) || '').localeCompare(getLabel(b) || '', undefined, {
          sensitivity: 'base',
        })
      );

    return {
      groupedEntries: sortedGroupedEntries,
      standaloneItems: sortedStandaloneItems,
    };
  }, [filteredItems, getKey, getLabel, separator, minGroupSize]);

  const toggleGroup = (groupLabel: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupLabel]: !prev[groupLabel],
    }));
  };

  return {
    filterText,
    setFilterText,
    isGroupingEnabled,
    setIsGroupingEnabled,
    expandedGroups,
    filteredItems,
    groupedEntries,
    standaloneItems,
    toggleGroup,
  };
};
