import { DOMParser as XmldomDOMParser, onErrorStopParsing } from "@xmldom/xmldom";

/** Minimal shape ExifReader expects for `options.domParser`. */
export type ExifReaderDomParser = {
  parseFromString(xml: string, mimeType: string): unknown;
};

/**
 * Returns a DOMParser usable by ExifReader for XMP (XML) in Node/Electron and browsers.
 * Browser: native `DOMParser`. Node/bundled main: `@xmldom/xmldom` (ExifReader's optional
 * `__non_webpack_require__` path is unreliable under Vite/Rollup).
 */
export function createExifReaderDomParser(): ExifReaderDomParser {
  if (typeof globalThis.DOMParser !== "undefined") {
    return new globalThis.DOMParser();
  }
  return new XmldomDOMParser({ onError: onErrorStopParsing }) as ExifReaderDomParser;
}
