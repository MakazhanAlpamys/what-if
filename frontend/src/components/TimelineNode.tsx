"use client";

import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import type { TimelineNode as TNode } from "@/lib/types";
import { IMPACT_COLORS, IMPACT_LABELS } from "@/lib/constants";
import Spinner from "@/components/Spinner";

type TimelineNodeData = {
  label: string;
  timelineNode: TNode;
  isRoot: boolean;
  isSelected: boolean;
  isExpanding: boolean;
  hasChildren: boolean;
  isNew: boolean;
  isParadox: boolean;
  onExpand: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
};

const PARTICLE_COUNT = 10;

function TimelineNodeComponent({ data }: NodeProps & { data: TimelineNodeData }) {
  const {
    timelineNode,
    isRoot,
    isSelected,
    isExpanding,
    hasChildren,
    isNew,
    isParadox,
    onExpand,
    onSelect,
  } = data;
  const color = IMPACT_COLORS[timelineNode.impact];

  // Pre-compute particle styles so they stay stable across renders
  // Uses a deterministic seeded function instead of Math.random() for render purity
  const particles = useMemo(() => {
    if (!isNew) return [];
    const seeded = (seed: number) => {
      const x = Math.sin(seed + 1) * 10000;
      return x - Math.floor(x);
    };
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = i * ((2 * Math.PI) / PARTICLE_COUNT) + (seeded(i) - 0.5) * 0.5;
      const dist = 35 + seeded(i + PARTICLE_COUNT) * 30;
      return {
        tx: `${Math.cos(angle) * dist}px`,
        ty: `${Math.sin(angle) * dist}px`,
        delay: `${i * 0.04}s`,
      };
    });
  }, [isNew]);

  return (
    <motion.div
      initial={isNew ? { opacity: 0, scale: 0.3, y: -30 } : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={
        isNew ? { duration: 0.6, type: "spring", damping: 15, stiffness: 150 } : { duration: 0.4 }
      }
      onClick={() => onSelect(timelineNode.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(timelineNode.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${timelineNode.year}: ${timelineNode.title} — ${IMPACT_LABELS[timelineNode.impact]} impact`}
      className="relative cursor-pointer"
      style={{ minWidth: 220, maxWidth: 280 }}
    >
      {!isRoot && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-2 !w-2 !border-none !bg-[var(--accent-soft)]"
        />
      )}

      <div
        className={`node-glow rounded-xl border p-3 backdrop-blur-sm transition-all sm:p-4 ${
          isExpanding ? "animate-pulse ring-2 ring-violet-500/40" : ""
        } ${isParadox ? "paradox-node" : ""} ${
          isSelected
            ? "border-[var(--node-border-selected)] bg-[var(--node-bg-selected)] shadow-lg shadow-violet-500/20"
            : "border-[var(--node-border)] bg-[var(--node-bg)] hover:border-[var(--node-border-hover)]"
        }`}
        style={{
          boxShadow: isSelected
            ? undefined
            : `0 0 ${isParadox ? "12px" : "8px"} ${isParadox ? "rgba(239, 68, 68, 0.15)" : `${color}15`}`,
        }}
      >
        {/* Paradox warning icon */}
        {isParadox && (
          <div
            className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg"
            title="Paradox detected"
          >
            !
          </div>
        )}

        {/* Year badge */}
        <div className="mb-2 flex items-center justify-between">
          <span
            className="rounded-md px-2 py-0.5 text-xs font-bold"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {timelineNode.year}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {IMPACT_LABELS[timelineNode.impact]}
          </span>
        </div>

        {/* Title */}
        <h3 className="mb-1 text-sm leading-tight font-semibold text-[var(--text-primary)]">
          {timelineNode.title}
        </h3>

        {/* Description (truncated) */}
        <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">
          {timelineNode.description}
        </p>

        {/* Expand button */}
        {!hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExpand(timelineNode.id);
            }}
            disabled={isExpanding}
            className="mt-3 w-full cursor-pointer rounded-lg border border-[var(--accent-faint)] bg-[var(--accent-ghost)] px-3 py-2 text-xs font-medium text-[var(--violet-text)] transition-all hover:border-[var(--accent-muted)] hover:bg-[var(--accent-faint)] disabled:cursor-not-allowed disabled:opacity-40 sm:py-1.5"
          >
            {isExpanding ? (
              <span className="flex items-center justify-center gap-1.5">
                <Spinner className="h-3 w-3" />
                Exploring...
              </span>
            ) : (
              "Explore deeper"
            )}
          </button>
        )}
      </div>

      {/* Particle burst for new nodes */}
      {isNew && (
        <div className="pointer-events-none absolute inset-0 overflow-visible">
          {particles.map((p, i) => (
            <div
              key={i}
              className="node-particle"
              style={
                {
                  left: "50%",
                  top: "50%",
                  backgroundColor: color,
                  boxShadow: `0 0 6px ${color}`,
                  "--tx": p.tx,
                  "--ty": p.ty,
                  "--delay": p.delay,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-none !bg-[var(--accent-soft)]"
      />
    </motion.div>
  );
}

export default memo(TimelineNodeComponent);
