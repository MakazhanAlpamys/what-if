import { describe, it, expect } from "vitest";
import { buildTreeLayout } from "./tree-layout";
import type { TimelineNode } from "./types";

const mockExpand = () => {};
const mockSelect = () => {};

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

describe("buildTreeLayout", () => {
  it("returns a single node for a leaf", () => {
    const root = makeNode();
    const { nodes, edges } = buildTreeLayout(root, null, null, mockExpand, mockSelect);

    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
    expect(nodes[0].id).toBe("root");
  });

  it("creates edges for branches", () => {
    const root = makeNode({
      branches: [
        makeNode({ id: "b1", year: 1801, title: "Branch 1" }),
        makeNode({ id: "b2", year: 1802, title: "Branch 2" }),
      ],
    });

    const { nodes, edges } = buildTreeLayout(root, null, null, mockExpand, mockSelect);

    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(2);
    expect(edges[0].source).toBe("root");
    expect(edges[0].target).toBe("b1");
    expect(edges[1].source).toBe("root");
    expect(edges[1].target).toBe("b2");
  });

  it("marks selected node correctly", () => {
    const root = makeNode({
      branches: [makeNode({ id: "b1" })],
    });

    const { nodes } = buildTreeLayout(root, null, "b1", mockExpand, mockSelect);
    const selected = nodes.find((n) => n.id === "b1");
    expect(selected?.data.isSelected).toBe(true);
  });

  it("tracks hasChildren in map", () => {
    const root = makeNode({
      branches: [makeNode({ id: "b1" })],
    });

    const { hasChildrenMap } = buildTreeLayout(root, null, null, mockExpand, mockSelect);
    expect(hasChildrenMap.get("root")).toBe(true);
    expect(hasChildrenMap.get("b1")).toBe(false);
  });
});
