"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

interface ToolbarAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  shortcut?: string;
}

interface Props {
  actions: ToolbarAction[];
}

export default function ToolbarMenu({ actions }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative sm:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)]"
        aria-label="More actions"
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
            d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-48 rounded-xl border border-[var(--accent-border)] bg-[var(--surface-secondary)] py-1 shadow-xl backdrop-blur-xl">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => {
                action.onClick();
                setIsOpen(false);
              }}
              disabled={action.disabled}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)] disabled:opacity-30"
            >
              <span className="h-4 w-4 shrink-0">{action.icon}</span>
              <span>{action.label}</span>
              {action.shortcut && (
                <span className="ml-auto text-xs text-[var(--text-ghost)]">{action.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
