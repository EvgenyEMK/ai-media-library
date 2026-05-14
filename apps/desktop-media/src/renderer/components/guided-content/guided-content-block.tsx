import type { ReactElement } from "react";
import type { GuidedContentBlock as GuidedContentBlockModel } from "./guided-slide-types";

export function GuidedContentBlockView({
  title,
  body,
  listItems,
  actionLinks,
  externalUrl,
  onActionLink,
}: GuidedContentBlockModel & {
  onActionLink?: (actionId: string) => void;
}): ReactElement {
  const showTitle = title.trim().length > 0;
  const showBody = body.trim().length > 0;
  const trimmedUrl = externalUrl?.trim() ?? "";
  const showUrl = trimmedUrl.length > 0;

  return (
    <section className="flex flex-col gap-3">
      {showTitle ? (
        <h2 className="m-0 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h2>
      ) : null}
      {showBody ? (
        <p className="m-0 whitespace-pre-line text-lg leading-relaxed text-muted-foreground md:text-xl md:leading-relaxed">
          {body}
        </p>
      ) : null}
      {showUrl ? (
        <p className="m-0 text-sm leading-relaxed text-muted-foreground md:text-base">
          <a
            href={trimmedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-mono text-primary underline-offset-2 hover:underline"
          >
            {trimmedUrl}
          </a>
        </p>
      ) : null}
      {listItems != null && listItems.length > 0 ? (
        <ul className="m-0 list-none space-y-2.5 pl-0 text-lg text-foreground md:text-xl">
          {listItems.map((item) => (
            <li
              key={item}
              className="relative pl-8 before:absolute before:left-0 before:top-[0.55em] before:h-2 before:w-2 before:rounded-full before:bg-primary"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {actionLinks != null && actionLinks.length > 0 && onActionLink ? (
        <div className="flex flex-wrap gap-2">
          {actionLinks.map((link) => (
            <button
              key={link.actionId}
              type="button"
              className="inline-flex h-9 items-center rounded-md border border-primary/40 bg-primary/10 px-3 text-sm font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => onActionLink(link.actionId)}
            >
              {link.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
