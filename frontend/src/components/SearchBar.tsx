"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { TimelineNode } from "@/lib/types";
import { collectAllNodes } from "@/lib/tree-utils";

interface SearchBarProps {
  root: TimelineNode | null;
  onSelectNode: (nodeId: string) => void;
  onNavigateToNode?: (nodeId: string) => void;
}

export default function SearchBar({ root, onSelectNode, onNavigateToNode }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<TimelineNode[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      if (!root || !q.trim()) {
        setResults([]);
        return;
      }
      const lower = q.toLowerCase();
      const allNodes = collectAllNodes(root);
      setResults(
        allNodes.filter(
          (n) =>
            n.title.toLowerCase().includes(lower) ||
            n.description.toLowerCase().includes(lower) ||
            String(n.year).includes(q)
        )
      );
    },
    [root]
  );

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        e.stopPropagation();
        setIsOpen(false);
        setQuery("");
        setResults([]);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Search timeline (Ctrl+F)"
        title="Search timeline (Ctrl+F)"
        className="cursor-pointer rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="absolute top-14 right-4 z-50 w-80 rounded-xl border border-[var(--accent-faint)] bg-[var(--surface-secondary)] p-3 shadow-xl backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <svg
          className="h-4 w-4 shrink-0 text-[var(--text-faint)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search events, years..."
          className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-faint)]"
          aria-label="Search timeline events"
        />
        <button
          onClick={() => {
            setIsOpen(false);
            setQuery("");
            setResults([]);
          }}
          className="cursor-pointer text-[var(--text-faint)] hover:text-[var(--text-tertiary)]"
          aria-label="Close search"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {results.length > 0 && (
        <div className="mt-2 max-h-48 space-y-1 overflow-y-auto border-t border-[var(--accent-ghost)] pt-2">
          {results.slice(0, 10).map((node) => (
            <button
              key={node.id}
              onClick={() => {
                onSelectNode(node.id);
                onNavigateToNode?.(node.id);
                setIsOpen(false);
                setQuery("");
                setResults([]);
              }}
              className="w-full cursor-pointer rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--accent-ghost)]"
            >
              <span className="text-xs font-bold text-[var(--violet-text)]">{node.year}</span>
              <span className="ml-2 text-xs text-[var(--text-tertiary)]">{node.title}</span>
            </button>
          ))}
          {results.length > 10 && (
            <p className="px-2 text-xs text-[var(--text-ghost)]">
              +{results.length - 10} more results
            </p>
          )}
        </div>
      )}
      {query && results.length === 0 && (
        <p className="mt-2 border-t border-[var(--accent-ghost)] pt-2 text-xs text-[var(--text-faint)]">
          No events found
        </p>
      )}
    </div>
  );
}
