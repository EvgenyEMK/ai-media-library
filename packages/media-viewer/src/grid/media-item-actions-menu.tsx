"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface ActionItem {
  id: string;
  label: string;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  disabled?: boolean;
  onSelect?: () => void;
  closeOnSelect?: boolean;
}

interface MediaItemActionsMenuProps {
  actions: ActionItem[];
  buttonTitle?: string;
  onOpenChange?: (open: boolean) => void;
  renderContent?: (context: { closeMenu: () => void }) => ReactNode;
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
    zIndex: 1000,
  },
  item: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#e2e8f0",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 15,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  itemLabel: {
    flex: "1 1 auto",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  itemTrailingIcon: {
    flex: "0 0 auto",
    display: "inline-flex",
    alignItems: "center",
    color: "#cbd5e1",
  },
  itemHover: {
    background: "#1e293b",
  },
  itemDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
};

function ArrowRightIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M6 3.5L10.5 8L6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MediaItemActionsMenu({
  actions,
  buttonTitle = "Open media item actions",
  onOpenChange,
  renderContent,
}: MediaItemActionsMenuProps): ReactElement | null {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<CSSProperties | null>(null);

  const setOpenAndNotify = (next: boolean): void => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const updateMenuPosition = (): void => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const rect = root.getBoundingClientRect();
    setMenuPosition({
      position: "fixed",
      top: rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    updateMenuPosition();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      if (menuRef.current || rootRef.current) {
        setOpenAndNotify(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenAndNotify(false);
      }
    };

    const handleReposition = () => updateMenuPosition();

    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  if (actions.length === 0 && !renderContent) {
    return null;
  }

  return (
    <div
      ref={rootRef}
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
      {open && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              style={{ ...styles.menu, ...menuPosition }}
              role="menu"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
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
                  onMouseEnter={(event) => {
                    if (!action.disabled) {
                      Object.assign(event.currentTarget.style, styles.itemHover);
                    }
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = styles.item.background as string;
                  }}
                  onClick={() => {
                    if (!action.disabled) {
                      action.onSelect?.();
                    }
                    if (action.closeOnSelect !== false) {
                      setOpenAndNotify(false);
                    }
                  }}
                >
                  {action.icon ? <span aria-hidden="true">{action.icon}</span> : null}
                  <span style={styles.itemLabel}>{action.label}</span>
                  {action.trailingIcon ? (
                    <span style={styles.itemTrailingIcon}>{action.trailingIcon}</span>
                  ) : null}
                </button>
              ))}
              {renderContent?.({ closeMenu: () => setOpenAndNotify(false) })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export { ArrowRightIcon as MediaItemActionsMenuArrowRightIcon };
