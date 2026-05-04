"use client";

import { useMemo, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { IconX } from "./viewer-icons";

export interface PhotoWithInfoTab {
  id: string;
  label: string;
  badgeCount?: number;
  content: ReactNode;
}

export interface PhotoWithInfoPanelProps {
  imageUrl?: string;
  imageAlt?: string;
  tabs: PhotoWithInfoTab[];
  activeTabId?: string;
  onTabChange?: (tabId: string) => void;
  renderPhotoPane?: () => ReactNode;
  /** When set, an icon button is shown at the end of the tab row to dismiss the panel. */
  onClosePanel?: () => void;
}

const styles: Record<string, CSSProperties> = {
  root: {
    width: "100%",
    height: "100%",
    display: "flex",
    background: "hsl(var(--background, 0 0% 3.9%) / 1)",
    color: "hsl(var(--foreground, 0 0% 98%) / 1)",
  },
  photoPane: {
    width: "60%",
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "hsl(var(--background, 0 0% 3.9%) / 1)",
  },
  image: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
  },
  sidePane: {
    width: "40%",
    borderLeft: "1px solid hsl(var(--border, 0 0% 14.9%) / 1)",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  tabsHeader: {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    padding: 12,
    borderBottom: "1px solid hsl(var(--border, 0 0% 14.9%) / 1)",
  },
  tabsHeaderTabs: {
    flex: 1,
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },
  closePanelButton: {
    flexShrink: 0,
    width: 40,
    minHeight: 40,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid hsl(var(--border, 0 0% 14.9%) / 1)",
    borderRadius: 8,
    background: "hsl(var(--muted, 0 0% 14.9%) / 1)",
    color: "hsl(var(--muted-foreground, 0 0% 63.9%) / 1)",
    padding: 0,
    cursor: "pointer",
  },
  tabButton: {
    border: "1px solid hsl(var(--border, 0 0% 14.9%) / 1)",
    borderRadius: 8,
    background: "hsl(var(--muted, 0 0% 14.9%) / 1)",
    color: "hsl(var(--muted-foreground, 0 0% 63.9%) / 1)",
    padding: "8px 10px",
    fontSize: 12,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tabButtonActive: {
    borderColor: "hsl(var(--primary, 214 100% 50%) / 0.9)",
    background: "hsl(var(--primary, 214 100% 50%) / 0.22)",
    color: "hsl(var(--primary-foreground, 0 0% 99%) / 1)",
  },
  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    border: "1px solid hsl(var(--border, 0 0% 14.9%) / 1)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    lineHeight: 1,
    paddingInline: 4,
  },
  content: {
    padding: 12,
    overflow: "auto",
    flex: 1,
  },
};

export function PhotoWithInfoPanel({
  imageUrl,
  imageAlt,
  tabs,
  activeTabId,
  onTabChange,
  renderPhotoPane,
  onClosePanel,
}: PhotoWithInfoPanelProps): ReactElement {
  const firstTabId = tabs[0]?.id ?? "info";
  const [internalActive, setInternalActive] = useState<string>(firstTabId);
  const resolvedActiveTab = activeTabId ?? internalActive;

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === resolvedActiveTab) ?? tabs[0] ?? null,
    [tabs, resolvedActiveTab],
  );

  const selectTab = (nextTabId: string) => {
    if (!activeTabId) {
      setInternalActive(nextTabId);
    }
    onTabChange?.(nextTabId);
  };

  return (
    <div style={styles.root}>
      <div style={styles.photoPane}>
        {renderPhotoPane ? (
          renderPhotoPane()
        ) : imageUrl ? (
          <img src={imageUrl} alt={imageAlt ?? "Photo"} style={styles.image} />
        ) : (
          <div />
        )}
      </div>
      <div style={styles.sidePane}>
        <div style={styles.tabsHeader}>
          <div style={styles.tabsHeaderTabs}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                style={{
                  ...styles.tabButton,
                  ...(resolvedActiveTab === tab.id ? styles.tabButtonActive : {}),
                }}
              >
                <span>{tab.label}</span>
                {typeof tab.badgeCount === "number" ? (
                  <span style={styles.tabBadge}>{tab.badgeCount}</span>
                ) : null}
              </button>
            ))}
          </div>
          {onClosePanel ? (
            <button
              type="button"
              style={styles.closePanelButton}
              onClick={onClosePanel}
              title="Close info panel"
              aria-label="Close info panel"
            >
              <IconX />
            </button>
          ) : null}
        </div>
        <div style={styles.content}>{activeTab?.content ?? null}</div>
      </div>
    </div>
  );
}
