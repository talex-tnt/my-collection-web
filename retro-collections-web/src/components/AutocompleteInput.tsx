import { useEffect, useState } from 'react';

type AutocompleteInputProps<T> = {
  value: string;
  onChange: (value: string) => void;

  suggestions: T[];

  getLabel: (item: T) => string;
  getKey: (item: T) => string | number;

  onSelect?: (item: T) => void;

  isLoading?: boolean;
  placeholder?: string;
};

function AutocompleteInput<T>({
  value,
  onChange,
  suggestions,
  getLabel,
  getKey,
  onSelect,
  isLoading,
  placeholder,
}: AutocompleteInputProps<T>) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<number>(-1);

  // reset highlight when suggestions change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlighted(-1);
  }, [suggestions]);

  const selectItem = (item: T) => {
    const label = getLabel(item);
    onChange(label);
    onSelect?.(item);
    setOpen(false);
    setHighlighted(-1);
  };

  return (
    <div className="relative w-full">
      {/* INPUT */}
      <input
        type="text"
        className="input input-bordered w-full"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // Check if a suggestion is actively highlighted
            if (open && highlighted >= 0 && highlighted < suggestions.length) {
              e.preventDefault(); // Stop form submission *only* to select the suggestion
              selectItem(suggestions[highlighted]);
            } else {
              // No suggestion is selected -> Close dropdown and let the event bubble up to submit the form!
              setOpen(false);
              setHighlighted(-1);
            }
            return;
          }

          if (!open) return;

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted((prev) =>
              prev < suggestions.length - 1 ? prev + 1 : 0
            );
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted((prev) =>
              prev > 0 ? prev - 1 : suggestions.length - 1
            );
          }

          if (e.key === 'Escape') {
            setOpen(false);
            setHighlighted(-1);
          }
        }}
      />

      {/* DROPDOWN */}
      {open && value.length > 1 && (
        <div className="absolute z-50 w-full mt-1 bg-base-100 border rounded shadow-lg max-h-60 overflow-auto">
          {isLoading && (
            <div className="px-3 py-2 text-xs opacity-60">Loading...</div>
          )}

          {!isLoading &&
            suggestions.map((item, index) => {
              const isActive = index === highlighted;

              return (
                <div
                  key={getKey(item)}
                  className={`px-3 py-2 cursor-pointer ${
                    isActive ? 'bg-base-200' : 'hover:bg-base-200'
                  }`}
                  onMouseEnter={() => setHighlighted(index)}
                  onMouseDown={() => selectItem(item)}
                >
                  {getLabel(item)}
                </div>
              );
            })}

          {!isLoading && suggestions.length === 0 && (
            <div className="px-3 py-2 text-xs opacity-60">No results</div>
          )}
        </div>
      )}
    </div>
  );
}

export default AutocompleteInput;
