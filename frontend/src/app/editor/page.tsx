"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";

import TimelineNodeComponent from "@/components/TimelineNode";
import ThemeToggle from "@/components/ThemeToggle";
import SoundToggle from "@/components/SoundToggle";
import Spinner from "@/components/Spinner";
import ConfirmDialog from "@/components/ConfirmDialog";
import { buildTreeLayout } from "@/lib/tree-layout";
import { findNodeById, addBranchesToNode, collectAllNodes } from "@/lib/tree-utils";
import { soundManager } from "@/lib/sounds";
import { IMPACT_COLORS } from "@/lib/constants";
import { saveTimeline, exportTimelineJSON } from "@/lib/storage";
import { generateShareURL, copyToClipboard } from "@/lib/share";
import type { TimelineNode, ScenarioResponse, EditorCritiqueResponse } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `editor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const nodeTypes = { timelineNode: TimelineNodeComponent };

type Impact = TimelineNode["impact"];
const IMPACTS: Impact[] = ["critical", "high", "medium", "low"];

// ── Node Form ────────────────────────────────────────────────────────────────

interface NodeFormData {
  year: string;
  title: string;
  description: string;
  impact: Impact;
}

const emptyForm: NodeFormData = { year: "", title: "", description: "", impact: "medium" };

function NodeFormPanel({
  initial,
  isEditing,
  onSubmit,
  onCancel,
}: {
  initial: NodeFormData;
  isEditing: boolean;
  onSubmit: (data: NodeFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<NodeFormData>(initial);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const valid = form.title.trim() && form.description.trim() && form.year;

  return (
    <motion.div
      initial={{ opacity: 0, x: 320 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 320 }}
      transition={{ type: "spring", damping: 25, stiffness: 220 }}
      className="fixed top-14 right-0 z-50 flex h-[calc(100vh-3.5rem)] w-80 flex-col border-l border-pink-500/20 bg-[var(--surface-secondary)] shadow-2xl backdrop-blur-xl sm:w-96"
    >
      <div className="flex items-center justify-between border-b border-[var(--accent-ghost)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          {isEditing ? "Edit Node" : "Add Branch"}
        </h3>
        <button
          onClick={onCancel}
          className="cursor-pointer rounded-lg p-1 text-[var(--text-faint)] transition-colors hover:text-[var(--text-secondary)]"
          aria-label="Close form"
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

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Year */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-tertiary)]">Year</label>
          <input
            type="number"
            value={form.year}
            onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
            placeholder="e.g. 1776"
            className="w-full rounded-lg border border-[var(--accent-border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-invisible)] transition-colors outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/30"
          />
        </div>

        {/* Title */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-tertiary)]">
            Title
          </label>
          <input
            ref={titleRef}
            type="text"
            maxLength={100}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Event title"
            className="w-full rounded-lg border border-[var(--accent-border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-invisible)] transition-colors outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/30"
          />
          <div className="mt-1 text-right text-[10px] text-[var(--text-invisible)]">
            {form.title.length}/100
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-tertiary)]">
            Description
          </label>
          <textarea
            maxLength={500}
            rows={4}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Describe the event and its consequences..."
            className="w-full resize-none rounded-lg border border-[var(--accent-border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-invisible)] transition-colors outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/30"
          />
          <div className="mt-1 text-right text-[10px] text-[var(--text-invisible)]">
            {form.description.length}/500
          </div>
        </div>

        {/* Impact */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-tertiary)]">
            Impact Level
          </label>
          <div className="grid grid-cols-4 gap-2">
            {IMPACTS.map((level) => (
              <button
                key={level}
                onClick={() => setForm((f) => ({ ...f, impact: level }))}
                className={`cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-medium capitalize transition-all ${
                  form.impact === level
                    ? "border-transparent shadow-md"
                    : "border-[var(--accent-border)] text-[var(--text-muted)] hover:border-[var(--accent-faint)]"
                }`}
                style={
                  form.impact === level
                    ? { backgroundColor: `${IMPACT_COLORS[level]}20`, color: IMPACT_COLORS[level] }
                    : undefined
                }
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--accent-ghost)] p-4">
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 cursor-pointer rounded-lg border border-[var(--accent-border)] px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={() => valid && onSubmit(form)}
            disabled={!valid}
            className="flex-1 cursor-pointer rounded-lg bg-gradient-to-r from-pink-500 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isEditing ? "Update" : "Add"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Critique Panel ───────────────────────────────────────────────────────────

function CritiquePanel({
  critique,
  onClose,
  onNavigateToNode,
}: {
  critique: EditorCritiqueResponse;
  onClose: () => void;
  onNavigateToNode: (nodeId: string) => void;
}) {
  const scoreColor =
    critique.score >= 80
      ? "text-green-400"
      : critique.score >= 60
        ? "text-yellow-400"
        : critique.score >= 40
          ? "text-orange-400"
          : "text-red-400";

  const scoreBarColor =
    critique.score >= 80
      ? "bg-green-500"
      : critique.score >= 60
        ? "bg-yellow-500"
        : critique.score >= 40
          ? "bg-orange-500"
          : "bg-red-500";

  const issueTypeColors: Record<string, string> = {
    implausible: "bg-red-500/15 text-red-400",
    anachronism: "bg-orange-500/15 text-orange-400",
    "missing-cause": "bg-yellow-500/15 text-yellow-400",
    contradiction: "bg-purple-500/15 text-purple-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 200 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 200 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed right-4 bottom-4 left-4 z-50 max-h-[50vh] overflow-y-auto rounded-2xl border border-pink-500/20 bg-[var(--surface-secondary)] p-5 shadow-2xl backdrop-blur-xl sm:left-auto sm:w-[480px]"
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <svg
              className="h-4 w-4 text-pink-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            AI Critique
          </h3>
          <p className="mt-1 text-xs text-[var(--text-faint)]">{critique.overall}</p>
        </div>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg p-1 text-[var(--text-faint)] transition-colors hover:text-[var(--text-secondary)]"
          aria-label="Close critique panel"
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

      {/* Score */}
      <div className="mb-4 rounded-xl border border-[var(--accent-ghost)] bg-[var(--accent-ghost)] p-3">
        <div className="mb-2 flex items-end justify-between">
          <span className="text-xs font-medium text-[var(--text-tertiary)]">
            Plausibility Score
          </span>
          <span className={`text-2xl font-bold ${scoreColor}`}>{critique.score}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-primary)]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${critique.score}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full ${scoreBarColor}`}
          />
        </div>
      </div>

      {/* Issues */}
      {critique.issues.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-xs font-semibold tracking-wider text-[var(--text-faint)] uppercase">
            Issues ({critique.issues.length})
          </h4>
          <div className="space-y-2">
            {critique.issues.map((issue, i) => (
              <button
                key={i}
                onClick={() => onNavigateToNode(issue.nodeId)}
                className="w-full cursor-pointer rounded-lg border border-[var(--accent-ghost)] p-3 text-left transition-colors hover:border-pink-500/30 hover:bg-pink-500/5"
              >
                <span
                  className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${issueTypeColors[issue.type] ?? "bg-gray-500/15 text-gray-400"}`}
                >
                  {issue.type.replace("-", " ")}
                </span>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-tertiary)]">
                  {issue.message}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {critique.suggestions.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold tracking-wider text-[var(--text-faint)] uppercase">
            Suggestions
          </h4>
          <ul className="space-y-1.5">
            {critique.suggestions.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs leading-relaxed text-[var(--text-tertiary)]"
              >
                <span className="mt-0.5 text-pink-400">&#8226;</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}

// ── Root Creation Form ───────────────────────────────────────────────────────

function RootCreationForm({ onSubmit }: { onSubmit: (data: NodeFormData) => void }) {
  const [form, setForm] = useState<NodeFormData>(emptyForm);
  const valid = form.title.trim() && form.description.trim() && form.year;

  return (
    <div className="relative z-10 flex h-screen w-screen items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-4 w-full max-w-md rounded-2xl border border-pink-500/20 bg-[var(--surface-secondary)] p-6 shadow-2xl backdrop-blur-xl sm:p-8"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/20 to-fuchsia-600/20">
            <svg
              className="h-6 w-6 text-pink-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Create Your Root Event
          </h2>
          <p className="mt-1 text-xs text-[var(--text-faint)]">
            Start your alternate timeline with a pivotal moment in history
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-tertiary)]">
              Year
            </label>
            <input
              type="number"
              value={form.year}
              onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
              placeholder="e.g. 1776"
              className="w-full rounded-lg border border-[var(--accent-border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-invisible)] transition-colors outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/30"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-tertiary)]">
              Title
            </label>
            <input
              type="text"
              maxLength={100}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Event title"
              className="w-full rounded-lg border border-[var(--accent-border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-invisible)] transition-colors outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/30"
            />
            <div className="mt-1 text-right text-[10px] text-[var(--text-invisible)]">
              {form.title.length}/100
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-tertiary)]">
              Description
            </label>
            <textarea
              maxLength={500}
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the event and its significance..."
              className="w-full resize-none rounded-lg border border-[var(--accent-border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-invisible)] transition-colors outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/30"
            />
            <div className="mt-1 text-right text-[10px] text-[var(--text-invisible)]">
              {form.description.length}/500
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-tertiary)]">
              Impact Level
            </label>
            <div className="grid grid-cols-4 gap-2">
              {IMPACTS.map((level) => (
                <button
                  key={level}
                  onClick={() => setForm((f) => ({ ...f, impact: level }))}
                  className={`cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-medium capitalize transition-all ${
                    form.impact === level
                      ? "border-transparent shadow-md"
                      : "border-[var(--accent-border)] text-[var(--text-muted)] hover:border-[var(--accent-faint)]"
                  }`}
                  style={
                    form.impact === level
                      ? {
                          backgroundColor: `${IMPACT_COLORS[level]}20`,
                          color: IMPACT_COLORS[level],
                        }
                      : undefined
                  }
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => valid && onSubmit(form)}
            disabled={!valid}
            className="w-full cursor-pointer rounded-lg bg-gradient-to-r from-pink-500 to-fuchsia-600 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create Root Event
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Editor Content ──────────────────────────────────────────────────────

function EditorContent() {
  const router = useRouter();

  // Core state
  const [timeline, setTimeline] = useState<TimelineNode | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<{
    parentId: string | null;
    node: Partial<TimelineNode>;
    isEditing: boolean;
  } | null>(null);

  // Critique state
  const [critique, setCritique] = useState<EditorCritiqueResponse | null>(null);
  const [isCritiquing, setIsCritiquing] = useState(false);

  // Delete confirmation
  const [deleteConfirmNodeId, setDeleteConfirmNodeId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { setCenter, getNode } = useReactFlow();

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Tree mutation helpers ────────────────────────────────────────────────

  const updateNodeInTree = useCallback(
    (root: TimelineNode, nodeId: string, updates: Partial<TimelineNode>): TimelineNode => {
      if (root.id === nodeId) {
        return { ...root, ...updates, branches: updates.branches ?? root.branches };
      }
      return {
        ...root,
        branches: root.branches.map((b) => updateNodeInTree(b, nodeId, updates)),
      };
    },
    []
  );

  const removeNodeFromTree = useCallback((root: TimelineNode, nodeId: string): TimelineNode => {
    return {
      ...root,
      branches: root.branches
        .filter((b) => b.id !== nodeId)
        .map((b) => removeNodeFromTree(b, nodeId)),
    };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCreateRoot = useCallback((data: NodeFormData) => {
    const root: TimelineNode = {
      id: generateId(),
      year: parseInt(data.year, 10) || 0,
      title: data.title.trim(),
      description: data.description.trim(),
      impact: data.impact,
      branches: [],
    };
    setTimeline(root);
    soundManager?.playSuccess();
  }, []);

  const handleSelect = useCallback((nodeId: string) => {
    soundManager?.playClick();
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  // onExpand is used by React Flow nodes; in editor, it triggers "add branch"
  const handleExpand = useCallback((nodeId: string) => {
    setEditingNode({
      parentId: nodeId,
      node: {},
      isEditing: false,
    });
    setSelectedNodeId(nodeId);
  }, []);

  const handleAddBranch = useCallback(() => {
    if (!selectedNodeId) return;
    setEditingNode({
      parentId: selectedNodeId,
      node: {},
      isEditing: false,
    });
  }, [selectedNodeId]);

  const handleEditNode = useCallback(() => {
    if (!selectedNodeId || !timeline) return;
    const node = findNodeById(timeline, selectedNodeId);
    if (!node) return;
    setEditingNode({
      parentId: null,
      node,
      isEditing: true,
    });
  }, [selectedNodeId, timeline]);

  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => {
      if (!timeline) return;
      const node = findNodeById(timeline, nodeId);
      if (!node) return;
      setSelectedNodeId(nodeId);
      setEditingNode({
        parentId: null,
        node,
        isEditing: true,
      });
    },
    [timeline]
  );

  const handleFormSubmit = useCallback(
    (data: NodeFormData) => {
      if (!timeline || !editingNode) return;

      if (editingNode.isEditing && editingNode.node.id) {
        // Update existing node
        const updated = updateNodeInTree(timeline, editingNode.node.id, {
          year: parseInt(data.year, 10) || 0,
          title: data.title.trim(),
          description: data.description.trim(),
          impact: data.impact,
        });
        setTimeline(updated);
        showToast("Node updated");
        soundManager?.playClick();
      } else if (editingNode.parentId) {
        // Add new branch
        const newNode: TimelineNode = {
          id: generateId(),
          year: parseInt(data.year, 10) || 0,
          title: data.title.trim(),
          description: data.description.trim(),
          impact: data.impact,
          branches: [],
        };
        const updated = addBranchesToNode(timeline, editingNode.parentId, [newNode]);
        setTimeline(updated);
        showToast("Branch added");
        soundManager?.playWhoosh();
      }

      setEditingNode(null);
    },
    [timeline, editingNode, updateNodeInTree, showToast]
  );

  const handleDeleteRequest = useCallback(() => {
    if (!selectedNodeId || !timeline) return;
    if (selectedNodeId === timeline.id) {
      showToast("Cannot delete the root node");
      return;
    }
    setDeleteConfirmNodeId(selectedNodeId);
  }, [selectedNodeId, timeline, showToast]);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteConfirmNodeId || !timeline) return;
    const updated = removeNodeFromTree(timeline, deleteConfirmNodeId);
    setTimeline(updated);
    setSelectedNodeId(null);
    setDeleteConfirmNodeId(null);
    showToast("Node deleted");
    soundManager?.playClick();
  }, [deleteConfirmNodeId, timeline, removeNodeFromTree, showToast]);

  const handleNavigateToNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      const rfNode = getNode(nodeId);
      if (rfNode) {
        const x = rfNode.position.x + (rfNode.measured?.width ?? 260) / 2;
        const y = rfNode.position.y + (rfNode.measured?.height ?? 160) / 2;
        setCenter(x, y, { zoom: 1, duration: 800 });
      }
    },
    [getNode, setCenter]
  );

  // ── AI Critique ──────────────────────────────────────────────────────────

  const handleCritique = useCallback(async () => {
    if (!timeline || isCritiquing) return;
    setIsCritiquing(true);
    try {
      const res = await fetch("/api/editor/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: "User-created timeline",
          timeline,
        }),
      });
      if (!res.ok) {
        showToast("Failed to get AI critique");
        return;
      }
      const data: EditorCritiqueResponse = await res.json();
      setCritique(data);
      soundManager?.playSuccess();
    } catch {
      showToast("Failed to get AI critique");
      soundManager?.playError();
    } finally {
      setIsCritiquing(false);
    }
  }, [timeline, isCritiquing, showToast]);

  // ── Save / Export / Share ────────────────────────────────────────────────

  const asScenarioResponse = useCallback((): ScenarioResponse | null => {
    if (!timeline) return null;
    return {
      scenario: "User-created timeline",
      realHistory: "",
      timeline,
    };
  }, [timeline]);

  const handleSave = useCallback(() => {
    const data = asScenarioResponse();
    if (!data) return;
    saveTimeline("User-created timeline", data);
    showToast("Timeline saved!");
  }, [asScenarioResponse, showToast]);

  const handleExport = useCallback(() => {
    const data = asScenarioResponse();
    if (!data) return;
    exportTimelineJSON(data, "User-created timeline");
    showToast("Exported as JSON");
  }, [asScenarioResponse, showToast]);

  const handleShare = useCallback(async () => {
    const data = asScenarioResponse();
    if (!data) return;
    const url = generateShareURL(data);
    if (url.length > 8000) {
      showToast("Timeline too large to share via URL. Use JSON export.");
      return;
    }
    const success = await copyToClipboard(url);
    if (success) {
      showToast("Share link copied to clipboard!");
    } else {
      showToast("Could not copy link. Try JSON export.");
    }
  }, [asScenarioResponse, showToast]);

  // ── Build tree layout ────────────────────────────────────────────────────

  useEffect(() => {
    if (!timeline) return;
    const { nodes: layoutNodes, edges: layoutEdges } = buildTreeLayout(
      timeline,
      null,
      selectedNodeId,
      handleExpand,
      handleSelect
    );
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [timeline, selectedNodeId, handleExpand, handleSelect, setNodes, setEdges]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s" && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        handleExport();
      }
      if (e.key === "Escape") {
        if (editingNode) {
          setEditingNode(null);
        } else if (selectedNodeId) {
          setSelectedNodeId(null);
        }
      }
      if (e.key === "Delete" && selectedNodeId && !editingNode) {
        handleDeleteRequest();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleExport, editingNode, selectedNodeId, handleDeleteRequest]);

  // ── Handle double-click on React Flow nodes ─────────────────────────────

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      handleNodeDoubleClick(node.id);
    },
    [handleNodeDoubleClick]
  );

  // ── Selected node data ───────────────────────────────────────────────────

  const selectedNode = useMemo(() => {
    if (!timeline || !selectedNodeId) return null;
    return findNodeById(timeline, selectedNodeId);
  }, [timeline, selectedNodeId]);

  const nodeCount = useMemo(() => {
    if (!timeline) return 0;
    return collectAllNodes(timeline).length;
  }, [timeline]);

  // ── Form initial values ──────────────────────────────────────────────────

  const formInitial: NodeFormData = useMemo(() => {
    if (!editingNode) return emptyForm;
    if (editingNode.isEditing && editingNode.node.id) {
      return {
        year: String(editingNode.node.year ?? ""),
        title: editingNode.node.title ?? "",
        description: editingNode.node.description ?? "",
        impact: editingNode.node.impact ?? "medium",
      };
    }
    return emptyForm;
  }, [editingNode]);

  // ── Toolbar icons ────────────────────────────────────────────────────────

  const btnClass =
    "cursor-pointer rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]";

  // ── Render ───────────────────────────────────────────────────────────────

  // Root creation form
  if (!timeline) {
    return (
      <div className="relative h-screen w-screen" role="main" aria-label="Timeline Editor">
        {/* Top bar */}
        <div className="absolute top-0 right-0 left-0 z-40 flex items-center justify-between border-b border-[var(--accent-ghost)] bg-[var(--surface-overlay)] px-3 py-2 backdrop-blur-xl sm:px-6 sm:py-3">
          <button
            onClick={() => router.push("/")}
            aria-label="Go back to home"
            className={`flex items-center gap-2 text-sm ${btnClass}`}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-600 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-pink-500/20">
              Timeline Editor
            </span>
          </div>

          <div className="flex items-center gap-1">
            <SoundToggle />
            <ThemeToggle />
          </div>
        </div>

        <RootCreationForm onSubmit={handleCreateRoot} />
      </div>
    );
  }

  // Main editor view
  return (
    <div className="relative z-10 h-screen w-screen" role="main" aria-label="Timeline Editor">
      {/* Top bar */}
      <div className="absolute top-0 right-0 left-0 z-40 flex items-center justify-between border-b border-[var(--accent-ghost)] bg-[var(--surface-overlay)] px-3 py-2 backdrop-blur-xl sm:px-6 sm:py-3">
        <button
          onClick={() => router.push("/")}
          aria-label="Go back to home"
          className={`flex items-center gap-2 text-sm ${btnClass}`}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-600 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-pink-500/20">
            Timeline Editor
          </span>
          <span className="hidden text-xs text-[var(--text-faint)] sm:inline">
            {nodeCount} node{nodeCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Desktop toolbar */}
        <div className="hidden items-center gap-1 sm:flex">
          <button
            onClick={handleSave}
            aria-label="Save timeline (Ctrl+S)"
            title="Save timeline (Ctrl+S)"
            className={btnClass}
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
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
          </button>
          <button
            onClick={handleExport}
            aria-label="Export as JSON (Ctrl+E)"
            title="Export as JSON (Ctrl+E)"
            className={btnClass}
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
          <button
            onClick={handleShare}
            aria-label="Share timeline"
            title="Share timeline"
            className={btnClass}
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
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
          </button>

          <div className="mx-1 h-5 w-px bg-[var(--accent-ghost)]" />

          <button
            onClick={handleCritique}
            disabled={isCritiquing}
            aria-label="AI Critique"
            title="AI Critique"
            className={`${btnClass} ${isCritiquing ? "" : "hover:text-pink-400"}`}
          >
            {isCritiquing ? (
              <Spinner className="h-4 w-4" />
            ) : (
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
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            )}
          </button>

          <SoundToggle />
          <ThemeToggle />
        </div>

        {/* Mobile toolbar */}
        <div className="flex items-center gap-1 sm:hidden">
          <button onClick={handleSave} aria-label="Save" className={btnClass}>
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
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
          </button>
          <button
            onClick={handleCritique}
            disabled={isCritiquing}
            aria-label="AI Critique"
            className={btnClass}
          >
            {isCritiquing ? (
              <Spinner className="h-4 w-4" />
            ) : (
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
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            )}
          </button>
          <SoundToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-pink-500/20 bg-[var(--surface-secondary)] px-4 py-2 text-sm text-[var(--text-secondary)] shadow-xl backdrop-blur-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected node actions bar */}
      <AnimatePresence>
        {selectedNode && !editingNode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-pink-500/20 bg-[var(--surface-secondary)] px-4 py-2 shadow-xl backdrop-blur-xl"
          >
            <span className="mr-2 max-w-32 truncate text-xs text-[var(--text-faint)]">
              {selectedNode.title}
            </span>

            <button
              onClick={handleAddBranch}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-r from-pink-500 to-fuchsia-600 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
            >
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add branch
            </button>

            <button
              onClick={handleEditNode}
              className="cursor-pointer rounded-lg border border-[var(--accent-border)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-pink-500/30 hover:text-[var(--text-secondary)]"
            >
              Edit
            </button>

            {selectedNodeId !== timeline.id && (
              <button
                onClick={handleDeleteRequest}
                className="cursor-pointer rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 transition-colors hover:border-red-500/40 hover:bg-red-500/5"
              >
                Delete
              </button>
            )}

            <button
              onClick={() => setSelectedNodeId(null)}
              className="cursor-pointer rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:text-[var(--text-secondary)]"
              aria-label="Deselect node"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* React Flow canvas */}
      <div id="editor-canvas" className="h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.2}
          maxZoom={1.5}
          className="!bg-transparent"
          nodesDraggable={false}
        >
          <Background color="rgba(236, 72, 153, 0.05)" gap={40} size={1} />
          <Controls showInteractive={false} aria-label="Map controls" />
          <MiniMap
            nodeColor="rgba(236, 72, 153, 0.4)"
            maskColor="var(--minimap-mask, rgba(5, 5, 16, 0.8))"
            className="!rounded-xl !border !border-pink-500/20 !bg-[var(--minimap-bg)]"
            pannable
            zoomable
          />
        </ReactFlow>
      </div>

      {/* Node edit form panel */}
      <AnimatePresence>
        {editingNode && (
          <NodeFormPanel
            key={
              editingNode.isEditing ? `edit-${editingNode.node.id}` : `add-${editingNode.parentId}`
            }
            initial={formInitial}
            isEditing={editingNode.isEditing}
            onSubmit={handleFormSubmit}
            onCancel={() => setEditingNode(null)}
          />
        )}
      </AnimatePresence>

      {/* AI Critique results panel */}
      <AnimatePresence>
        {critique && (
          <CritiquePanel
            critique={critique}
            onClose={() => setCritique(null)}
            onNavigateToNode={handleNavigateToNode}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirmNodeId}
        title="Delete Node?"
        message="This will permanently remove this node and all its child branches."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmNodeId(null)}
      />

      {/* Critiquing indicator */}
      <AnimatePresence>
        {isCritiquing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-pink-500/20 bg-[var(--surface-secondary)] px-4 py-2 text-sm text-pink-400 shadow-xl backdrop-blur-xl"
          >
            <Spinner className="h-4 w-4" />
            Analyzing your timeline...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard shortcuts help */}
      <div className="absolute right-4 bottom-4 z-30 hidden text-xs text-[var(--text-invisible)] lg:block">
        Double-click to edit · Ctrl+S Save · Ctrl+E Export · Del Delete node
      </div>
    </div>
  );
}

// ── Page Wrapper ─────────────────────────────────────────────────────────────

function EditorLoading() {
  return (
    <div className="relative z-10 flex h-screen w-screen items-center justify-center">
      <div className="h-16 w-16 animate-spin rounded-full border-2 border-pink-500/20 border-t-pink-500" />
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<EditorLoading />}>
      <ReactFlowProvider>
        <EditorContent />
      </ReactFlowProvider>
    </Suspense>
  );
}
