"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import { FreeMode, Keyboard, Mousewheel, Thumbs } from "swiper/modules";
import "swiper/css";
import "swiper/css/thumbs";
import "./swiper-viewer.css";
import type { MediaSwiperViewerItem } from "./types";
import {
  IconPlay,
  IconPause,
  IconInfo,
  IconMaximize,
  IconMinimize,
  IconX,
  IconChevronLeft,
  IconChevronRight,
} from "./viewer-icons";
import {
  themeBg,
  DEFAULT_MAX_IMAGE_UPSCALE_FACTOR,
  DEFAULT_COVER_ASPECT_MISMATCH_THRESHOLD,
  THUMB_DIMENSIONS,
  viewerStyles as styles,
  type ThumbSize,
  type FrameSize,
  type ImageNaturalSize,
} from "./viewer-styles";
import {
  useResolvedThumbSize,
  resolveMainImageFit,
  resolveEffectiveNaturalSize,
} from "./viewer-image-fit";

export type { ThumbSize } from "./viewer-styles";

/** Main carousel: only slides within this index distance load real `src` (avoids hundreds of videos/images at once). */
const MAIN_SLIDE_MEDIA_DISTANCE = 2;
/** Thumb rail: eager-load video preview for neighbors of the active slide; others use intersection lazy-load. */
const THUMB_STRIP_VIDEO_PRIORITY_DISTANCE = 6;

const stripVideoPlaceholderStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#e2e8f0",
  fontSize: 11,
};

interface LazyStripVideoThumbProps {
  src: string;
  thumbStyle: CSSProperties;
  highPriority: boolean;
}

function LazyStripVideoThumb({ src, thumbStyle, highPriority }: LazyStripVideoThumbProps): ReactElement {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [showVideo, setShowVideo] = useState(highPriority);

  useEffect(() => {
    if (highPriority) {
      setShowVideo(true);
    }
  }, [highPriority]);

  useEffect(() => {
    if (showVideo) {
      return;
    }
    const el = wrapRef.current;
    if (!el) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShowVideo(true);
          observer.disconnect();
        }
      },
      { root: null, rootMargin: "480px 0px 480px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [showVideo]);

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      {showVideo ? (
        <video
          src={src}
          muted
          preload="metadata"
          playsInline
          style={{ ...thumbStyle, pointerEvents: "none" }}
          aria-hidden
        />
      ) : (
        <div style={{ ...thumbStyle, ...stripVideoPlaceholderStyle }} aria-hidden>
          Video
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 6,
          bottom: 6,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: "rgba(15, 23, 42, 0.82)",
          border: "1px solid rgba(148, 163, 184, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#f8fafc",
        }}
      >
        <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 1.5L8 5L2 8.5V1.5Z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

interface MediaSwiperViewerProps<TItem extends MediaSwiperViewerItem> {
  isOpen: boolean;
  items: TItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  showPhotoDuration?: number;
  thumbSize?: ThumbSize;
  autoFitImageToFrame?: boolean;
  maxUpscaleFactor?: number;
  coverAspectMismatchThreshold?: number;
  renderInfoPanel?: (item: TItem) => ReactNode;
  /** When set with `onInfoPanelOpenChange`, info panel visibility is controlled by the parent. */
  infoPanelOpen?: boolean;
  onInfoPanelOpenChange?: (open: boolean) => void;
  /** When true, auto-start playback only for the initially opened video slide. */
  autoPlayInitialVideo?: boolean;
  /** When true, selecting a video slide (thumb/nav) auto-starts playback. */
  autoPlayVideoOnSelection?: boolean;
  /** In slideshow mode, skip videos instead of playing them. */
  skipVideosInSlideshow?: boolean;
}

export function MediaSwiperViewer<TItem extends MediaSwiperViewerItem>({
  isOpen,
  items,
  currentIndex,
  onIndexChange,
  onClose,
  showPhotoDuration = 4000,
  thumbSize = "auto",
  autoFitImageToFrame = true,
  maxUpscaleFactor = DEFAULT_MAX_IMAGE_UPSCALE_FACTOR,
  coverAspectMismatchThreshold = DEFAULT_COVER_ASPECT_MISMATCH_THRESHOLD,
  renderInfoPanel,
  infoPanelOpen: controlledInfoOpen,
  onInfoPanelOpenChange,
  autoPlayInitialVideo = false,
  autoPlayVideoOnSelection = false,
  skipVideosInSlideshow = false,
}: MediaSwiperViewerProps<TItem>): ReactElement | null {
  const resolvedThumbSize = useResolvedThumbSize(thumbSize);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);
  const [mainSwiper, setMainSwiper] = useState<SwiperType | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(false);
  const [internalShowInfoPanel, setInternalShowInfoPanel] = useState(false);
  const isInfoControlled =
    typeof controlledInfoOpen === "boolean" && typeof onInfoPanelOpenChange === "function";
  const showInfoPanel = isInfoControlled ? controlledInfoOpen : internalShowInfoPanel;

  const hideInfoPanel = () => {
    if (isInfoControlled) {
      onInfoPanelOpenChange?.(false);
    } else {
      setInternalShowInfoPanel(false);
    }
  };

  const toggleInfoPanel = () => {
    if (isInfoControlled) {
      onInfoPanelOpenChange?.(!controlledInfoOpen);
    } else {
      setInternalShowInfoPanel((previous) => !previous);
    }
  };
  const [frameSize, setFrameSize] = useState<FrameSize | null>(null);
  const [imageNaturalSizes, setImageNaturalSizes] = useState<Record<string, ImageNaturalSize>>({});
  const mediaVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const initialVideoAutoPlayAttemptedRef = useRef(false);
  const slideshowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upsertImageNaturalSize = (itemId: string, width: number, height: number) => {
    if (!width || !height) {
      return;
    }
    setImageNaturalSizes((previous) => {
      const existing = previous[itemId];
      if (existing?.width === width && existing?.height === height) {
        return previous;
      }
      return {
        ...previous,
        [itemId]: { width, height },
      };
    });
  };

  const resolvedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        full: item.storage_url || item.storage_path || "",
        thumb: item.thumbnail_url || item.thumbnail_path || item.storage_url || item.storage_path || "",
      })),
    [items],
  );

  useEffect(() => {
    if (!isOpen) {
      setIsSlideshowPlaying(false);
      for (const videoElement of Object.values(mediaVideoRefs.current)) {
        if (videoElement && !videoElement.paused) {
          videoElement.pause();
        }
      }
      if (!isInfoControlled) {
        setInternalShowInfoPanel(false);
      }
      initialVideoAutoPlayAttemptedRef.current = false;
    }
  }, [isOpen, isInfoControlled]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!mainSwiper || mainSwiper.destroyed) {
      return;
    }
    mainSwiper.slideTo(currentIndex);
  }, [currentIndex, mainSwiper]);

  useEffect(() => {
    const frameElement = frameRef.current;
    if (!frameElement) {
      return;
    }

    const updateFrameSize = () => {
      const nextWidth = frameElement.clientWidth;
      const nextHeight = frameElement.clientHeight;
      setFrameSize((previous) => {
        if (previous?.width === nextWidth && previous?.height === nextHeight) {
          return previous;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };

    updateFrameSize();
    const observer = new ResizeObserver(updateFrameSize);
    observer.observe(frameElement);
    return () => observer.disconnect();
  }, [isOpen, resolvedThumbSize]);

  const selectedItem = resolvedItems[currentIndex];
  const canGoPrev = resolvedItems.length > 1;
  const canGoNext = resolvedItems.length > 1;
  const showingInfo = showInfoPanel && !!renderInfoPanel && !!selectedItem;

  const handleNavigate = (direction: "prev" | "next") => {
    if (showingInfo) {
      const nextIndex = direction === "prev"
        ? (currentIndex - 1 + resolvedItems.length) % resolvedItems.length
        : (currentIndex + 1) % resolvedItems.length;
      onIndexChange(nextIndex);
    } else if (direction === "prev") {
      mainSwiper?.slidePrev();
    } else {
      mainSwiper?.slideNext();
    }
  };

  const handleThumbClick = (index: number) => {
    if (showingInfo) {
      onIndexChange(index);
    } else {
      mainSwiper?.slideTo(index);
    }
  };

  const handleSlideshowToggle = () => {
    setIsSlideshowPlaying((prev) => {
      if (!prev) {
        hideInfoPanel();
      }
      return !prev;
    });
  };

  const pauseAllVideos = (): void => {
    for (const videoElement of Object.values(mediaVideoRefs.current)) {
      if (videoElement && !videoElement.paused) {
        videoElement.pause();
      }
    }
  };

  const clearSlideshowTimer = (): void => {
    if (slideshowTimerRef.current) {
      clearTimeout(slideshowTimerRef.current);
      slideshowTimerRef.current = null;
    }
  };

  const goToNextSlide = (): void => {
    if (mainSwiper && !mainSwiper.destroyed) {
      mainSwiper.slideNext();
    }
  };

  const controlsRegionStyle: CSSProperties = {
    ...styles.controlsRegion,
    width: showingInfo ? "60%" : "100%",
  };
  const resolvedMaxUpscaleFactor = Math.max(1, maxUpscaleFactor);
  const resolvedCoverAspectMismatchThreshold = Math.max(0, coverAspectMismatchThreshold);

  const hideThumbs = isSlideshowPlaying;
  const { railWidth, slideHeight } = THUMB_DIMENSIONS[resolvedThumbSize];

  // Mark "initial autoplay handled" when opening a non-video or when autoplay is off.
  // Actual play() for the initial video runs in the slide's onLoadedMetadata — Swiper
  // mounts slides asynchronously, so the <video> ref is often still null on first effect run.
  useEffect(() => {
    if (!isOpen || !autoPlayInitialVideo || initialVideoAutoPlayAttemptedRef.current) {
      return;
    }
    const selected = resolvedItems[currentIndex];
    if (!selected || selected.mediaType !== "video") {
      initialVideoAutoPlayAttemptedRef.current = true;
    }
  }, [autoPlayInitialVideo, currentIndex, isOpen, resolvedItems]);

  useEffect(() => {
    if (!isOpen || !autoPlayVideoOnSelection || isSlideshowPlaying) {
      return;
    }
    const selected = resolvedItems[currentIndex];
    if (!selected || selected.mediaType !== "video") {
      return;
    }
    const videoElement = mediaVideoRefs.current[selected.id];
    if (!videoElement) {
      return;
    }
    void videoElement.play().catch(() => undefined);
  }, [autoPlayVideoOnSelection, currentIndex, isOpen, isSlideshowPlaying, resolvedItems]);

  useEffect(() => {
    clearSlideshowTimer();
    if (!isOpen || !isSlideshowPlaying || !resolvedItems.length) {
      return;
    }
    const selected = resolvedItems[currentIndex];
    if (!selected) {
      return;
    }
    if (selected.mediaType !== "video") {
      slideshowTimerRef.current = setTimeout(goToNextSlide, showPhotoDuration);
      return () => clearSlideshowTimer();
    }
    if (skipVideosInSlideshow) {
      slideshowTimerRef.current = setTimeout(goToNextSlide, 0);
      return () => clearSlideshowTimer();
    }
    const videoElement = mediaVideoRefs.current[selected.id];
    if (!videoElement) {
      return;
    }
    const handleEnded = () => {
      goToNextSlide();
    };
    videoElement.addEventListener("ended", handleEnded);
    void videoElement.play().catch(() => undefined);
    return () => {
      videoElement.removeEventListener("ended", handleEnded);
      clearSlideshowTimer();
    };
  }, [
    currentIndex,
    isOpen,
    isSlideshowPlaying,
    resolvedItems,
    showPhotoDuration,
    skipVideosInSlideshow,
    mainSwiper,
  ]);

  if (!isOpen || resolvedItems.length === 0) {
    return null;
  }
  const portalRoot = typeof document === "undefined" ? null : document.body;
  if (!portalRoot) {
    return null;
  }

  return createPortal(
    <div ref={containerRef} style={styles.overlay} className="media-swiper-theme">
      <div
        style={{
          ...styles.shell,
          gridTemplateColumns: hideThumbs ? "1fr" : `${railWidth}px 1fr`,
        }}
      >
        {!hideThumbs && (
          <div style={styles.thumbsRail}>
            <Swiper
              modules={[Thumbs, FreeMode, Mousewheel]}
              onSwiper={setThumbsSwiper}
              direction="vertical"
              slidesPerView={"auto"}
              spaceBetween={8}
              freeMode={true}
              mousewheel={true}
              watchSlidesProgress={true}
              style={{ height: "100%" }}
            >
              {resolvedItems.map((item, index) => {
                const stripNeighbor =
                  Math.abs(index - currentIndex) <= THUMB_STRIP_VIDEO_PRIORITY_DISTANCE;
                return (
                  <SwiperSlide key={`${item.id}-thumb`} style={{ ...styles.thumbSlide, height: slideHeight }}>
                    <button
                      type="button"
                      style={{ border: "none", padding: 0, background: "transparent", width: "100%", height: "100%" }}
                      onClick={() => handleThumbClick(index)}
                      aria-label={`Go to item ${index + 1}`}
                    >
                      {item.mediaType === "video" ? (
                        <LazyStripVideoThumb
                          src={item.full}
                          thumbStyle={styles.thumbImage}
                          highPriority={stripNeighbor}
                        />
                      ) : (
                        <img
                          src={item.thumb}
                          alt={item.title || `Thumbnail ${index + 1}`}
                          style={styles.thumbImage}
                          loading={stripNeighbor ? "eager" : "lazy"}
                          decoding="async"
                        />
                      )}
                    </button>
                  </SwiperSlide>
                );
              })}
            </Swiper>
          </div>
        )}

        <div ref={frameRef} style={styles.main}>
          <div style={styles.controlsOverlay}>
            <div style={controlsRegionStyle}>
              <div style={styles.topBar}>
                <div style={{ ...styles.controls, ...styles.controlsLeft }}>
                  <button
                    type="button"
                    style={styles.button}
                    onClick={handleSlideshowToggle}
                    title={isSlideshowPlaying ? "Pause slideshow" : "Play slideshow"}
                    aria-label={isSlideshowPlaying ? "Pause slideshow" : "Play slideshow"}
                  >
                    {isSlideshowPlaying ? <IconPause /> : <IconPlay />}
                  </button>
                  {!isSlideshowPlaying && (
                    <button
                      type="button"
                      style={styles.button}
                      title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                      onClick={() => {
                        if (!containerRef.current) {
                          return;
                        }
                        if (document.fullscreenElement) {
                          void document.exitFullscreen();
                          return;
                        }
                        void containerRef.current.requestFullscreen();
                      }}
                    >
                      {isFullscreen ? <IconMinimize /> : <IconMaximize />}
                    </button>
                  )}
                </div>
                {!isSlideshowPlaying && (
                  <div style={{ ...styles.controls, ...styles.controlsRight }}>
                    {renderInfoPanel ? (
                      <button
                        type="button"
                        style={styles.button}
                        onClick={toggleInfoPanel}
                        title={showInfoPanel ? "Hide info" : "Show info"}
                        aria-label={showInfoPanel ? "Hide info" : "Show info"}
                      >
                        <IconInfo />
                      </button>
                    ) : null}
                    <button type="button" style={styles.button} onClick={onClose} title="Close viewer" aria-label="Close viewer">
                      <IconX />
                    </button>
                  </div>
                )}
              </div>

              {!isSlideshowPlaying && (
                <>
                  <button
                    type="button"
                    style={{ ...styles.navButton, ...styles.navLeft }}
                    onClick={() => handleNavigate("prev")}
                    disabled={!canGoPrev}
                    title="Previous item"
                    aria-label="Previous item"
                  >
                    <IconChevronLeft />
                  </button>
                  <button
                    type="button"
                    style={{ ...styles.navButton, ...styles.navRight }}
                    onClick={() => handleNavigate("next")}
                    disabled={!canGoNext}
                    title="Next item"
                    aria-label="Next item"
                  >
                    <IconChevronRight />
                  </button>
                </>
              )}
            </div>
          </div>

          <Swiper
            modules={[Keyboard, Thumbs]}
            thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
            slidesPerView={1}
            keyboard={{ enabled: true }}
            observer={true}
            observeParents={true}
            initialSlide={currentIndex}
            autoplay={false}
            onSwiper={(swiper) => {
              setMainSwiper(swiper);
            }}
            onSlideChange={(swiper) => {
              pauseAllVideos();
              onIndexChange(swiper.activeIndex);
            }}
            style={{ width: "100%", height: "100%", background: themeBg }}
          >
            {resolvedItems.map((item, index) => {
              const loadMainMedia = Math.abs(index - currentIndex) <= MAIN_SLIDE_MEDIA_DISTANCE;

              if (item.mediaType === "video") {
                return (
                  <SwiperSlide
                    key={`${item.id}-main`}
                    style={{ width: "100%", height: "100%", background: themeBg }}
                    className="!flex !items-center !justify-center"
                  >
                    <div style={styles.mainImageWrap}>
                      {loadMainMedia ? (
                        <video
                          src={item.full}
                          controls
                          preload="metadata"
                          playsInline
                          ref={(element) => {
                            mediaVideoRefs.current[item.id] = element;
                          }}
                          onLoadedMetadata={(event) => {
                            if (!autoPlayInitialVideo || initialVideoAutoPlayAttemptedRef.current) {
                              return;
                            }
                            if (index !== currentIndex) {
                              return;
                            }
                            initialVideoAutoPlayAttemptedRef.current = true;
                            void event.currentTarget.play().catch(() => undefined);
                          }}
                          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                          aria-label={item.title || `Video ${index + 1}`}
                        />
                      ) : (
                        <div
                          style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#64748b",
                            fontSize: 14,
                          }}
                          aria-hidden
                        >
                          Video
                        </div>
                      )}
                    </div>
                  </SwiperSlide>
                );
              }

              const effectiveNaturalSize = resolveEffectiveNaturalSize(item, imageNaturalSizes[item.id]);
              const fitResult = resolveMainImageFit(
                autoFitImageToFrame,
                frameSize,
                resolvedMaxUpscaleFactor,
                resolvedCoverAspectMismatchThreshold,
                effectiveNaturalSize,
              );

              return (
                <SwiperSlide
                  key={`${item.id}-main`}
                  style={{ width: "100%", height: "100%", background: themeBg }}
                  className="!flex !items-center !justify-center"
                >
                  <div style={styles.mainImageWrap}>
                    {loadMainMedia ? (
                      <img
                        src={item.full}
                        alt={item.title || `Image ${index + 1}`}
                        ref={(imageElement) => {
                          if (!imageElement || !imageElement.complete) {
                            return;
                          }
                          const width = imageElement.naturalWidth;
                          const height = imageElement.naturalHeight;
                          upsertImageNaturalSize(item.id, width, height);
                        }}
                        onLoad={(event) => {
                          const imageElement = event.currentTarget;
                          const width = imageElement.naturalWidth;
                          const height = imageElement.naturalHeight;
                          upsertImageNaturalSize(item.id, width, height);
                        }}
                        data-emk-fit-mode={fitResult.mode}
                        data-emk-contain-scale={fitResult.containScale?.toFixed(4) ?? "na"}
                        data-emk-ar-mismatch={fitResult.aspectRatioMismatch?.toFixed(4) ?? "na"}
                        data-emk-effective-natural-width={fitResult.naturalWidth ?? "na"}
                        data-emk-effective-natural-height={fitResult.naturalHeight ?? "na"}
                        data-emk-frame-width={frameSize?.width ?? "na"}
                        data-emk-frame-height={frameSize?.height ?? "na"}
                        style={fitResult.style}
                      />
                    ) : (
                      <div
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          width: "100%",
                          height: "100%",
                          background: themeBg,
                        }}
                        aria-hidden
                      />
                    )}
                  </div>
                </SwiperSlide>
              );
            })}
          </Swiper>

          {showingInfo ? (
            <div style={styles.infoPanelContent}>
              {renderInfoPanel(selectedItem as TItem)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
    ,
    portalRoot,
  );
}
