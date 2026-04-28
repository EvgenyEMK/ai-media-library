import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import type { DesktopMediaItemMetadata, FolderAiFailedFileItem } from "../../shared/ipc";
import { UI_TEXT } from "../lib/ui-text";
import { toFileUrl } from "./face-cluster-utils";

function formatResolution(meta: DesktopMediaItemMetadata | undefined): string | null {
  if (!meta || !meta.width || !meta.height) return null;
  return `Resolution: ${meta.width} x ${meta.height}`;
}

interface DesktopFolderAiFailedListProps {
  loading: boolean;
  error: string | null;
  items: FolderAiFailedFileItem[];
  metaByPath: Record<string, DesktopMediaItemMetadata>;
}

export function DesktopFolderAiFailedList({
  loading,
  error,
  items,
  metaByPath,
}: DesktopFolderAiFailedListProps): ReactElement {
  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-card">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : error ? (
        <p className="m-0 px-4 py-4 text-sm text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <p className="m-0 px-4 py-4 text-sm text-muted-foreground">
          {UI_TEXT.folderAiSummaryFailedListEmpty}
        </p>
      ) : (
        <div className="max-h-[65vh] overflow-auto">
          {items.map((item) => (
            <div
              key={`${item.path}-${item.failedAt ?? ""}`}
              className="border-b border-border px-4 py-2.5 last:border-b-0"
            >
              <div className="flex items-start gap-3">
                <img
                  src={toFileUrl(item.path)}
                  alt={item.name}
                  className="h-32 w-32 shrink-0 rounded object-cover"
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="m-0 break-all pb-1 text-sm text-foreground">{item.name}</p>
                  <p className="m-0 break-all pb-1 text-xs text-muted-foreground">{item.path}</p>
                  <p className="m-0 break-all pb-1 text-xs text-muted-foreground">
                    {formatResolution(metaByPath[item.path]) ?? "Resolution: -"}
                  </p>
                  {item.error ? (
                    <p className="m-0 break-all text-xs text-destructive">{item.error}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
