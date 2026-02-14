import type { Node, Edge } from "@xyflow/react";
import type { TimelineNode } from "./types";

const NODE_WIDTH = 260;
const NODE_HEIGHT = 160;
const H_GAP = 60;
const V_GAP = 80;

// Calculate subtree width
function subtreeWidth(node: TimelineNode): number {
  if (node.branches.length === 0) return NODE_WIDTH;
  const childrenWidth = node.branches.reduce((sum, child) => sum + subtreeWidth(child), 0);
  const gapsWidth = (node.branches.length - 1) * H_GAP;
  return Math.max(NODE_WIDTH, childrenWidth + gapsWidth);
}

function layoutNode(
  node: TimelineNode,
  x: number,
  y: number,
  depth: number,
  parentId: string | null,
  nodes: Node[],
  edges: Edge[],
  expandingNodeId: string | null,
  selectedNodeId: string | null,
  hasChildrenMap: Map<string, boolean>,
  onExpand: (nodeId: string) => void,
  onSelect: (nodeId: string) => void
) {
  const isRoot = parentId === null;
  const hasChildren = node.branches.length > 0;
  hasChildrenMap.set(node.id, hasChildren);

  nodes.push({
    id: node.id,
    type: "timelineNode",
    position: { x: x - NODE_WIDTH / 2, y },
    data: {
      label: node.title,
      timelineNode: node,
      isRoot,
      isSelected: node.id === selectedNodeId,
      isExpanding: node.id === expandingNodeId,
      hasChildren,
      onExpand,
      onSelect,
    },
  });

  if (parentId) {
    edges.push({
      id: `edge-${parentId}-${node.id}`,
      source: parentId,
      target: node.id,
      type: "smoothstep",
      animated: true,
      style: { stroke: "rgba(139, 92, 246, 0.3)", strokeWidth: 2 },
    });
  }

  if (node.branches.length > 0) {
    const totalWidth = subtreeWidth(node);
    let startX = x - totalWidth / 2;

    for (const child of node.branches) {
      const childWidth = subtreeWidth(child);
      const childX = startX + childWidth / 2;

      layoutNode(
        child,
        childX,
        y + NODE_HEIGHT + V_GAP,
        depth + 1,
        node.id,
        nodes,
        edges,
        expandingNodeId,
        selectedNodeId,
        hasChildrenMap,
        onExpand,
        onSelect
      );

      startX += childWidth + H_GAP;
    }
  }
}

export function buildTreeLayout(
  root: TimelineNode,
  expandingNodeId: string | null,
  selectedNodeId: string | null,
  onExpand: (nodeId: string) => void,
  onSelect: (nodeId: string) => void
): { nodes: Node[]; edges: Edge[]; hasChildrenMap: Map<string, boolean> } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const hasChildrenMap = new Map<string, boolean>();

  layoutNode(
    root,
    0,
    0,
    0,
    null,
    nodes,
    edges,
    expandingNodeId,
    selectedNodeId,
    hasChildrenMap,
    onExpand,
    onSelect
  );

  return { nodes, edges, hasChildrenMap };
}
