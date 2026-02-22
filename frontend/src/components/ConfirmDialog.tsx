"use client";

import { motion, AnimatePresence } from "framer-motion";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[var(--backdrop)] backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-1/2 left-1/2 z-[61] w-[90%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--accent-border)] bg-[var(--surface-secondary)] p-6 shadow-2xl backdrop-blur-xl"
          >
            <h3 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
            <p className="mb-6 text-sm text-[var(--text-muted)]">{message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={onCancel}
                className="cursor-pointer rounded-lg border border-[var(--accent-border)] px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)]"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                  variant === "danger"
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-violet-600 hover:bg-violet-500"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
