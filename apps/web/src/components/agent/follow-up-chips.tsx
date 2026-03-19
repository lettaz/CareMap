interface FollowUpChipsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
}

export function FollowUpChips({ suggestions, onSelect }: FollowUpChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-1 py-2 scrollbar-none">
      {suggestions.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => onSelect(text)}
          className="shrink-0 rounded-full border border-cm-border-primary bg-white px-3 py-1 text-xs text-cm-text-secondary transition-colors hover:bg-cm-bg-elevated hover:text-cm-text-primary"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
