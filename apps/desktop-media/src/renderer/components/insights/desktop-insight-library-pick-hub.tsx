import type { ReactElement } from "react";
import { FolderOpen } from "lucide-react";
import { cn } from "../../lib/cn";

function libraryRootDisplayName(rootPath: string): string {
  const trimmed = rootPath.trim().replace(/[/\\]+$/, "");
  const parts = trimmed.split(/[/\\]+/).filter((s) => s.length > 0);
  return parts[parts.length - 1] ?? trimmed;
}

export function DesktopInsightLibraryPickHub({
  title,
  emptyMessage,
  libraryRoots,
  onPickLibrary,
}: {
  title: string;
  emptyMessage: string;
  libraryRoots: readonly string[];
  onPickLibrary: (folderPath: string) => void;
}): ReactElement {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <h1 className="m-0 text-3xl font-bold text-foreground md:text-4xl">{title}</h1>

      {libraryRoots.length === 0 ? (
        <p className="m-0 text-base text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {libraryRoots.map((rootPath) => (
            <li key={rootPath}>
              <button
                type="button"
                onClick={() => {
                  onPickLibrary(rootPath);
                }}
                title={rootPath}
                className={cn(
                  "flex w-full min-w-0 flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left shadow-none outline-none",
                  "transition-colors hover:border-primary/50 hover:bg-muted/60",
                )}
              >
                <span className="flex min-w-0 items-center gap-2 text-foreground">
                  <FolderOpen size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 truncate text-base font-medium">
                    {libraryRootDisplayName(rootPath)}
                  </span>
                </span>
                <span className="line-clamp-2 w-full break-all text-xs text-muted-foreground">{rootPath}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
