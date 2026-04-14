import { useEffect, useState, type ReactElement } from "react";
import type { PeopleWorkspaceOpenFacePhotoFn } from "@emk/media-viewer";
import { untaggedTabLog } from "../lib/untagged-tab-trace";
import { DesktopPeopleTagsListTab } from "./DesktopPeopleTagsListTab";
import { DesktopPeopleWorkspace } from "./DesktopPeopleWorkspace";
import { DesktopFaceClusterGrid } from "./DesktopFaceClusterGrid";
import { DesktopPeopleGroupsTab } from "./DesktopPeopleGroupsTab";

type PeopleTab = "people" | "tagged" | "untagged" | "groups";

const TAB_LABELS: Record<PeopleTab, string> = {
  people: "People",
  tagged: "Tagged faces",
  untagged: "Untagged faces",
  groups: "People groups",
};

export function DesktopPeopleSection({
  onOpenFacePhoto,
}: {
  onOpenFacePhoto: PeopleWorkspaceOpenFacePhotoFn;
}): ReactElement {
  const [activeTab, setActiveTab] = useState<PeopleTab>("people");

  useEffect(() => {
    untaggedTabLog("People section activeTab changed", { tab: activeTab });
    if (activeTab === "untagged") {
      untaggedTabLog("Untagged faces tab is active — DesktopFaceClusterGrid mounting");
    }
  }, [activeTab]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-border px-4 pt-2 md:px-8">
        {(["people", "groups", "tagged", "untagged"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              if (tab === "untagged") {
                untaggedTabLog('Tab button click "Untagged faces" (before setState)');
              }
              setActiveTab(tab);
            }}
            className={`relative px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {TAB_LABELS[tab]}
            {activeTab === tab ? (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
            ) : null}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === "people" ? (
          <DesktopPeopleTagsListTab />
        ) : activeTab === "tagged" ? (
          <DesktopPeopleWorkspace onOpenFacePhoto={onOpenFacePhoto} />
        ) : activeTab === "untagged" ? (
          <DesktopFaceClusterGrid onOpenFacePhoto={onOpenFacePhoto} />
        ) : (
          <DesktopPeopleGroupsTab />
        )}
      </div>
    </div>
  );
}
