"use client";

import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Maximize, Minimize, Volume2, VolumeX, Gauge, RotateCcw, RotateCw, GraduationCap, Check, Subtitles } from "lucide-react";

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
  
  // Backward compatibility
  hasLetterbox?: boolean;
  letterboxHeightPercentage?: number;
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

interface CustomYoutubePlayerProps {
  videoUrl: string;
  settings?: CustomVideoSettings | null;
  title?: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function CustomYoutubePlayer({ videoUrl, settings, title }: CustomYoutubePlayerProps) {
  const rawSettings = { ...DEFAULT_CUSTOM_VIDEO_SETTINGS, ...settings };
  
  // Xử lý giá trị mặc định của viền đen
  const bottomPercent = settings?.letterboxBottomPercentage ?? rawSettings.letterboxBottomPercentage;
  const currentSettings = {
    ...rawSettings,
    letterboxBottomPercentage: bottomPercent
  };
  
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playerNodeRef = useRef<HTMLDivElement>(null);

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
  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef<number>(0);
  const isFirstPlayStartedRef = useRef<boolean>(false);

  const hideOverlayDelayed = () => {
    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    overlayTimeoutRef.current = setTimeout(() => {
      setShowOverlay(false);
    }, currentSettings.pauseOverlayDurationInSeconds * 1000);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isNative = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
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

  useEffect(() => {
    if (!videoId) return;
    if (currentSettings.isDisabled) return;

    let isMounted = true;
    let checkTimeout: NodeJS.Timeout;

    const tryInitPlayer = () => {
      if (window.YT && window.YT.Player) {
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
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, currentSettings.isDisabled]);

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
            if (typeof event.target.unloadModule === 'function') {
              event.target.unloadModule("captions");
            }
            if (typeof event.target.setOption === 'function') {
              event.target.setOption("captions", "track", {});
            }
          } catch (e) {}

          const rawDuration = event.target.getDuration();
          if (rawDuration > 0) {
            const validDuration = Math.max(0, rawDuration - currentSettings.startTimeInSeconds - currentSettings.endTimeCutInSeconds);
            setDuration(validDuration);
            durationRef.current = rawDuration;
          }
          setVolume(event.target.getVolume() || 100);
          setIsMuted(event.target.isMuted());
          setIsReady(true);
        },
        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            if (!isFirstPlayStartedRef.current) {
              isFirstPlayStartedRef.current = true;
              setIsFirstPlayStarted(true);
              
              // Ép ẩn phụ đề lần nữa khi video thực sự bắt đầu phát (vì lúc onReady có thể YT chưa load xong module phụ đề)
              try {
                if (typeof event.target.unloadModule === 'function') {
                  event.target.unloadModule("captions");
                  event.target.unloadModule("cc");
                }
                if (typeof event.target.setOption === 'function') {
                  event.target.setOption("captions", "track", {});
                }
              } catch (e) {}
            }
            setIsStarting(false);
            setIsReady(true); // Fallback: nếu onReady không gọi được mà video vẫn play
          } else {
            setIsPlaying(false);
          }
          
          if (event.data === window.YT.PlayerState.ENDED) {
            playerRef.current.seekTo(durationRef.current - currentSettings.endTimeCutInSeconds, true);
            playerRef.current.pauseVideo();
          }
        },
      },
    });
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && playerRef.current) {
      interval = setInterval(() => {
        if (!playerRef.current || typeof playerRef.current.getCurrentTime !== "function") return;
        
        const time = playerRef.current.getCurrentTime();
        if (time < currentSettings.startTimeInSeconds) {
          playerRef.current.seekTo(currentSettings.startTimeInSeconds, true);
        }
        if (time > durationRef.current - currentSettings.endTimeCutInSeconds && durationRef.current > 0) {
          playerRef.current.seekTo(durationRef.current - currentSettings.endTimeCutInSeconds, true);
          playerRef.current.pauseVideo();
          setIsPlaying(false);
        }
        setCurrentTime(Math.max(0, time - currentSettings.startTimeInSeconds));
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  const handlePlayPause = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const handleOverlayClick = () => {
    if (!showOverlay) {
      setShowOverlay(true);
      hideOverlayDelayed();
    } else {
      handlePlayPause();
    }
  };

  const handleStart = () => {
    if (isStarting) return;
    setIsStarting(true);
    
    const tryStart = () => {
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        setShowOverlay(true);
        hideOverlayDelayed();
        playerRef.current.seekTo(currentSettings.startTimeInSeconds, true);
        playerRef.current.playVideo();
      } else {
        setTimeout(tryStart, 100);
      }
    };
    
    tryStart();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const displayValue = parseFloat(e.target.value);
    if (!playerRef.current) return;
    
    if (isPlaying) {
      setShowOverlay(true);
      hideOverlayDelayed();
    }
    
    const actualTime = displayValue + currentSettings.startTimeInSeconds;
    playerRef.current.seekTo(actualTime, true);
    setCurrentTime(displayValue);
  };

  const handleToggleMute = () => {
    if (!playerRef.current) return;
    if (isMuted) {
      if (typeof playerRef.current.unMute === 'function') playerRef.current.unMute();
      setIsMuted(false);
      if (volume === 0) {
        if (typeof playerRef.current.setVolume === 'function') playerRef.current.setVolume(100);
        setVolume(100);
      }
    } else {
      if (typeof playerRef.current.mute === 'function') playerRef.current.mute();
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    if (!playerRef.current) return;
    if (typeof playerRef.current.setVolume === 'function') playerRef.current.setVolume(newVolume);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      if (typeof playerRef.current.unMute === 'function') playerRef.current.unMute();
      setIsMuted(false);
    } else if (newVolume === 0 && !isMuted) {
      if (typeof playerRef.current.mute === 'function') playerRef.current.mute();
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
    setCurrentTime(newTime - currentSettings.startTimeInSeconds);
  };

  const handleSkipForward = () => {
    if (!playerRef.current) return;
    const actualCurrentTime = currentTime + currentSettings.startTimeInSeconds;
    let newTime = actualCurrentTime + currentSettings.seekStepInSeconds;
    if (newTime > durationRef.current - currentSettings.endTimeCutInSeconds) {
      newTime = durationRef.current - currentSettings.endTimeCutInSeconds;
    }
    playerRef.current.seekTo(newTime, true);
    setCurrentTime(newTime - currentSettings.startTimeInSeconds);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    const elem = containerRef.current as any;
    const doc = document as any;

    const canNativeFs = !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled || doc.mozFullScreenEnabled || doc.msFullscreenEnabled);

    if (!isFullscreen) {
      setIsFullscreen(true);
      if (canNativeFs) {
        const reqFs = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen || elem.msRequestFullscreen;
        if (reqFs) {
          try {
            reqFs.call(elem);
          } catch (err) {}
        }
      }
    } else {
      setIsFullscreen(false);
      if (canNativeFs) {
        const exitFs = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
        const isNativeFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
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
      if (typeof p.unloadModule === 'function') p.unloadModule("captions");
      if (typeof p.setOption === 'function') p.setOption("captions", "track", {});
      setShowCaptions(false);
    } else {
      if (typeof p.loadModule === 'function') p.loadModule("captions");
      // Mặc định gọi ngôn ngữ tiếng Việt (vi) hoặc tiếng Anh (en) tuỳ cấu hình video, 
      // truyền {} rỗng ở setOption thường YT tự động chọn ngôn ngữ tốt nhất.
      if (typeof p.setOption === 'function') p.setOption("captions", "track", { languageCode: "vi" });
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

  const progressPercentage = duration ? (currentTime / duration) * 100 : 0;
  
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
        innerWidth = `${parentH * 16 / 9}px`;
      } else {
        innerWidth = `${parentW}px`;
        innerHeight = `${parentW * 9 / 16}px`;
      }
    }
  } else {
    innerWidth = '100%';
    innerHeight = '100%';
  }

  return (
    <div 
      ref={containerRef} 
      className={`bg-black group flex flex-col items-center justify-center overflow-hidden ${isFullscreen ? (isPseudoPortrait ? "fixed z-[99999] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90" : "fixed inset-0 z-[99999] w-full h-full") : "relative w-full aspect-video sm:rounded-lg border-y sm:border border-[var(--theme-border)]"}`}
      style={isPseudoPortrait ? { width: `${windowSize.h}px`, height: `${windowSize.w}px` } : undefined}
    >
      <div 
        className="relative flex-none w-full h-full overflow-hidden"
        style={{ width: innerWidth, height: innerHeight }}
      >
        {/* Watermark Logo ClassHero */}
      {currentSettings.hasWatermark && (
        <div 
          className={`absolute z-40 flex items-center pointer-events-none bg-black/80 rounded-lg backdrop-blur-sm border border-white/10 shadow-lg transition-all duration-300 ${
            isFullscreen ? "top-4 right-4 sm:top-8 sm:right-8 gap-2 sm:gap-3 px-3 py-2 sm:px-5 sm:py-3 scale-100 sm:scale-125 origin-top-right" : "top-2 right-2 sm:top-4 sm:right-4 gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 scale-75 sm:scale-100 origin-top-right"
          }`}
        >
          <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--theme-primary)]" />
          <span className="text-white font-bold tracking-widest text-[11px] sm:text-sm drop-shadow-md">ClassHero</span>
        </div>
      )}

      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden sm:rounded-lg">
        <div ref={playerNodeRef} className="w-full h-full" />
      </div>

      {/* Các viền đen cố định che mép video */}
      {currentSettings.letterboxTopPercentage > 0 && (
        <div className="absolute top-0 left-0 right-0 bg-black pointer-events-none z-10" style={{ height: `${currentSettings.letterboxTopPercentage}%` }} />
      )}
      {currentSettings.letterboxBottomPercentage > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-black pointer-events-none z-10" style={{ height: `${currentSettings.letterboxBottomPercentage}%` }} />
      )}
      {currentSettings.letterboxLeftPercentage > 0 && (
        <div className="absolute top-0 bottom-0 left-0 bg-black pointer-events-none z-10" style={{ width: `${currentSettings.letterboxLeftPercentage}%` }} />
      )}
      {currentSettings.letterboxRightPercentage > 0 && (
        <div className="absolute top-0 bottom-0 right-0 bg-black pointer-events-none z-10" style={{ width: `${currentSettings.letterboxRightPercentage}%` }} />
      )}
      
      {/* Màn hình chờ đen tuyền che toàn bộ ảnh nền mặc định của Youtube */}
      {!isFirstPlayStarted && (
        <div 
          className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center cursor-pointer group/start sm:rounded-lg overflow-hidden"
          onClick={handleStart}
        >
          {isStarting ? (
            <div className="w-10 h-10 sm:w-14 sm:h-14 border-4 border-white/20 border-t-[var(--theme-primary)] rounded-full animate-spin mb-2 sm:mb-4"></div>
          ) : (
            <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-[var(--theme-primary)] flex items-center justify-center mb-2 sm:mb-4 group-hover/start:scale-110 transition-transform shadow-lg shadow-[var(--theme-primary)]/30">
              <Play className="h-6 w-6 sm:h-10 sm:w-10 text-white fill-current ml-0.5 sm:ml-1" />
            </div>
          )}
          <span className="text-white/80 font-medium text-sm sm:text-lg">
            {isStarting ? "Đang kết nối đến Giáo viên..." : "Nhấn để bắt đầu học"}
          </span>
        </div>
      )}

      {/* Màn hình Intro che video trong 10 giây đầu tiên của trục thời gian ảo */}
      <div 
        className={`absolute inset-0 z-20 bg-black flex flex-col items-center justify-center pointer-events-none sm:rounded-lg overflow-hidden ${
          shouldShowIntro ? "opacity-100" : "opacity-0 transition-opacity duration-1000"
        }`}
      >
        <span className="text-white font-semibold text-sm sm:text-xl uppercase tracking-[0.2em] opacity-80 animate-pulse">{title || "Video Bài Giảng"}</span>
      </div>

      {/* Invisible overlay to block interacting directly with the iframe and handle clicks for play/pause */}
      <div 
        className="absolute inset-0 z-10 cursor-pointer" 
        onClick={handleOverlayClick}
      ></div>

      {/* Dải băng đen che Tiêu đề của Youtube khi Pause */}
      {showOverlay && (
        <div className="absolute top-0 left-0 w-full h-[50px] sm:h-[60px] bg-black z-10 flex items-center px-2 sm:px-4 pointer-events-none transition-opacity duration-300">
          <span className="text-white/70 font-semibold text-xs sm:text-sm line-clamp-1">{title || "Video bài giảng"}</span>
        </div>
      )}

      {/* Dải băng đen che các icon Share/Watch Later/More Videos của Youtube ở dưới cùng khi Pause */}
      {showOverlay && (
        <div className="absolute bottom-0 left-0 w-full h-[45px] sm:h-[60px] bg-black z-10 pointer-events-none transition-opacity duration-300"></div>
      )}

      {/* Control bar */}
      <div className={`absolute bottom-0 left-0 right-0 p-2 sm:p-4 bg-gradient-to-t from-black/80 to-transparent z-50 transition-opacity duration-300 ${(!isPlaying || isStarting || showOverlay) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        
        {/* Progress Bar */}
        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 w-full">
          <span className="text-white text-[11px] sm:text-[13px] font-bold w-9 sm:w-11 text-right">{formatTime(currentTime)}</span>
          <div className="relative flex-1 flex items-center group/slider h-4 cursor-pointer">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30 m-0 p-0"
              style={{
                touchAction: 'none'
              }}
            />
            {/* Background Track */}
            <div className={`absolute left-0 right-0 bg-white/20 rounded-full overflow-hidden pointer-events-none transition-all ${(!isPlaying || showOverlay) ? "h-2" : "h-1.5 group-hover/slider:h-2"}`}>
              {/* Progress */}
              <div 
                className="absolute left-0 top-0 bottom-0 bg-[var(--theme-primary)]"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            {/* Thumb */}
            <div 
              className={`absolute h-3 w-3 sm:h-4 sm:w-4 bg-[var(--theme-primary)] rounded-full -ml-1.5 sm:-ml-2 pointer-events-none transition-all shadow-[0_0_8px_rgba(var(--theme-primary-rgb),0.6)] ${(!isPlaying || showOverlay) ? "opacity-100 scale-110" : "opacity-0 group-hover/slider:opacity-100 group-hover/slider:scale-110"}`}
              style={{ left: `${progressPercentage}%` }}
            />
          </div>
          <span className="text-white text-[11px] sm:text-[13px] font-bold w-9 sm:w-11">{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 sm:gap-2">
            <button 
              onClick={handlePlayPause} 
              className="text-white hover:text-[var(--theme-primary)] p-1 sm:p-1.5 transition-colors group/btn relative"
            >
              {isPlaying ? <Pause className="h-5 w-5 sm:h-6 sm:w-6 fill-current" /> : <Play className="h-5 w-5 sm:h-6 sm:w-6 fill-current" />}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 pointer-events-none z-50">
                {isPlaying ? "Tạm dừng" : "Phát"}
              </span>
            </button>

            <button 
              onClick={handleSkipBackward} 
              className="text-white hover:text-[var(--theme-primary)] p-1 sm:p-1.5 transition-colors group/btn relative flex items-center justify-center"
            >
              <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="absolute text-[8px] sm:text-[9px] font-bold mt-0.5">{currentSettings.seekStepInSeconds}</span>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 pointer-events-none z-50">
                Tua lại {currentSettings.seekStepInSeconds}s
              </span>
            </button>

            <button 
              onClick={handleSkipForward} 
              className="text-white hover:text-[var(--theme-primary)] p-1 sm:p-1.5 transition-colors group/btn relative flex items-center justify-center"
            >
              <RotateCw className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="absolute text-[8px] sm:text-[9px] font-bold mt-0.5">{currentSettings.seekStepInSeconds}</span>
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
                {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
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
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Captions / Subtitles */}
            <button 
              onClick={handleToggleCaptions} 
              className={`text-white p-1 sm:p-1.5 transition-colors group/btn relative ${showCaptions ? 'text-[var(--theme-primary)] opacity-100' : 'opacity-70 hover:opacity-100 hover:text-[var(--theme-primary)]'}`}
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
              <span className="text-[11px] sm:text-[13px] font-bold min-w-[18px] sm:min-w-[20px] text-center">{playbackRate}x</span>
              
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
                      className={`px-2 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-[13px] font-medium hover:bg-white/10 text-left flex items-center transition-colors ${playbackRate === rate ? 'text-[var(--theme-primary)]' : 'text-white'}`}
                    >
                      <div className="w-3.5 sm:w-4 flex items-center justify-center mr-1">
                        {playbackRate === rate && <Check className="w-3 h-3 sm:w-4 sm:h-4" />}
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
              {isFullscreen ? <Minimize className="h-4 w-4 sm:h-5 sm:w-5" /> : <Maximize className="h-4 w-4 sm:h-5 sm:w-5" />}
              <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-800 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 pointer-events-none z-50">
                {isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
              </span>
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
