import type { CSSProperties } from "react";

const svgBase: CSSProperties = { width: 18, height: 18, display: "block" };
const svgAttrs = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconPlay() {
  return <svg style={svgBase} {...svgAttrs}><polygon points="5 3 19 12 5 21 5 3" /></svg>;
}

export function IconPause() {
  return <svg style={svgBase} {...svgAttrs}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>;
}

export function IconInfo() {
  return (
    <svg style={{ width: 20, height: 20, display: "block" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2" stroke="none" />
      <path d="M12 10v10" fill="none" strokeWidth={3} />
    </svg>
  );
}

export function IconMaximize() {
  return <svg style={svgBase} {...svgAttrs}><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>;
}

export function IconMinimize() {
  return <svg style={svgBase} {...svgAttrs}><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>;
}

export function IconX() {
  return <svg style={svgBase} {...svgAttrs}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
}

export function IconChevronLeft() {
  return <svg style={{ width: 22, height: 22, display: "block" }} {...svgAttrs}><polyline points="15 18 9 12 15 6" /></svg>;
}

export function IconChevronRight() {
  return <svg style={{ width: 22, height: 22, display: "block" }} {...svgAttrs}><polyline points="9 18 15 12 9 6" /></svg>;
}
