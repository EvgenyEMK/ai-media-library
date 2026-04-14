import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";

export function useMainPaneMenus(): {
  actionsMenuOpen: boolean;
  setActionsMenuOpen: Dispatch<SetStateAction<boolean>>;
  quickFiltersMenuOpen: boolean;
  setQuickFiltersMenuOpen: Dispatch<SetStateAction<boolean>>;
  actionsMenuWrapRef: RefObject<HTMLDivElement | null>;
  quickFiltersMenuWrapRef: RefObject<HTMLDivElement | null>;
} {
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [quickFiltersMenuOpen, setQuickFiltersMenuOpen] = useState(false);
  const actionsMenuWrapRef = useRef<HTMLDivElement | null>(null);
  const quickFiltersMenuWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!actionsMenuOpen && !quickFiltersMenuOpen) return;
    const handlePointerDown = (event: MouseEvent): void => {
      const targetNode = event.target as Node | null;
      if (!targetNode) return;
      if (actionsMenuWrapRef.current?.contains(targetNode)) return;
      if (quickFiltersMenuWrapRef.current?.contains(targetNode)) return;
      setActionsMenuOpen(false);
      setQuickFiltersMenuOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [actionsMenuOpen, quickFiltersMenuOpen]);

  return {
    actionsMenuOpen,
    setActionsMenuOpen,
    quickFiltersMenuOpen,
    setQuickFiltersMenuOpen,
    actionsMenuWrapRef,
    quickFiltersMenuWrapRef,
  };
}
