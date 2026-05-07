export async function saveWrongRotation(params: {
  mediaItemId: string;
  angleClockwise: 90 | 180 | 270;
}): Promise<void> {
  const result = await window.desktopApi.applyWrongRotationToMediaItem(params);
  if (!result.success) {
    throw new Error(result.error);
  }
}

export async function discardWrongRotation(params: {
  mediaItemId: string;
}): Promise<void> {
  const result = await window.desktopApi.dismissWrongRotationSuggestion(params);
  if (!result.success) {
    throw new Error(result.error);
  }
}
