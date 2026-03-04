import type { Node, Edge } from "@xyflow/react";
import type { TimelineNode } from "./types";
import { IMPACT_COLORS } from "./constants";
import { findNodeIdsOnPath } from "./tree-utils";

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
  onExpand: (nodeId: string) => void,
  onSelect: (nodeId: string) => void,
  newNodeIds?: Set<string>,
  paradoxNodeIds?: Set<string>
) {
  const isRoot = parentId === null;
  const hasChildren = node.branches.length > 0;

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
      isNew: newNodeIds?.has(node.id) ?? false,
      isParadox: paradoxNodeIds?.has(node.id) ?? false,
      onExpand,
      onSelect,
    },
  });

  if (parentId) {
    const color = IMPACT_COLORS[node.impact];
    const isNewEdge = newNodeIds?.has(node.id) ?? false;
    edges.push({
      id: `edge-${parentId}-${node.id}`,
      source: parentId,
      target: node.id,
      type: "smoothstep",
      animated: true,
      style: { stroke: `${color}80`, strokeWidth: 2 },
      className: isNewEdge ? "edge-new" : undefined,
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
        onExpand,
        onSelect,
        newNodeIds,
        paradoxNodeIds
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
  onSelect: (nodeId: string) => void,
  newNodeIds?: Set<string>,
  paradoxNodeIds?: Set<string>
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

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
    onExpand,
    onSelect,
    newNodeIds,
    paradoxNodeIds
  );

  // Highlight path to selected node
  if (selectedNodeId) {
    const pathIds = findNodeIdsOnPath(root, selectedNodeId);
    if (pathIds) {
      for (const edge of edges) {
        if (pathIds.has(edge.source) && pathIds.has(edge.target)) {
          const currentStroke = (edge.style?.stroke as string) ?? "";
          edge.style = {
            ...edge.style,
            strokeWidth: 3,
            stroke: currentStroke.replace(/80$/, "cc"),
          };
        }
      }
    }
  }

  return { nodes, edges };
}
