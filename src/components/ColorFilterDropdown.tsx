import { useRef, useEffect } from 'react';

interface Color {
  id: string;
  name: string;
  value: string;
}

interface ColorFilterDropdownProps {
  colors: Color[];
  selectedColor: string;
  onSelect: (colorId: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const ColorFilterDropdown = ({
  colors,
  selectedColor,
  onSelect,
  isOpen,
  setIsOpen,
}: ColorFilterDropdownProps) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  const selectedColorData = colors.find(c => c.id === selectedColor) || colors[0];

  return (
    <div className="color-filter-container">
      <button
        ref={buttonRef}
        className="color-filter-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        type="button"
      >
        <div className="color-filter-button-content">
          <div
            className={`color-filter-swatch ${selectedColorData.id === 'all' ? 'multicolor' : ''}`}
            style={selectedColorData.id !== 'all' ? { backgroundColor: selectedColorData.value } : undefined}
          />
          <span className="color-filter-label">{selectedColorData.name}</span>
          <svg
            className={`color-filter-chevron ${isOpen ? 'open' : ''}`}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7 10l5 5 5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>
      {isOpen && (
        <div className="category-dropdown open color-filter-dropdown" ref={dropdownRef}>
          {colors.map((color) => (
            <div
              key={color.id}
              className={`category-option ${selectedColor === color.id ? 'selected' : ''}`}
              onClick={() => {
                onSelect(color.id);
                setIsOpen(false);
              }}
              role="option"
              aria-selected={selectedColor === color.id}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(color.id);
                  setIsOpen(false);
                }
              }}
            >
              <div
                className={`color-filter-option-swatch ${color.id === 'all' ? 'multicolor' : ''}`}
                style={color.id !== 'all' ? { backgroundColor: color.value } : undefined}
              />
              <span>{color.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

