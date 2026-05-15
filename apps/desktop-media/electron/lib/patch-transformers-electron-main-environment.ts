/**
 * @huggingface/transformers enables onnxruntime-node only when `apis.IS_NODE_ENV`
 * is true, where that flag is implemented as `process.release?.name === "node"`.
 * Electron's main process exposes Node APIs but sets `process.release.name` to
 * `"electron"`, so the library would otherwise pick onnxruntime-web and throw
 * `ReferenceError: window is not defined` during session creation.
 *
 * Call once before the first `import("@huggingface/transformers")` (see
 * `nomic-vision-embedder.ts`).
 */
export type TransformersProcessPatchTarget = Pick<NodeJS.Process, "versions" | "release">;

export function patchProcessReleaseForTransformersInElectronMain(
  proc: TransformersProcessPatchTarget = process,
): void {
  if (typeof proc === "undefined" || !proc.versions.electron) {
    return;
  }
  const release = proc.release as { name?: string } | undefined;
  if (release && release.name !== "node") {
    Object.defineProperty(release, "name", {
      configurable: true,
      enumerable: true,
      value: "node",
    });
  }
}
