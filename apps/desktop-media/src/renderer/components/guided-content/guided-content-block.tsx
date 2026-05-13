import type { ReactElement } from "react";
import type { GuidedContentBlock as GuidedContentBlockModel } from "./guided-slide-types";

export function GuidedContentBlockView({
  title,
  body,
  listItems,
}: GuidedContentBlockModel): ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h2>
      <p className="m-0 text-lg leading-relaxed text-muted-foreground md:text-xl md:leading-relaxed">{body}</p>
      {listItems != null && listItems.length > 0 ? (
        <ul className="m-0 list-none space-y-2.5 pl-0 text-lg text-foreground md:text-xl">
          {listItems.map((item) => (
            <li key={item} className="relative pl-8 before:absolute before:left-0 before:top-[0.55em] before:h-2 before:w-2 before:rounded-full before:bg-primary">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
