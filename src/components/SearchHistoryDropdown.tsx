import { useRef, useEffect } from 'react';

interface SearchHistoryDropdownProps {
  history: string[];
  onSelect: (term: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const SearchHistoryDropdown = ({
  history,
  onSelect,
  isOpen,
  setIsOpen,
}: SearchHistoryDropdownProps) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [setIsOpen]);

  if (!isOpen || history.length === 0) return null;

  return (
    <div className="category-dropdown open" ref={dropdownRef}>
      <div className="search-history-header">
        <span>Recent searches</span>
      </div>
      {history.map((term, index) => (
        <div
          key={index}
          className="category-option"
          onClick={() => onSelect(term)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(term);
            }
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"
              fill="currentColor"
            />
          </svg>
          <span>{term}</span>
        </div>
      ))}
    </div>
  );
}; 