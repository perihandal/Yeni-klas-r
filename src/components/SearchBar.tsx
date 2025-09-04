import React from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, onSearch }) => (
  <div className="search-bar">
    <input
      type="text"
      placeholder="Konum ara (nokta ismi veya tipi)"
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyPress={e => {
        if (e.key === 'Enter') {
          onSearch();
        }
      }}
    />
    <button onClick={onSearch}>🔍 Ara</button>
  </div>
);

export default SearchBar;
