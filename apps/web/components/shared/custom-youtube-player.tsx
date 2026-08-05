"use client";

import React, {
  useCallback,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Play,
  Pause,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Gauge,
  RotateCcw,
  RotateCw,
  Check,
  Subtitles,
  GraduationCap,
} from "lucide-react";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";

const STUDENT_START_ANIMATION_FALLBACK_MS = 1300;
const YOUTUBE_PLAYER_INIT_TIMEOUT_MS = 12_000;
const STUDENT_START_ANIMATION_NAMES = new Set([
  "student-video-loading-mascot",
  "student-video-loading-mascot-reduced",
]);

export interface CustomVideoSettings {
  isDisabled: boolean;
  startTimeInSeconds: number;
  endTimeCutInSeconds: number;
  introOverlayDurationInSeconds: number;
  pauseOverlayDurationInSeconds: number;
  seekStepInSeconds: number;
  letterboxTopPercentage: number;
  letterboxRightPercentage: number;
  letterboxBottomPercentage: number;
  letterboxLeftPercentage: number;
  hasWatermark: boolean;
  chapters?: { time: number; title: string }[];
  transcriptLanguage?: string;
  transcript?: VideoTranscriptSegment[];

  // Backward compatibility
  hasLetterbox?: boolean;
  letterboxHeightPercentage?: number;
}

export interface VideoTranscriptSegment {
  endTime?: number;
  time: number;
  text: string;
}

export const DEFAULT_CUSTOM_VIDEO_SETTINGS: CustomVideoSettings = {
  isDisabled: false,
  startTimeInSeconds: 5,
  endTimeCutInSeconds: 22,
  introOverlayDurationInSeconds: 10,
  pauseOverlayDurationInSeconds: 4,
  seekStepInSeconds: 5,
  letterboxTopPercentage: 0,
  letterboxRightPercentage: 0,
  letterboxBottomPercentage: 0,
  letterboxLeftPercentage: 0,
  hasWatermark: true,
};

export interface VideoChapter {
  time: number; // Thời gian tính bằng giây
  title: string;
}

interface CustomYoutubePlayerProps {
  videoUrl: string;
  settings?: CustomVideoSettings | null;
  title?: string;
  startButtonVariant?: "default" | "student";
  onError?: () => void;
  onPlaybackTimeChange?: (timeInSeconds: number) => void;
}

export interface CustomYoutubePlayerHandle {
  playFromPlaybackTime: (timeInSeconds: number) => boolean;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const CustomYoutubePlayer = forwardRef<
  CustomYoutubePlayerHandle,
  CustomYoutubePlayerProps
>(function CustomYoutubePlayer(
  {
    videoUrl,
    settings,
    title,
    startButtonVariant = "default",
    onError,
    onPlaybackTimeChange,
  },
  ref,
) {
  const rawSettings = { ...DEFAULT_CUSTOM_VIDEO_SETTINGS, ...settings };
  const chapters = settings?.chapters || [];

  // Xử lý giá trị mặc định của viền đen
  const bottomPercent =
    settings?.letterboxBottomPercentage ?? rawSettings.letterboxBottomPercentage;
  const currentSettings = {
    ...rawSettings,
    letterboxBottomPercentage: bottomPercent,
  };
  const shouldShowWatermark =
    startButtonVariant === "student" || currentSettings.hasWatermark;

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playerNodeRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isFirstPlayStarted, setIsFirstPlayStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showCaptions, setShowCaptions] = useState(false);
  const [windowSize, setWindowSize] = useState({ w: 0, h: 0 });
  const [isPortrait, setIsPortrait] = useState(false);
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);

  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const firstStartUiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const studentStartFallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startRequestedAtRef = useRef(0);
  const durationRef = useRef<number>(0);
  const isFirstPlayStartedRef = useRef<boolean>(false);
  const isWaitingForStudentStartAnimationRef = useRef(false);
  const isMobileTimelineDraggingRef = useRef(false);

  const isPhoneViewport = windowSize.w > 0 && windowSize.w < 640;

  const updateCurrentTime = useCallback(
    (timeInSeconds: number) => {
      const safeTime = Number.isFinite(timeInSeconds) ? Math.max(0, timeInSeconds) : 0;
      setCurrentTime(safeTime);
      onPlaybackTimeChange?.(safeTime);
    },
    [onPlaybackTimeChange],
  );

  const hideOverlayDelayed = () => {
    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    overlayTimeoutRef.current = setTimeout(() => {
      setShowOverlay(false);
    }, currentSettings.pauseOverlayDurationInSeconds * 1000);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isNative = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsNativeFullscreen((prev) => {
        if (prev && !isNative) setIsFullscreen(false);
        else if (!prev && isNative) setIsFullscreen(true);
        return isNative;
      });
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const updateSize = () => {
      setWindowSize({ w: window.innerWidth, h: window.innerHeight });
      setIsPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 768);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    if (isFullscreen && !isNativeFullscreen) {
      document.body.classList.add("overflow-hidden");
      document.documentElement.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
      document.documentElement.classList.remove("overflow-hidden");
    }

    return () => {
      document.body.classList.remove("overflow-hidden");
      document.documentElement.classList.remove("overflow-hidden");
    };
  }, [isFullscreen, isNativeFullscreen]);

  useEffect(() => {
    if (isPlaying) {
      hideOverlayDelayed();
    } else {
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
      setShowOverlay(true);
    }
    return () => {
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    };
  }, [isPlaying]);

  // Parse video ID
  const getVideoId = (url: string) => {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes("youtube.com")) {
        return urlObj.searchParams.get("v") || "";
      } else if (urlObj.hostname.includes("youtu.be")) {
        return urlObj.pathname.slice(1);
      }
    } catch (e) {}
    return "";
  };

  const videoId = getVideoId(videoUrl);
  const handlePlayerError = useCallback(() => {
    onError?.();
  }, [onError]);

  useEffect(() => {
    if (!videoId && videoUrl.trim()) {
      handlePlayerError();
    }
  }, [handlePlayerError, videoId, videoUrl]);

  useEffect(() => {
    if (!videoId) return;
    if (currentSettings.isDisabled) return;

    let isMounted = true;
    let checkTimeout: NodeJS.Timeout;
    const initFailureTimeout = setTimeout(() => {
      if (isMounted && (!window.YT || !window.YT.Player)) {
        handlePlayerError();
      }
    }, YOUTUBE_PLAYER_INIT_TIMEOUT_MS);

    const tryInitPlayer = () => {
      if (window.YT && window.YT.Player) {
        clearTimeout(initFailureTimeout);
        if (isMounted) initPlayer();
      } else {
        checkTimeout = setTimeout(tryInitPlayer, 100);
      }
    };

    // Load Youtube API
    if (!window.YT || !window.YT.Player) {
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }
      tryInitPlayer();
    } else {
      initPlayer();
    }

    return () => {
      isMounted = false;
      if (checkTimeout) clearTimeout(checkTimeout);
      clearTimeout(initFailureTimeout);
      if (firstStartUiTimeoutRef.current) {
        clearTimeout(firstStartUiTimeoutRef.current);
        firstStartUiTimeoutRef.current = null;
      }
      if (studentStartFallbackTimeoutRef.current) {
        clearTimeout(studentStartFallbackTimeoutRef.current);
        studentStartFallbackTimeoutRef.current = null;
      }
      isWaitingForStudentStartAnimationRef.current = false;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
    };
  }, [currentSettings.isDisabled, handlePlayerError, videoId]);

  const initPlayer = () => {
    if (!playerNodeRef.current || !window.YT) return;

    playerRef.current = new window.YT.Player(playerNodeRef.current, {
      videoId: videoId,
      playerVars: {
        controls: 0,
        rel: 0,
        modestbranding: 1,
        disablekb: 1,
        start: currentSettings.startTimeInSeconds,
        fs: 0,
        playsinline: 1,
        iv_load_policy: 3,
        cc_load_policy: 3, // 3 is an undocumented trick to suppress captions
      },
      events: {
        onReady: (event: any) => {
          // Ép ẩn phụ đề mặc định
          try {
            if (typeof event.target.unloadModule === "function") {
              event.target.unloadModule("captions");
            }
            if (typeof event.target.setOption === "function") {
              event.target.setOption("captions", "track", {});
            }
          } catch (e) {}

          const rawDuration = event.target.getDuration();
          if (rawDuration > 0) {
            const validDuration = Math.max(
              0,
              rawDuration -
                currentSettings.startTimeInSeconds -
                currentSettings.endTimeCutInSeconds,
            );
            setDuration(validDuration);
            durationRef.current = rawDuration;
          }
          setVolume(event.target.getVolume() || 100);
          setIsMuted(event.target.isMuted());
          setIsReady(true);
        },
        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            isWaitingForStudentStartAnimationRef.current = false;
            if (studentStartFallbackTimeoutRef.current) {
              clearTimeout(studentStartFallbackTimeoutRef.current);
              studentStartFallbackTimeoutRef.current = null;
            }
            setIsPlaying(true);
            if (!isFirstPlayStartedRef.current) {
              isFirstPlayStartedRef.current = true;

              const revealFirstPlay = () => {
                firstStartUiTimeoutRef.current = null;
                setIsFirstPlayStarted(true);
                setIsStarting(false);
              };
              const minimumLoadingTime = startButtonVariant === "student" ? 1200 : 0;
              const loadingElapsed = Date.now() - startRequestedAtRef.current;
              const remainingLoadingTime = Math.max(
                0,
                minimumLoadingTime - loadingElapsed,
              );

              if (remainingLoadingTime > 0) {
                firstStartUiTimeoutRef.current = setTimeout(
                  revealFirstPlay,
                  remainingLoadingTime,
                );
              } else {
                revealFirstPlay();
              }

              // Ép ẩn phụ đề lần nữa khi video thực sự bắt đầu phát (vì lúc onReady có thể YT chưa load xong module phụ đề)
              try {
                if (typeof event.target.unloadModule === "function") {
                  event.target.unloadModule("captions");
                  event.target.unloadModule("cc");
                }
                if (typeof event.target.setOption === "function") {
                  event.target.setOption("captions", "track", {});
                }
              } catch (e) {}
            } else if (!firstStartUiTimeoutRef.current) {
              setIsStarting(false);
            }
            setIsReady(true); // Fallback: nếu onReady không gọi được mà video vẫn play
          } else {
            setIsPlaying(false);
          }

          if (event.data === window.YT.PlayerState.ENDED) {
            playerRef.current.seekTo(
              durationRef.current - currentSettings.endTimeCutInSeconds,
              true,
            );
            playerRef.current.pauseVideo();
          }
        },
        onError: () => {
          isWaitingForStudentStartAnimationRef.current = false;
          if (studentStartFallbackTimeoutRef.current) {
            clearTimeout(studentStartFallbackTimeoutRef.current);
            studentStartFallbackTimeoutRef.current = null;
          }
          setIsStarting(false);
          setIsPlaying(false);
          handlePlayerError();
        },
      },
    });
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && playerRef.current) {
      interval = setInterval(() => {
        if (!playerRef.current || typeof playerRef.current.getCurrentTime !== "function")
          return;

        const time = playerRef.current.getCurrentTime();
        if (time < currentSettings.startTimeInSeconds) {
          playerRef.current.seekTo(currentSettings.startTimeInSeconds, true);
        }
        if (
          time > durationRef.current - currentSettings.endTimeCutInSeconds &&
          durationRef.current > 0
        ) {
          playerRef.current.seekTo(
            durationRef.current - currentSettings.endTimeCutInSeconds,
            true,
          );
          playerRef.current.pauseVideo();
          setIsPlaying(false);
        }
        updateCurrentTime(time - currentSettings.startTimeInSeconds);
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, updateCurrentTime]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!progressBarRef.current || !playerRef.current || duration === 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const rawPosition = (e.clientX - rect.left) / rect.width;
    const pos = Math.max(0, Math.min(1, rawPosition));
    const newTime = pos * duration;
    playerRef.current.seekTo(currentSettings.startTimeInSeconds + newTime, true);
    updateCurrentTime(newTime);
  };

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPhoneViewport || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    setHoverPercent(Math.max(0, Math.min(1, pos)) * 100);
  };

  const handleProgressTouchStart = (e: React.TouchEvent<HTMLInputElement>) => {
    isMobileTimelineDraggingRef.current = false;

    if (!isPhoneViewport) {
      setHoverPercent(Number(e.currentTarget.value));
    }
  };

  const handleProgressTouchMove = (e: React.TouchEvent<HTMLInputElement>) => {
    if (!isPhoneViewport || !progressBarRef.current) return;

    const touch = e.touches[0];
    if (!touch) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (touch.clientX - rect.left) / rect.width;
    isMobileTimelineDraggingRef.current = true;
    setHoverPercent(Math.max(0, Math.min(1, pos)) * 100);
  };

  const handleProgressTouchEnd = () => {
    isMobileTimelineDraggingRef.current = false;
    setHoverPercent(null);
  };

  const handlePlayPause = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const handleOverlayClick = () => {
    const hasPreciseHoverPointer = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;

    if (hasPreciseHoverPointer) {
      handlePlayPause();
      return;
    }

    if (!showOverlay) {
      setShowOverlay(true);
      hideOverlayDelayed();
    } else {
      handlePlayPause();
    }
  };

  const playVideoAfterStudentStartAnimation = () => {
    if (!isWaitingForStudentStartAnimationRef.current) return;

    isWaitingForStudentStartAnimationRef.current = false;
    if (studentStartFallbackTimeoutRef.current) {
      clearTimeout(studentStartFallbackTimeoutRef.current);
      studentStartFallbackTimeoutRef.current = null;
    }

    if (!playerRef.current) {
      setIsStarting(false);
      return;
    }

    playerRef.current.playVideo();
  };

  const handleStudentStartAnimationEnd = (
    event: React.AnimationEvent<HTMLSpanElement>,
  ) => {
    if (
      event.currentTarget !== event.target ||
      !STUDENT_START_ANIMATION_NAMES.has(event.animationName)
    ) {
      return;
    }

    playVideoAfterStudentStartAnimation();
  };

  const handleStart = () => {
    if (isStarting || !isReady || !playerRef.current) return;

    startRequestedAtRef.current = Date.now();
    setIsStarting(true);
    setShowOverlay(true);
    hideOverlayDelayed();

    if (startButtonVariant === "student") {
      isWaitingForStudentStartAnimationRef.current = true;
      studentStartFallbackTimeoutRef.current = setTimeout(
        playVideoAfterStudentStartAnimation,
        STUDENT_START_ANIMATION_FALLBACK_MS,
      );
      return;
    }

    playerRef.current.playVideo();
  };

  useImperativeHandle(
    ref,
    () => ({
      playFromPlaybackTime: (timeInSeconds: number) => {
        if (
          currentSettings.isDisabled ||
          !isReady ||
          !playerRef.current ||
          !Number.isFinite(timeInSeconds)
        ) {
          return false;
        }

        const playbackDuration =
          durationRef.current > 0
            ? durationRef.current -
              currentSettings.startTimeInSeconds -
              currentSettings.endTimeCutInSeconds
            : timeInSeconds;
        const targetPlaybackTime = Math.max(0, Math.min(timeInSeconds, playbackDuration));
        const targetSourceTime = currentSettings.startTimeInSeconds + targetPlaybackTime;

        playerRef.current.seekTo(targetSourceTime, true);
        updateCurrentTime(targetPlaybackTime);
        setIsStarting(true);
        setShowOverlay(true);
        hideOverlayDelayed();
        playerRef.current.playVideo();

        return true;
      },
    }),
    [
      currentSettings.endTimeCutInSeconds,
      currentSettings.isDisabled,
      currentSettings.pauseOverlayDurationInSeconds,
      currentSettings.startTimeInSeconds,
      isReady,
      updateCurrentTime,
    ],
  );

  const handleToggleMute = () => {
    if (!playerRef.current) return;
    if (isMuted) {
      if (typeof playerRef.current.unMute === "function") playerRef.current.unMute();
      setIsMuted(false);
      if (volume === 0) {
        if (typeof playerRef.current.setVolume === "function")
          playerRef.current.setVolume(100);
        setVolume(100);
      }
    } else {
      if (typeof playerRef.current.mute === "function") playerRef.current.mute();
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    if (!playerRef.current) return;
    if (typeof playerRef.current.setVolume === "function")
      playerRef.current.setVolume(newVolume);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      if (typeof playerRef.current.unMute === "function") playerRef.current.unMute();
      setIsMuted(false);
    } else if (newVolume === 0 && !isMuted) {
      if (typeof playerRef.current.mute === "function") playerRef.current.mute();
      setIsMuted(true);
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (playerRef.current) {
      playerRef.current.setPlaybackRate(rate);
    }
  };

  const handleSkipBackward = () => {
    if (!playerRef.current) return;
    const actualCurrentTime = currentTime + currentSettings.startTimeInSeconds;
    let newTime = actualCurrentTime - currentSettings.seekStepInSeconds;
    if (newTime < currentSettings.startTimeInSeconds) {
      newTime = currentSettings.startTimeInSeconds;
    }
    playerRef.current.seekTo(newTime, true);
    updateCurrentTime(newTime - currentSettings.startTimeInSeconds);
  };

  const handleSkipForward = () => {
    if (!playerRef.current) return;
    const actualCurrentTime = currentTime + currentSettings.startTimeInSeconds;
    let newTime = actualCurrentTime + currentSettings.seekStepInSeconds;
    if (newTime > durationRef.current - currentSettings.endTimeCutInSeconds) {
      newTime = durationRef.current - currentSettings.endTimeCutInSeconds;
    }
    playerRef.current.seekTo(newTime, true);
    updateCurrentTime(newTime - currentSettings.startTimeInSeconds);
  };

  const formatTime = (seconds: number) => {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const m = Math.floor(safeSeconds / 60);
    const s = Math.floor(safeSeconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    const elem = containerRef.current as any;
    const doc = document as any;

    const canNativeFs = !!(
      doc.fullscreenEnabled ||
      doc.webkitFullscreenEnabled ||
      doc.mozFullScreenEnabled ||
      doc.msFullscreenEnabled
    );

    // Bỏ qua native fullscreen trên thiết bị di động (portrait) để ép dùng CSS rotate-90 xoay ngang video
    const shouldUseNative = canNativeFs && !isPortrait;

    if (!isFullscreen) {
      setIsFullscreen(true);
      if (shouldUseNative) {
        const reqFs =
          elem.requestFullscreen ||
          elem.webkitRequestFullscreen ||
          elem.mozRequestFullScreen ||
          elem.msRequestFullscreen;
        if (reqFs) {
          try {
            reqFs.call(elem);
          } catch (err) {}
        }
      }
    } else {
      setIsFullscreen(false);
      if (canNativeFs) {
        const exitFs =
          doc.exitFullscreen ||
          doc.webkitExitFullscreen ||
          doc.mozCancelFullScreen ||
          doc.msExitFullscreen;
        const isNativeFs = !!(
          doc.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.mozFullScreenElement ||
          doc.msFullscreenElement
        );
        if (exitFs && isNativeFs) {
          try {
            exitFs.call(doc);
          } catch (err) {}
        }
      }
    }
  };

  const handleToggleCaptions = () => {
    const p = playerRef.current as any;
    if (!p) return;

    if (showCaptions) {
      if (typeof p.unloadModule === "function") p.unloadModule("captions");
      if (typeof p.setOption === "function") p.setOption("captions", "track", {});
      setShowCaptions(false);
    } else {
      if (typeof p.loadModule === "function") p.loadModule("captions");
      // Mặc định gọi ngôn ngữ tiếng Việt (vi) hoặc tiếng Anh (en) tuỳ cấu hình video,
      // truyền {} rỗng ở setOption thường YT tự động chọn ngôn ngữ tốt nhất.
      if (typeof p.setOption === "function")
        p.setOption("captions", "track", { languageCode: "vi" });
      setShowCaptions(true);
    }
  };

  if (!videoId) {
    return (
      <div className="w-full aspect-video flex items-center justify-center bg-black text-white rounded-lg">
        Link Video không đúng định dạng Youtube
      </div>
    );
  }

  const progressPercentage = duration
    ? Math.max(0, Math.min(100, (currentTime / duration) * 100))
    : 0;

  const shouldShowIntro = currentTime < currentSettings.introOverlayDurationInSeconds;
  if (currentSettings.isDisabled) {
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    return (
      <div className="w-full aspect-video rounded-lg overflow-hidden border border-[var(--theme-border)] bg-black relative">
        <iframe
          src={embedUrl}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onError={handlePlayerError}
        ></iframe>
      </div>
    );
  }

  const isPseudoPortrait = isFullscreen && !isNativeFullscreen && isPortrait;

  let innerWidth: string | undefined = undefined;
  let innerHeight: string | undefined = undefined;

  if (isFullscreen) {
    const parentW = isPseudoPortrait ? windowSize.h : windowSize.w;
    const parentH = isPseudoPortrait ? windowSize.w : windowSize.h;

    if (parentW && parentH) {
      if (parentW / parentH > 16 / 9) {
        innerHeight = `${parentH}px`;
        innerWidth = `${(parentH * 16) / 9}px`;
      } else {
        innerWidth = `${parentW}px`;
        innerHeight = `${(parentW * 9) / 16}px`;
      }
    }
  } else {
    innerWidth = "100%";
    innerHeight = "100%";
  }

  return (
    <div
      ref={containerRef}
      className={`bg-black group flex flex-col items-center justify-center overflow-hidden ${isFullscreen ? (isPseudoPortrait ? "fixed z-[99999] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90" : "fixed inset-0 z-[99999] w-full h-full") : "relative z-0 w-full aspect-video sm:rounded-lg border-y sm:border border-[var(--theme-border)]"}`}
      style={
        isPseudoPortrait
          ? { width: `${windowSize.h}px`, height: `${windowSize.w}px` }
          : undefined
      }
    >
      <div
        className="relative flex-none w-full h-full overflow-hidden"
        style={{ width: innerWidth, height: innerHeight }}
      >
        {/* Watermark Logo ClassHero */}
        {shouldShowWatermark && (
          <div
            className={`absolute z-40 flex items-center rounded-lg bg-white/10 shadow-[0_4px_14px_rgba(0,0,0,0.18)] ring-1 ring-white/15 backdrop-blur-sm pointer-events-none transition-all duration-300 ${
              isFullscreen
                ? "top-4 right-4 lg:top-8 lg:right-8 px-3 py-2 lg:px-4 lg:py-2.5 scale-100 lg:scale-110 origin-top-right"
                : "top-2 right-2 lg:top-4 lg:right-4 px-2 py-1 lg:px-3 lg:py-1.5 scale-75 lg:scale-100 origin-top-right"
            }`}
          >
            <ClassHeroLogo
              alt=""
              className="h-7 max-w-[6.25rem] lg:h-8 lg:max-w-[7.5rem]"
              priority
              sizes="8rem"
            />
          </div>
        )}

        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden sm:rounded-lg">
          <div ref={playerNodeRef} className="w-full h-full" />
        </div>

        {/* Các viền đen cố định che mép video */}
        {currentSettings.letterboxTopPercentage > 0 && (
          <div
            className="absolute top-0 left-0 right-0 bg-black pointer-events-none z-10"
            style={{ height: `${currentSettings.letterboxTopPercentage}%` }}
          />
        )}
        {currentSettings.letterboxBottomPercentage > 0 && (
          <div
            className="absolute bottom-0 left-0 right-0 bg-black pointer-events-none z-10"
            style={{ height: `${currentSettings.letterboxBottomPercentage}%` }}
          />
        )}
        {currentSettings.letterboxLeftPercentage > 0 && (
          <div
            className="absolute top-0 bottom-0 left-0 bg-black pointer-events-none z-10"
            style={{ width: `${currentSettings.letterboxLeftPercentage}%` }}
          />
        )}
        {currentSettings.letterboxRightPercentage > 0 && (
          <div
            className="absolute top-0 bottom-0 right-0 bg-black pointer-events-none z-10"
            style={{ width: `${currentSettings.letterboxRightPercentage}%` }}
          />
        )}

        {/* Màn hình chờ đen tuyền che toàn bộ ảnh nền mặc định của Youtube */}
        {!isFirstPlayStarted && (
          <button
            type="button"
            disabled={!isReady || isStarting}
            className={`absolute inset-0 z-30 bg-black flex flex-col items-center justify-center group/start sm:rounded-lg overflow-hidden ${
              isReady && !isStarting ? "cursor-pointer" : ""
            }`}
            onClick={handleStart}
          >
            <div className="flex h-32 flex-col items-center justify-center transition-none sm:h-44 lg:h-48">
              {isStarting && startButtonVariant === "student" ? (
                <div
                  key="student-starting"
                  role="status"
                  aria-live="polite"
                  className="w-[min(76vw,17rem)] px-2 py-2 text-left sm:w-80 sm:px-3 sm:py-3 lg:w-[26rem] lg:px-4"
                >
                  <div className="text-center">
                    <span className="text-sm font-black text-white sm:text-base lg:text-lg">
                      Sẵn sàng vào học nhé!
                    </span>
                  </div>

                  <span className="relative mt-3 block h-2.5 rounded-full bg-white/10 ring-1 ring-white/15 sm:mt-4 sm:h-3 lg:mt-5">
                    <span className="student-video-loading-fill absolute inset-y-0 left-0 w-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-500 shadow-[0_0_14px_rgba(56,189,248,0.65)]" />
                    <span
                      aria-hidden="true"
                      className="student-video-loading-mascot absolute left-0 top-1/2 z-10 grid h-10 w-10 place-items-center text-[35px] leading-none drop-shadow-[0_3px_4px_rgba(14,165,233,0.7)] sm:text-[36px] lg:h-11 lg:w-11 lg:text-[40px]"
                      onAnimationEnd={handleStudentStartAnimationEnd}
                    >
                      <span className="student-video-loading-rocket">🚀</span>
                    </span>
                  </span>
                </div>
              ) : !isReady || isStarting ? (
                <div
                  key="connecting"
                  aria-hidden="true"
                  className={`relative h-16 w-44 sm:h-20 sm:w-60 ${
                    isStarting ? "" : "mb-3 sm:mb-5"
                  }`}
                >
                  <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-[0_6px_20px_rgba(139,92,246,0.22)] sm:h-20 sm:w-20">
                    <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(196,181,253,0.12),rgb(196,181,253),rgb(56,189,248),rgba(196,181,253,0.12))] motion-safe:animate-[spin_1.5s_linear_infinite]" />
                    <span className="absolute inset-[3px] rounded-full bg-[#211638]" />
                    <GraduationCap
                      className="relative z-10 h-9 w-9 text-violet-200 sm:h-11 sm:w-11"
                      strokeWidth={1.9}
                    />
                  </span>
                </div>
              ) : startButtonVariant === "student" ? (
                <div
                  key="student-ready"
                  className="relative mb-3 h-20 w-20 sm:mb-5 sm:h-28 sm:w-28"
                >
                  <span className="absolute -inset-5 rounded-full bg-sky-500/20 blur-2xl transition duration-300 group-hover/start:bg-violet-500/25" />
                  <span className="absolute -inset-2 rounded-full border-2 border-dashed border-cyan-300/70 transition-transform duration-700 group-hover/start:rotate-45 motion-safe:animate-[spin_12s_linear_infinite]" />
                  <span className="absolute inset-0 rotate-6 rounded-[42%_58%_55%_45%/48%_42%_58%_52%] bg-gradient-to-br from-cyan-300 via-sky-500 to-violet-600 shadow-[0_8px_0_#075985] transition duration-300 group-hover/start:rotate-12 group-hover/start:scale-105 group-active/start:translate-y-1 group-active/start:shadow-[0_4px_0_#075985]" />
                  <span className="absolute inset-2 grid place-items-center rounded-full border-4 border-white/70 bg-white shadow-inner shadow-sky-200 sm:inset-3">
                    <Play className="ml-1 h-8 w-8 fill-sky-500 text-sky-500 sm:h-11 sm:w-11" />
                  </span>
                </div>
              ) : (
                <div
                  key="default-ready"
                  className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-[var(--theme-primary)] flex items-center justify-center mb-2 sm:mb-4 group-hover/start:scale-110 transition-transform shadow-lg shadow-[var(--theme-primary)]/30"
                >
                  <Play className="h-6 w-6 sm:h-10 sm:w-10 text-white fill-current ml-0.5 sm:ml-1" />
                </div>
              )}
              {!isStarting && (
                <span className="text-white/80 font-medium text-sm sm:text-lg">
                  {isReady ? "Nhấn để bắt đầu học" : "Đang kết nối tới Giáo viên"}
                </span>
              )}
            </div>
          </button>
        )}

        {/* Màn hình Intro che video trong 10 giây đầu tiên của trục thời gian ảo */}
        <div
          className={`absolute inset-0 z-20 bg-black flex flex-col items-center justify-center px-6 sm:px-10 pointer-events-none sm:rounded-lg overflow-hidden ${
            shouldShowIntro ? "opacity-100" : "opacity-0 transition-opacity duration-1000"
          }`}
        >
          <span className="text-white font-semibold text-sm sm:text-xl uppercase tracking-[0.2em] opacity-80 animate-pulse">
            {title || "Video Bài Giảng"}
          </span>
        </div>

        {/* Invisible overlay to block interacting directly with the iframe and handle clicks for play/pause */}
        <div
          className="absolute inset-0 z-10 cursor-pointer"
          onClick={handleOverlayClick}
        ></div>

        {/* Dải băng đen che Tiêu đề của Youtube khi Pause */}
        {isFirstPlayStarted && showOverlay && (
          <div className="absolute top-0 left-0 w-full h-[50px] sm:h-[60px] bg-black z-10 flex items-center px-2 sm:px-4 pointer-events-none transition-opacity duration-300">
            <span className="text-white/70 font-semibold text-xs sm:text-sm line-clamp-1">
              {title || "Video bài giảng"}
            </span>
          </div>
        )}

        {/* Dải băng đen che các icon Share/Watch Later/More Videos của Youtube ở dưới cùng khi Pause */}
        {isFirstPlayStarted && showOverlay && (
          <div className="absolute bottom-0 left-0 w-full h-[45px] sm:h-[60px] bg-black z-10 pointer-events-none transition-opacity duration-300"></div>
        )}

        {/* Control bar */}
        {isFirstPlayStarted && (
          <div
            className={`absolute bottom-0 left-0 right-0 p-2 sm:p-4 bg-gradient-to-t from-black/80 to-transparent z-50 transition-opacity duration-300 ${!isPlaying || isStarting || showOverlay ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          >
            {/* Progress Bar */}
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 w-full">
              <span className="text-white text-[11px] sm:text-[13px] font-bold w-9 sm:w-11 text-right">
                {formatTime(currentTime)}
              </span>
              <div
                className="flex-1 relative h-4 sm:h-5 group/slider cursor-pointer flex items-center"
                ref={progressBarRef}
                onClick={handleProgressClick}
                onMouseMove={handleProgressHover}
                onMouseLeave={() => setHoverPercent(null)}
              >
                {/* Input range for mobile touch support (invisible) */}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progressPercentage}
                  onTouchStart={handleProgressTouchStart}
                  onTouchMove={handleProgressTouchMove}
                  onTouchEnd={handleProgressTouchEnd}
                  onTouchCancel={handleProgressTouchEnd}
                  onMouseDown={(e) => {
                    if (!isPhoneViewport) {
                      setHoverPercent(Number(e.currentTarget.value));
                    }
                  }}
                  onMouseUp={() => setHoverPercent(null)}
                  onChange={(e) => {
                    const pos = Number(e.target.value) / 100;
                    const newTime = pos * duration;
                    if (playerRef.current)
                      playerRef.current.seekTo(
                        currentSettings.startTimeInSeconds + newTime,
                        true,
                      );
                    updateCurrentTime(newTime);
                    if (!isPhoneViewport || isMobileTimelineDraggingRef.current) {
                      setHoverPercent(pos * 100);
                    } else {
                      setHoverPercent(null);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                  style={{
                    touchAction: "none",
                  }}
                />
                {/* Background Track */}
                <div
                  className={`absolute left-0 right-0 bg-white/30 rounded-full overflow-hidden pointer-events-none transition-all ${!isPlaying || showOverlay ? "h-1.5 sm:h-2" : "h-1.5 group-hover/slider:h-2 sm:group-hover/slider:h-2.5"}`}
                >
                  {/* Progress */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-[var(--theme-primary)]"
                    style={{ width: `${progressPercentage}%` }}
                  />

                  {/* Chapters markers */}
                  {chapters &&
                    chapters.length > 0 &&
                    chapters.map((chapter, i) => {
                      const leftPercent =
                        duration > 0 ? (chapter.time / duration) * 100 : 0;
                      // Bỏ qua chapter ở giây 0 để không hiện vạch sát mép
                      if (chapter.time === 0) return null;
                      return (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 w-[2px] bg-black/60 z-10"
                          style={{ left: `${leftPercent}%` }}
                        />
                      );
                    })}
                </div>

                {/* Hover Tooltip */}
                {hoverPercent !== null && (
                  <div
                    className="absolute bottom-full mb-3 pointer-events-none z-50 flex flex-col items-center w-0"
                    style={{ left: `${hoverPercent}%` }}
                  >
                    <div
                      className="bg-gray-900/90 text-white text-[11px] sm:text-xs font-medium px-2.5 py-1.5 rounded whitespace-nowrap shadow-lg backdrop-blur-sm border border-white/10"
                      style={{
                        transform: `translateX(calc(50% - ${hoverPercent}% + ${hoverPercent / 10 - 5}px))`,
                      }}
                    >
                      {formatTime((hoverPercent / 100) * duration)}
                      {(() => {
                        const hoverTime = (hoverPercent / 100) * duration;
                        const activeChapter = chapters
                          .slice()
                          .reverse()
                          .find((c) => c.time <= hoverTime);
                        return activeChapter ? (
                          <span className="ml-1.5 font-bold text-blue-300">
                            • {activeChapter.title}
                          </span>
                        ) : (
                          ""
                        );
                      })()}
                    </div>
                    <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-gray-900/90"></div>
                  </div>
                )}

                {/* Thumb */}
                <div
                  className={`absolute h-3.5 w-3.5 sm:h-4 sm:w-4 bg-[var(--theme-primary)] rounded-full -ml-[7px] sm:-ml-2 pointer-events-none transition-all shadow-[0_0_8px_rgba(var(--theme-primary-rgb),0.6)] ${!isPlaying || showOverlay ? "opacity-100 scale-110" : "opacity-0 group-hover/slider:opacity-100 group-hover/slider:scale-110"}`}
                  style={{ left: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-white text-[11px] sm:text-[13px] font-bold w-9 sm:w-11">
                {formatTime(duration)}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                <button
                  onClick={handlePlayPause}
                  className="text-white hover:text-[var(--theme-primary)] p-1 sm:p-1.5 transition-colors group/btn relative"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 sm:h-6 sm:w-6 fill-current" />
                  ) : (
                    <Play className="h-5 w-5 sm:h-6 sm:w-6 fill-current" />
                  )}
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 pointer-events-none z-50">
                    {isPlaying ? "Tạm dừng" : "Phát"}
                  </span>
                </button>

                <button
                  onClick={handleSkipBackward}
                  className="text-white hover:text-[var(--theme-primary)] p-1 sm:p-1.5 transition-colors group/btn relative flex items-center justify-center"
                >
                  <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="absolute text-[8px] sm:text-[9px] font-bold mt-0.5">
                    {currentSettings.seekStepInSeconds}
                  </span>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 pointer-events-none z-50">
                    Tua lại {currentSettings.seekStepInSeconds}s
                  </span>
                </button>

                <button
                  onClick={handleSkipForward}
                  className="text-white hover:text-[var(--theme-primary)] p-1 sm:p-1.5 transition-colors group/btn relative flex items-center justify-center"
                >
                  <RotateCw className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="absolute text-[8px] sm:text-[9px] font-bold mt-0.5">
                    {currentSettings.seekStepInSeconds}
                  </span>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 pointer-events-none z-50">
                    Tua tiếp {currentSettings.seekStepInSeconds}s
                  </span>
                </button>

                {/* Volume Control */}
                <div className="hidden sm:flex items-center group/volume gap-1">
                  <button
                    onClick={handleToggleMute}
                    className="text-white hover:text-[var(--theme-primary)] p-1.5 transition-colors group/btn relative"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-5 w-5" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 pointer-events-none z-50">
                      {isMuted || volume === 0 ? "Bật âm" : "Tắt âm"}
                    </span>
                  </button>

                  <div className="w-0 group-hover/volume:w-24 transition-all duration-300 ease-out flex items-center h-4 relative opacity-0 group-hover/volume:opacity-100 pr-1.5">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30 m-0 p-0"
                    />
                    <div className="absolute left-0 right-1.5 h-1.5 bg-white/30 rounded-full pointer-events-none">
                      <div
                        className="h-full bg-[var(--theme-primary)] rounded-full"
                        style={{ width: `${volume}%` }}
                      />
                    </div>
                    <div
                      className="absolute h-3 w-3 rounded-full bg-[var(--theme-primary)] shadow-sm pointer-events-none"
                      style={{ left: `calc(${volume}% * 0.9 + 2px)` }}
                    />
                  </div>
                </div>

                {/* Current Chapter Name */}
                {chapters && chapters.length > 0 && (
                  <span className="ml-1 flex min-w-0 flex-1 items-center border-l border-white/20 pl-2 sm:pl-3 md:flex-none">
                    <span className="block min-w-0 truncate text-[11px] font-medium text-white/90 sm:text-sm md:max-w-[200px] lg:max-w-[300px]">
                      {(() => {
                        const sortedChapters = [...chapters].sort(
                          (a, b) => b.time - a.time,
                        );
                        const current =
                          sortedChapters.find((c) => currentTime >= c.time) ||
                          sortedChapters[sortedChapters.length - 1];
                        return current?.title;
                      })()}
                    </span>
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                {/* Captions / Subtitles */}
                <button
                  onClick={handleToggleCaptions}
                  className={`text-white p-1 sm:p-1.5 transition-colors group/btn relative ${showCaptions ? "text-[var(--theme-primary)] opacity-100" : "opacity-70 hover:opacity-100 hover:text-[var(--theme-primary)]"}`}
                >
                  <Subtitles className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-800 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 pointer-events-none z-50">
                    {showCaptions ? "Tắt Phụ đề" : "Bật Phụ đề"}
                  </span>
                </button>

                {/* Speed Control */}
                <div
                  className="relative flex items-center gap-1 sm:gap-1.5 text-white hover:text-[var(--theme-primary)] transition-colors cursor-pointer p-1 sm:p-1.5"
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  onMouseLeave={() => setShowSpeedMenu(false)}
                >
                  <Gauge className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-[11px] sm:text-[13px] font-bold min-w-[18px] sm:min-w-[20px] text-center">
                    {playbackRate}x
                  </span>

                  {showSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-2 py-1 sm:py-2 bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl flex flex-col min-w-[75px] sm:min-w-[90px] z-[60] origin-bottom-right animate-in zoom-in-95 duration-200">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlaybackRateChange(rate);
                            setShowSpeedMenu(false);
                          }}
                          className={`px-2 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-[13px] font-medium hover:bg-white/10 text-left flex items-center transition-colors ${playbackRate === rate ? "text-[var(--theme-primary)]" : "text-white"}`}
                        >
                          <div className="w-3.5 sm:w-4 flex items-center justify-center mr-1">
                            {playbackRate === rate && (
                              <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                            )}
                          </div>
                          {rate}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleFullscreen}
                  className="text-white hover:text-[var(--theme-primary)] p-1 sm:p-1.5 transition-colors group/btn relative"
                >
                  {isFullscreen ? (
                    <Minimize className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <Maximize className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                  <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-800 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 pointer-events-none z-50">
                    {isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
