import type { TimelineNode } from "./types";

export function findNodeById(root: TimelineNode, id: string): TimelineNode | null {
  if (root.id === id) return root;
  for (const branch of root.branches) {
    const found = findNodeById(branch, id);
    if (found) return found;
  }
  return null;
}

export function findChainToNode(
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

export function addBranchesToNode(
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

export function collectAllNodes(root: TimelineNode): TimelineNode[] {
  const result: TimelineNode[] = [root];
  for (const branch of root.branches) {
    result.push(...collectAllNodes(branch));
  }
  return result;
}

export function collapseNode(root: TimelineNode, nodeId: string): TimelineNode {
  if (root.id === nodeId) {
    return { ...root, branches: [] };
  }
  return {
    ...root,
    branches: root.branches.map((b) => collapseNode(b, nodeId)),
  };
}

export function findNodeIdsOnPath(root: TimelineNode, targetId: string): Set<string> | null {
  if (root.id === targetId) return new Set([root.id]);
  for (const branch of root.branches) {
    const result = findNodeIdsOnPath(branch, targetId);
    if (result) {
      result.add(root.id);
      return result;
    }
  }
  return null;
}
