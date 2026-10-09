import { getInstanceByDom } from "./core";

type Box = { x: number; y: number; w: number; h: number };
type LabelReport = {
  container: Box;
  grid: Box | null;
  texts: { text: string; box: Box }[];
};

// Dev and e2e only (never imported by the barrel). Axis labels are drawn on the canvas, so the DOM cannot report them. The echarts instance is read through the
// shared module registry and its zrender display list gives each text element's box in container coordinates.
function measureChart(id: string): LabelReport | null {
  const host = document.querySelector<HTMLElement>(`[data-chart-lab="${id}"] [role="img"]`);
  if (!host) return null;
  const instance = getInstanceByDom(host);
  if (!instance) return null;

  const rect = host.getBoundingClientRect();
  const texts: LabelReport["texts"] = [];
  for (const el of instance.getZr().storage.getDisplayList(true)) {
    const text = (el as { style?: { text?: unknown } }).style?.text;
    if (typeof text !== "string" || text === "" || el.ignore) continue;
    const box = el.getBoundingRect().clone();
    if (el.transform) box.applyTransform(el.transform);
    texts.push({ text, box: { x: box.x, y: box.y, w: box.width, h: box.height } });
  }

  let grid: Box | null = null;
  // getModel is private in the typings; it is the only way to read the laid-out grid rect.
  const model = (instance as unknown as { getModel: () => { getComponent: (name: string) => unknown } }).getModel();
  const component = model.getComponent("grid") as
    | { coordinateSystem?: { getRect: () => { x: number; y: number; width: number; height: number } } }
    | undefined;
  const gridRect = component?.coordinateSystem?.getRect();
  if (gridRect) grid = { x: gridRect.x, y: gridRect.y, w: gridRect.width, h: gridRect.height };

  return { container: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }, grid, texts };
}

export { measureChart };
