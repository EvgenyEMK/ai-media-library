"use client";

import { useMemo, useState, type ReactElement } from "react";

interface DesktopMetadataTreeProps {
  data: unknown;
}

function isExpandable(value: unknown): value is Record<string, unknown> | unknown[] {
  return value !== null && typeof value === "object";
}

function formatPrimitiveValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  return String(value);
}

function getCollapsedSummary(value: Record<string, unknown> | unknown[]): string {
  if (Array.isArray(value)) {
    return `[${value.length} item${value.length === 1 ? "" : "s"}]`;
  }
  const keyCount = Object.keys(value).length;
  return `{${keyCount} key${keyCount === 1 ? "" : "s"}}`;
}

function getChildEntries(value: Record<string, unknown> | unknown[]): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    return value.map((entry, index) => [`[${index}]`, entry]);
  }
  return Object.entries(value);
}

function ExpandIcon({ expanded }: { expanded: boolean }): ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
    >
      <path d="M6 3.5L11 8L6 12.5V3.5Z" fill="currentColor" />
    </svg>
  );
}

interface MetadataTreeNodeProps {
  label: string;
  value: unknown;
  path: string;
  depth: number;
  expandedPaths: Set<string>;
  onTogglePath: (path: string) => void;
}

function MetadataTreeNode({
  label,
  value,
  path,
  depth,
  expandedPaths,
  onTogglePath,
}: MetadataTreeNodeProps): ReactElement {
  const expandable = isExpandable(value);
  const expanded = expandable ? expandedPaths.has(path) : false;
  const children = expandable && expanded ? getChildEntries(value) : [];
  const indentStyle = { paddingLeft: `${depth * 0.875}rem` };

  return (
    <div>
      <div className="flex min-h-7 items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted/70" style={indentStyle}>
        {expandable ? (
          <button
            type="button"
            onClick={() => onTogglePath(path)}
            className="inline-flex h-4 w-4 items-center justify-center rounded-sm hover:bg-muted"
            aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
            aria-expanded={expanded}
          >
            <ExpandIcon expanded={expanded} />
          </button>
        ) : (
          <span className="inline-block h-4 w-4 shrink-0" />
        )}
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">:</span>
        {expandable ? (
          <span className="text-muted-foreground">{getCollapsedSummary(value)}</span>
        ) : (
          <span className="break-all text-foreground">{formatPrimitiveValue(value)}</span>
        )}
      </div>
      {expandable && expanded ? (
        <div className="ml-2 border-l border-border/70">
          {children.map(([childLabel, childValue]) => (
            <MetadataTreeNode
              key={`${path}.${childLabel}`}
              label={childLabel}
              value={childValue}
              path={`${path}.${childLabel}`}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              onTogglePath={onTogglePath}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DesktopMetadataTree({ data }: DesktopMetadataTreeProps): ReactElement {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());

  const rootEntries = useMemo(() => {
    if (!isExpandable(data)) {
      return [["value", data] as [string, unknown]];
    }
    return getChildEntries(data);
  }, [data]);

  const togglePath = (path: string): void => {
    setExpandedPaths((previous) => {
      const next = new Set(previous);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-2 text-xs">
      <div className="grid gap-0.5 font-mono">
        {rootEntries.map(([label, value]) => (
          <MetadataTreeNode
            key={label}
            label={label}
            value={value}
            path={label}
            depth={0}
            expandedPaths={expandedPaths}
            onTogglePath={togglePath}
          />
        ))}
      </div>
    </div>
  );
}
