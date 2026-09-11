export type VideoKeyboardSeekInput = {
  altKey: boolean;
  ctrlKey: boolean;
  defaultPrevented: boolean;
  isComposing: boolean;
  isEditingTarget: boolean;
  key: string;
  metaKey: boolean;
  seekStepInSeconds: number;
  shiftKey: boolean;
};

export function getVideoKeyboardSeekOffset({
  altKey,
  ctrlKey,
  defaultPrevented,
  isComposing,
  isEditingTarget,
  key,
  metaKey,
  seekStepInSeconds,
  shiftKey,
}: VideoKeyboardSeekInput): number | null {
  if (
    defaultPrevented ||
    isComposing ||
    isEditingTarget ||
    altKey ||
    ctrlKey ||
    metaKey ||
    shiftKey ||
    !Number.isFinite(seekStepInSeconds) ||
    seekStepInSeconds <= 0
  ) {
    return null;
  }

  if (key === "ArrowLeft") return -seekStepInSeconds;
  if (key === "ArrowRight") return seekStepInSeconds;
  return null;
}
