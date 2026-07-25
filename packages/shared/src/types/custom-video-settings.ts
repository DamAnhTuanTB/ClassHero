export interface CustomVideoSettings {
  isDisabled: boolean;
  startTimeInSeconds: number;
  endTimeCutInSeconds: number;
  introOverlayDurationInSeconds: number;
  pauseOverlayDurationInSeconds: number;
  seekStepInSeconds: number;
  hasLetterbox: boolean;
  letterboxHeightPercentage: number;
  hasWatermark: boolean;
}

export const DEFAULT_CUSTOM_VIDEO_SETTINGS: CustomVideoSettings = {
  isDisabled: false,
  startTimeInSeconds: 5,
  endTimeCutInSeconds: 22,
  introOverlayDurationInSeconds: 10,
  pauseOverlayDurationInSeconds: 4,
  seekStepInSeconds: 5,
  hasLetterbox: true,
  letterboxHeightPercentage: 8,
  hasWatermark: true,
};
