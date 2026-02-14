"use client";

import { memo } from "react";
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
  onExpand: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
};

function TimelineNodeComponent({ data }: NodeProps & { data: TimelineNodeData }) {
  const { timelineNode, isRoot, isSelected, isExpanding, hasChildren, onExpand, onSelect } = data;
  const color = IMPACT_COLORS[timelineNode.impact];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
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
      className="cursor-pointer"
      style={{ minWidth: 220, maxWidth: 280 }}
    >
      {!isRoot && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-2 !w-2 !border-none !bg-violet-500/50"
        />
      )}

      <div
        className={`rounded-xl border p-4 backdrop-blur-sm transition-all ${
          isSelected
            ? "border-violet-400/60 bg-[rgba(20,10,50,0.95)] shadow-lg shadow-violet-500/20"
            : "border-violet-500/15 bg-[rgba(15,15,40,0.85)] hover:border-violet-500/30"
        }`}
      >
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
        <h3 className="mb-1 text-sm leading-tight font-semibold text-white">
          {timelineNode.title}
        </h3>

        {/* Description (truncated) */}
        <p className="line-clamp-2 text-xs leading-relaxed text-white/40">
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
            className="mt-3 w-full cursor-pointer rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 transition-all hover:border-violet-500/40 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
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

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-none !bg-violet-500/50"
      />
    </motion.div>
  );
}

export default memo(TimelineNodeComponent);
