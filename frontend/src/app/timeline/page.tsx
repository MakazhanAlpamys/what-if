"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";

import TimelineNodeComponent from "@/components/TimelineNode";
import DetailPanel from "@/components/DetailPanel";
import { streamGenerate, streamExpand } from "@/lib/stream";
import { buildTreeLayout } from "@/lib/tree-layout";
import { MAX_TREE_DEPTH } from "@/lib/constants";
import type { TimelineNode, ScenarioResponse } from "@/lib/types";

const nodeTypes = { timelineNode: TimelineNodeComponent };

function findNodeById(root: TimelineNode, id: string): TimelineNode | null {
  if (root.id === id) return root;
  for (const branch of root.branches) {
    const found = findNodeById(branch, id);
    if (found) return found;
  }
  return null;
}

function findChainToNode(
  root: TimelineNode,
  targetId: string,
  chain: { year: number; title: string; description: string }[] = []
): { year: number; title: string; description: string }[] | null {
  const currentChain = [
    ...chain,
    { year: root.year, title: root.title, description: root.description },
  ];
  if (root.id === targetId) return currentChain;
  for (const branch of root.branches) {
    const found = findChainToNode(branch, targetId, currentChain);
    if (found) return found;
  }
  return null;
}

function addBranchesToNode(
  root: TimelineNode,
  nodeId: string,
  newBranches: TimelineNode[]
): TimelineNode {
  if (root.id === nodeId) {
    return { ...root, branches: [...root.branches, ...newBranches] };
  }
  return {
    ...root,
    branches: root.branches.map((b) => addBranchesToNode(b, nodeId, newBranches)),
  };
}

function TimelineContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scenario = searchParams.get("q") || "";

  const [scenarioData, setScenarioData] = useState<ScenarioResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const hasChildrenMapRef = useRef<Map<string, boolean>>(new Map());

  const handleExpand = useCallback(
    (nodeId: string) => {
      if (!scenarioData || expandingNodeId) return;

      const chain = findChainToNode(scenarioData.timeline, nodeId);
      if (!chain) return;

      if (chain.length >= MAX_TREE_DEPTH) {
        setError(
          `Maximum depth of ${MAX_TREE_DEPTH} levels reached. Try a new scenario for fresh exploration.`
        );
        return;
      }

      setExpandingNodeId(nodeId);

      const expandAbort = new AbortController();
      streamExpand(
        scenario,
        chain,
        () => {},
        (data) => {
          setScenarioData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              timeline: addBranchesToNode(prev.timeline, nodeId, data.branches),
            };
          });
          setExpandingNodeId(null);
        },
        (err) => {
          console.error("Expand error:", err);
          setExpandingNodeId(null);
        },
        expandAbort.signal
      );
    },
    [scenarioData, expandingNodeId, scenario]
  );

  const handleSelect = useCallback((nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  // Build tree layout when data or expanding state changes (not on select)
  useEffect(() => {
    if (!scenarioData) return;

    const {
      nodes: layoutNodes,
      edges: layoutEdges,
      hasChildrenMap,
    } = buildTreeLayout(
      scenarioData.timeline,
      expandingNodeId,
      selectedNodeId,
      handleExpand,
      handleSelect
    );

    hasChildrenMapRef.current = hasChildrenMap;
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [
    scenarioData,
    expandingNodeId,
    selectedNodeId,
    handleExpand,
    handleSelect,
    setNodes,
    setEdges,
  ]);

  // Generate scenario on mount
  useEffect(() => {
    if (!scenario) {
      router.push("/");
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsGenerating(true);
    setError(null);
    setStreamText("");

    streamGenerate(
      scenario,
      (text) => setStreamText(text),
      (data) => {
        setScenarioData(data);
        setIsGenerating(false);
        setStreamText("");
      },
      (err) => {
        setError(err);
        setIsGenerating(false);
      },
      abortController.signal
    );

    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedNode = useMemo(() => {
    if (!scenarioData || !selectedNodeId) return null;
    return findNodeById(scenarioData.timeline, selectedNodeId);
  }, [scenarioData, selectedNodeId]);

  return (
    <div
      className="relative z-10 h-screen w-screen"
      role="main"
      aria-label="Timeline visualization"
    >
      {/* Top bar */}
      <div className="absolute top-0 right-0 left-0 z-40 flex items-center justify-between border-b border-violet-500/10 bg-[rgba(5,5,16,0.9)] px-3 py-2 backdrop-blur-xl sm:px-6 sm:py-3">
        <button
          onClick={() => router.push("/")}
          aria-label="Go back to new scenario"
          className="flex cursor-pointer items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/70"
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
          New scenario
        </button>
        <h1 className="hidden max-w-lg truncate text-sm text-white/50 italic sm:block">
          &ldquo;{scenario}&rdquo;
        </h1>
        <div className="hidden text-xs text-white/20 sm:block">Powered by K2 Think V2</div>
      </div>

      {/* Loading state */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-live="polite"
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[rgba(5,5,16,0.95)]"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="mb-6 h-20 w-20 rounded-full border-2 border-violet-500/20 border-t-violet-500"
            />
            <h2 className="mb-2 text-xl font-semibold text-white/80">
              Creating alternate reality...
            </h2>
            <p className="mb-6 text-sm text-white/30">
              K2 Think V2 is reasoning through your scenario
            </p>
            {streamText && (
              <div className="mx-auto max-h-48 max-w-xl overflow-y-auto rounded-xl border border-violet-500/10 bg-violet-500/5 p-4">
                <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-white/30">
                  {streamText.length > 800 ? `...${streamText.slice(-800)}` : streamText}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[rgba(5,5,16,0.95)]">
          <div className="max-w-md text-center">
            <div className="mb-4 text-4xl">
              <svg
                className="inline h-12 w-12 text-red-400/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-white/70">Failed to create reality</h2>
            <p className="mb-6 text-sm text-white/30">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="cursor-pointer rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
            >
              Try another scenario
            </button>
          </div>
        </div>
      )}

      {/* React Flow */}
      {scenarioData && !isGenerating && (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.2}
          maxZoom={1.5}
          className="!bg-transparent"
          nodesDraggable={false}
        >
          <Background color="rgba(139, 92, 246, 0.05)" gap={40} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      )}

      {/* Detail panel */}
      <DetailPanel
        node={selectedNode}
        realHistory={scenarioData?.realHistory || ""}
        scenario={scenario}
        onClose={() => setSelectedNodeId(null)}
        onExpand={handleExpand}
        isExpanding={!!expandingNodeId}
        hasChildren={selectedNode ? selectedNode.branches.length > 0 : false}
      />
    </div>
  );
}

function TimelineLoading() {
  return (
    <div className="relative z-10 flex h-screen w-screen items-center justify-center">
      <div className="h-16 w-16 animate-spin rounded-full border-2 border-violet-500/20 border-t-violet-500" />
    </div>
  );
}

export default function TimelinePage() {
  return (
    <Suspense fallback={<TimelineLoading />}>
      <ReactFlowProvider>
        <TimelineContent />
      </ReactFlowProvider>
    </Suspense>
  );
}
