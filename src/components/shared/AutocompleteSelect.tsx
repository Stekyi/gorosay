"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Option {
  id: string;
  name: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (id: string, name: string) => void;
  fetchOptions: (q: string) => Promise<Option[]>;
  onCreateNew?: (name: string) => Promise<Option>;
  placeholder?: string;
  className?: string;
}

export function AutocompleteSelect({
  label,
  value,
  onChange,
  fetchOptions,
  onCreateNew,
  placeholder = "Type to search...",
  className,
}: Props) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length >= 2) {
      setLoading(true);
      fetchOptions(query)
        .then(setOptions)
        .finally(() => setLoading(false));
    } else {
      setOptions([]);
    }
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleCreate() {
    if (!onCreateNew || !query.trim()) return;
    setLoading(true);
    const created = await onCreateNew(query.trim());
    setLoading(false);
    onChange(created.id, created.name);
    setSelectedName(created.name);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div
        className="flex items-center w-full px-3 py-2 border border-slate-300 rounded-lg text-sm cursor-pointer bg-white hover:border-slate-400 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent"
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        {open ? (
          <>
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="flex-1 outline-none bg-transparent text-sm placeholder:text-slate-400"
              autoFocus
            />
          </>
        ) : (
          <>
            <span className={cn("flex-1", selectedName || value ? "text-slate-900" : "text-slate-400")}>
              {selectedName || (value ? "Selected" : placeholder)}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-2" />
          </>
        )}
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-slate-400">Searching...</div>
          )}
          {!loading && query.length < 2 && (
            <div className="px-3 py-2 text-xs text-slate-400">Type at least 2 characters</div>
          )}
          {!loading && options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
              onClick={() => {
                onChange(opt.id, opt.name);
                setSelectedName(opt.name);
                setQuery("");
                setOpen(false);
              }}
            >
              {opt.name}
            </button>
          ))}
          {!loading && query.length >= 2 && options.length === 0 && onCreateNew && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
              onClick={handleCreate}
            >
              <Plus className="w-3.5 h-3.5" />
              Add &ldquo;{query}&rdquo;
            </button>
          )}
          {!loading && query.length >= 2 && options.length === 0 && !onCreateNew && (
            <div className="px-3 py-2 text-xs text-slate-400">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}
