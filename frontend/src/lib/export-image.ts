import { toPng, toSvg } from "html-to-image";

function getViewportElement(): HTMLElement | null {
  const canvas = document.getElementById("timeline-canvas");
  if (!canvas) return null;
  return canvas.querySelector(".react-flow__viewport") as HTMLElement | null;
}

function filterNode(node: Element): boolean {
  const className = node.className?.toString() ?? "";
  return !className.includes("react-flow__controls") && !className.includes("react-flow__minimap");
}

export async function exportAsPNG(filename: string): Promise<void> {
  const viewport = getViewportElement();
  if (!viewport) throw new Error("Timeline canvas not found");

  const bg = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();

  const dataUrl = await toPng(viewport, {
    backgroundColor: bg || "#050510",
    pixelRatio: 2,
    filter: filterNode,
  });

  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = dataUrl;
  link.click();
}

export async function exportAsSVG(filename: string): Promise<void> {
  const viewport = getViewportElement();
  if (!viewport) throw new Error("Timeline canvas not found");

  const bg = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();

  const dataUrl = await toSvg(viewport, {
    backgroundColor: bg || "#050510",
    filter: filterNode,
  });

  const link = document.createElement("a");
  link.download = `${filename}.svg`;
  link.href = dataUrl;
  link.click();
}
