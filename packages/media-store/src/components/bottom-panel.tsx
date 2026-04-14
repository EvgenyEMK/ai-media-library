import { useMemo, type ReactNode } from "react";
import type { TaskProgress, TaskStatus } from "../types";

// ── Inline SVG icons (no external icon deps) ────────────────────

function IconChevronDown({ className }: { className?: string }): ReactNode {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconChevronUp({ className }: { className?: string }): ReactNode {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function IconX({ className }: { className?: string }): ReactNode {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function IconLoader({ className }: { className?: string }): ReactNode {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }): ReactNode {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// ── Status helpers ──────────────────────────────────────────────

function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case "running": return "var(--bottom-panel-running, #3b82f6)";
    case "completed": return "var(--bottom-panel-completed, #22c55e)";
    case "failed": return "var(--bottom-panel-failed, #ef4444)";
    case "cancelled": return "var(--bottom-panel-cancelled, #f59e0b)";
    default: return "var(--bottom-panel-idle, #6b7280)";
  }
}

function getStatusLabel(status: TaskStatus): string {
  switch (status) {
    case "idle": return "Idle";
    case "running": return "Running";
    case "completed": return "Completed";
    case "failed": return "Failed";
    case "cancelled": return "Cancelled";
  }
}

// ── Task tab component ──────────────────────────────────────────

interface TaskTabProps {
  task: TaskProgress;
  isActive: boolean;
  onClick: () => void;
}

function TaskTab({ task, isActive, onClick }: TaskTabProps): ReactNode {
  const progressPercent = task.totalCount > 0
    ? Math.min(100, Math.round((task.processedCount / task.totalCount) * 100))
    : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        border: "none",
        borderBottom: isActive ? "2px solid var(--bottom-panel-active-tab, #3b82f6)" : "2px solid transparent",
        background: "none",
        color: "inherit",
        cursor: "pointer",
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {task.status === "running" && <IconLoader className="bottom-panel-spinner" />}
      {task.status === "completed" && <IconCheck />}
      <span>{task.label}</span>
      {task.status === "running" && <span style={{ opacity: 0.7 }}>{progressPercent}%</span>}
    </button>
  );
}

// ── Task detail panel ───────────────────────────────────────────

interface TaskDetailProps {
  task: TaskProgress;
  onCancel?: (taskId: string) => void;
}

function TaskDetail({ task, onCancel }: TaskDetailProps): ReactNode {
  const progressPercent = task.totalCount > 0
    ? Math.min(100, Math.round((task.processedCount / task.totalCount) * 100))
    : 0;

  return (
    <div style={{ padding: "8px 12px", fontSize: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: getStatusColor(task.status),
        }} />
        <span style={{ fontWeight: 500 }}>{task.label}</span>
        <span style={{ opacity: 0.6 }}>{getStatusLabel(task.status)}</span>
        {task.status === "running" && onCancel && (
          <button
            type="button"
            onClick={() => onCancel(task.taskId)}
            style={{
              marginLeft: "auto",
              padding: "2px 8px",
              border: "1px solid currentColor",
              borderRadius: 3,
              background: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: 11,
              opacity: 0.7,
            }}
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div style={{
        height: 3,
        background: "var(--bottom-panel-track, rgba(128,128,128,0.2))",
        borderRadius: 2,
        overflow: "hidden",
        marginBottom: 4,
      }}>
        <div style={{
          height: "100%",
          width: `${progressPercent}%`,
          background: getStatusColor(task.status),
          borderRadius: 2,
          transition: "width 0.3s ease",
        }} />
      </div>

      <div style={{ display: "flex", gap: 12, opacity: 0.7 }}>
        <span>Processed: {task.processedCount}/{task.totalCount}</span>
        {task.errors > 0 && <span style={{ color: "var(--bottom-panel-failed, #ef4444)" }}>Errors: {task.errors}</span>}
        {task.averageSecondsPerItem !== null && (
          <span>Avg: {task.averageSecondsPerItem.toFixed(2)}s/item</span>
        )}
      </div>
    </div>
  );
}

// ── Main BottomPanel component ──────────────────────────────────

export interface BottomPanelProps {
  visible: boolean;
  collapsed: boolean;
  activeTaskId: string | null;
  tasks: Record<string, TaskProgress>;
  onToggleCollapsed: () => void;
  onHide: () => void;
  onSetActiveTask: (taskId: string) => void;
  onClearCompleted: () => void;
  onCancelTask?: (taskId: string) => void;
}

export function BottomPanel({
  visible,
  collapsed,
  activeTaskId,
  tasks,
  onToggleCollapsed,
  onHide,
  onSetActiveTask,
  onClearCompleted,
  onCancelTask,
}: BottomPanelProps): ReactNode {
  const taskList = useMemo(() => Object.values(tasks), [tasks]);
  const activeTask = activeTaskId ? tasks[activeTaskId] ?? null : null;
  const hasCompletedTasks = taskList.some(
    (t) => t.status === "completed" || t.status === "failed" || t.status === "cancelled",
  );

  if (!visible || taskList.length === 0) return null;

  return (
    <div
      className="bottom-panel"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: "var(--bottom-panel-bg, #1e1e2e)",
        color: "var(--bottom-panel-fg, #cdd6f4)",
        borderTop: "1px solid var(--bottom-panel-border, rgba(128,128,128,0.3))",
        fontSize: 12,
        fontFamily: "inherit",
      }}
    >
      {/* Tab bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        borderBottom: collapsed ? "none" : "1px solid var(--bottom-panel-border, rgba(128,128,128,0.15))",
        minHeight: 30,
      }}>
        <div style={{ display: "flex", flex: 1, overflow: "auto" }}>
          {taskList.map((task) => (
            <TaskTab
              key={task.taskId}
              task={task}
              isActive={task.taskId === activeTaskId}
              onClick={() => {
                onSetActiveTask(task.taskId);
                if (collapsed) onToggleCollapsed();
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2, paddingRight: 8 }}>
          {hasCompletedTasks && (
            <button
              type="button"
              onClick={onClearCompleted}
              title="Clear completed tasks"
              style={{
                padding: "2px 6px",
                border: "none",
                background: "none",
                color: "inherit",
                cursor: "pointer",
                fontSize: 11,
                opacity: 0.6,
              }}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand panel" : "Collapse panel"}
            style={{
              padding: 2,
              border: "none",
              background: "none",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            {collapsed ? <IconChevronUp /> : <IconChevronDown />}
          </button>
          <button
            type="button"
            onClick={onHide}
            title="Hide panel"
            style={{
              padding: 2,
              border: "none",
              background: "none",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <IconX />
          </button>
        </div>
      </div>

      {/* Detail area */}
      {!collapsed && activeTask && (
        <TaskDetail task={activeTask} onCancel={onCancelTask} />
      )}
    </div>
  );
}
