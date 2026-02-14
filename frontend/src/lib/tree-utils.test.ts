import { describe, it, expect } from "vitest";
import {
  findNodeById,
  findChainToNode,
  addBranchesToNode,
  collectAllNodes,
  collapseNode,
} from "./tree-utils";
import type { TimelineNode } from "./types";

function makeNode(overrides: Partial<TimelineNode> = {}): TimelineNode {
  return {
    id: "root",
    year: 1800,
    title: "Root Event",
    description: "The root event description",
    impact: "critical",
    branches: [],
    ...overrides,
  };
}

const tree = makeNode({
  branches: [
    makeNode({
      id: "b1",
      year: 1801,
      title: "Branch 1",
      description: "First branch",
      branches: [
        makeNode({ id: "b1-1", year: 1802, title: "Sub Branch", description: "Sub branch desc" }),
      ],
    }),
    makeNode({ id: "b2", year: 1803, title: "Branch 2", description: "Second branch" }),
  ],
});

describe("findNodeById", () => {
  it("finds root node", () => {
    expect(findNodeById(tree, "root")?.id).toBe("root");
  });

  it("finds nested node", () => {
    expect(findNodeById(tree, "b1-1")?.title).toBe("Sub Branch");
  });

  it("returns null for non-existent id", () => {
    expect(findNodeById(tree, "nope")).toBeNull();
  });
});

describe("findChainToNode", () => {
  it("returns chain from root to target", () => {
    const chain = findChainToNode(tree, "b1-1");
    expect(chain).toHaveLength(3);
    expect(chain![0].title).toBe("Root Event");
    expect(chain![2].title).toBe("Sub Branch");
  });

  it("returns null for non-existent target", () => {
    expect(findChainToNode(tree, "nope")).toBeNull();
  });
});

describe("addBranchesToNode", () => {
  it("adds branches to the correct node", () => {
    const newBranch = makeNode({ id: "new", year: 1810 });
    const updated = addBranchesToNode(tree, "b2", [newBranch]);
    const b2 = findNodeById(updated, "b2")!;
    expect(b2.branches).toHaveLength(1);
    expect(b2.branches[0].id).toBe("new");
  });

  it("does not mutate original tree", () => {
    const newBranch = makeNode({ id: "new2", year: 1811 });
    addBranchesToNode(tree, "b2", [newBranch]);
    expect(findNodeById(tree, "b2")!.branches).toHaveLength(0);
  });
});

describe("collectAllNodes", () => {
  it("collects all nodes from tree", () => {
    const all = collectAllNodes(tree);
    expect(all).toHaveLength(4);
    expect(all.map((n) => n.id).sort()).toEqual(["b1", "b1-1", "b2", "root"]);
  });
});

describe("collapseNode", () => {
  it("removes branches from target node", () => {
    const collapsed = collapseNode(tree, "b1");
    const b1 = findNodeById(collapsed, "b1")!;
    expect(b1.branches).toHaveLength(0);
  });

  it("does not affect other nodes", () => {
    const collapsed = collapseNode(tree, "b1");
    expect(findNodeById(collapsed, "root")!.branches).toHaveLength(2);
  });

  it("does not mutate original tree", () => {
    collapseNode(tree, "b1");
    expect(findNodeById(tree, "b1")!.branches).toHaveLength(1);
  });
});
