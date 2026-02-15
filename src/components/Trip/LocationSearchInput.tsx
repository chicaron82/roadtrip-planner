import { useState, useEffect, useRef } from 'react';
import { Input } from '../UI/Input';
import { searchLocations } from '../../lib/api';
import type { Location } from '../../types';
import { Loader2 } from 'lucide-react';
import { Card } from '../UI/Card';

interface LocationSearchInputProps {
  value: string;
  onSelect: (location: Partial<Location>) => void;
  placeholder?: string;
  className?: string;
}

export function LocationSearchInput({ value, onSelect, placeholder, className }: LocationSearchInputProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Partial<Location>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (text: string) => {
    setQuery(text);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (text.length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    timeoutRef.current = window.setTimeout(async () => {
      const locations = await searchLocations(text);
      setResults(locations);
      setIsOpen(locations.length > 0);
      setIsLoading(false);
    }, 500);
  };

  const handleSelect = (loc: Partial<Location>) => {
    onSelect(loc);
    setQuery(loc.name || '');
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <Input
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={placeholder}
        className="h-10 text-sm"
      />
      
      {isLoading && (
        <div className="absolute right-3 top-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {isOpen && results.length > 0 && (
        <Card className="absolute z-50 top-full mt-1 w-full overflow-hidden shadow-xl rounded-md border-border/50">
          <div className="bg-popover text-popover-foreground">
             {results.map((result, index) => (
                <button
                    key={index}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b border-border/40 last:border-0"
                    onClick={() => handleSelect(result)}
                >
                    <div className="font-medium truncate">{result.name}</div>
                    <div className="text-xs text-muted-foreground truncate opacity-80">{result.address}</div>
                </button>
             ))}
          </div>
        </Card>
      )}
    </div>
  );
}
