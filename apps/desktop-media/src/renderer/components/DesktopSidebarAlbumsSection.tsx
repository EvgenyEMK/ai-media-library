import type { ReactElement } from "react";

const UI_TEXT = {
  compactLabel: "Albums",
  plannedTitle: "Albums section is planned for desktop.",
  plannedDescription:
    "Existing album browser and management already lives in web-media. This sidebar section is prepared as a shared navigation target so the same menu can be reused in both apps.",
} as const;

export function DesktopSidebarAlbumsSection({ collapsed }: { collapsed: boolean }): ReactElement {
  if (collapsed) {
    return <div className="text-xs text-muted-foreground">{UI_TEXT.compactLabel}</div>;
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">{UI_TEXT.plannedTitle}</p>
      <p>{UI_TEXT.plannedDescription}</p>
    </div>
  );
}
