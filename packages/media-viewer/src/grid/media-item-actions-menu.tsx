"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";

interface ActionItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  onSelect?: () => void;
}

interface MediaItemActionsMenuProps {
  actions: ActionItem[];
  buttonTitle?: string;
  onOpenChange?: (open: boolean) => void;
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    position: "relative",
    display: "inline-flex",
  },
  button: {
    border: "1px solid rgba(255,255,255,0.3)",
    borderRadius: 8,
    width: 32,
    height: 32,
    background: "rgba(255,255,255,0.2)",
    color: "#e5e7eb",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    lineHeight: 1,
  },
  menu: {
    position: "absolute",
    top: 36,
    right: 0,
    minWidth: 220,
    padding: 6,
    borderRadius: 8,
    border: "1px solid #334155",
    background: "#0f172a",
    boxShadow: "0 10px 24px rgba(2, 6, 23, 0.5)",
    zIndex: 40,
  },
  item: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#e2e8f0",
    textAlign: "left",
    padding: "8px 10px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  },
  itemDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
};

export function MediaItemActionsMenu({
  actions,
  buttonTitle = "Open media item actions",
  onOpenChange,
}: MediaItemActionsMenuProps): ReactElement | null {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const setOpenAndNotify = (next: boolean): void => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenAndNotify(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenAndNotify(false);
      }
    };

    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      style={styles.wrap}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        style={styles.button}
        title={buttonTitle}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpenAndNotify(!open)}
      >
        ⋮
      </button>
      {open ? (
        <div style={styles.menu} role="menu">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              style={{
                ...styles.item,
                ...(action.disabled ? styles.itemDisabled : {}),
              }}
              disabled={action.disabled}
              onClick={() => {
                if (!action.disabled) {
                  action.onSelect?.();
                }
                setOpenAndNotify(false);
              }}
            >
              {action.icon ? `${action.icon} ` : ""}
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
