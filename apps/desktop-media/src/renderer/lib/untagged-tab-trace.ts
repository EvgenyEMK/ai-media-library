/** Prefix for optional People → Untagged faces troubleshooting (currently disabled). */
export const UNTAGGED_TAB_TRACE = "[emk:untagged-tab]";

// function lineForMain(message: string, data?: Record<string, unknown>): string {
//   if (data !== undefined && Object.keys(data).length > 0) {
//     return `${UNTAGGED_TAB_TRACE} ${message} ${JSON.stringify(data)}`;
//   }
//   return `${UNTAGGED_TAB_TRACE} ${message}`;
// }

/**
 * No-op: uncomment the block below to log `[emk:untagged-tab]` in DevTools and the main-process terminal.
 */
export function untaggedTabLog(_message: string, _data?: Record<string, unknown>): void {
  // const mainLine = lineForMain(message, data);
  // if (data !== undefined && Object.keys(data).length > 0) {
  //   console.log(`${UNTAGGED_TAB_TRACE} ${message}`, data);
  // } else {
  //   console.log(`${UNTAGGED_TAB_TRACE} ${message}`);
  // }
  // try {
  //   window.desktopApi?._logToMain?.(mainLine);
  // } catch {
  //   // ignore (non-Electron / tests)
  // }
}
