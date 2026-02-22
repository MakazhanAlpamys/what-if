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

  it("colors edges by target node impact", () => {
    const root = makeNode({
      branches: [makeNode({ id: "b1", impact: "critical" }), makeNode({ id: "b2", impact: "low" })],
    });

    const { edges } = buildTreeLayout(root, null, null, mockExpand, mockSelect);

    // critical = #ef4444, low = #22c55e, appended with "80" for alpha
    expect(edges[0].style?.stroke).toContain("ef4444");
    expect(edges[1].style?.stroke).toContain("22c55e");
  });

  it("highlights path to selected node with thicker stroke", () => {
    const root = makeNode({
      branches: [
        makeNode({
          id: "b1",
          branches: [makeNode({ id: "b1-1" })],
        }),
        makeNode({ id: "b2" }),
      ],
    });

    const { edges } = buildTreeLayout(root, null, "b1-1", mockExpand, mockSelect);

    // Edge from root to b1 and b1 to b1-1 should be on the path (strokeWidth 3)
    const pathEdge1 = edges.find((e) => e.source === "root" && e.target === "b1");
    const pathEdge2 = edges.find((e) => e.source === "b1" && e.target === "b1-1");
    expect(pathEdge1?.style?.strokeWidth).toBe(3);
    expect(pathEdge2?.style?.strokeWidth).toBe(3);

    // Edge to b2 should remain normal (strokeWidth 2)
    const nonPathEdge = edges.find((e) => e.target === "b2");
    expect(nonPathEdge?.style?.strokeWidth).toBe(2);
  });

  it("marks new nodes with isNew flag", () => {
    const root = makeNode({
      branches: [makeNode({ id: "b1" })],
    });

    const newIds = new Set(["b1"]);
    const { nodes } = buildTreeLayout(root, null, null, mockExpand, mockSelect, newIds);

    const newNode = nodes.find((n) => n.id === "b1");
    expect(newNode?.data.isNew).toBe(true);

    const rootNode = nodes.find((n) => n.id === "root");
    expect(rootNode?.data.isNew).toBe(false);
  });

  it("adds edge-new class to new edges", () => {
    const root = makeNode({
      branches: [makeNode({ id: "b1" })],
    });

    const newIds = new Set(["b1"]);
    const { edges } = buildTreeLayout(root, null, null, mockExpand, mockSelect, newIds);

    expect(edges[0].className).toBe("edge-new");
  });
});
