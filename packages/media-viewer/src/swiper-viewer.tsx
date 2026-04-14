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
import { Autoplay, FreeMode, Keyboard, Mousewheel, Thumbs } from "swiper/modules";
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
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [frameSize, setFrameSize] = useState<FrameSize | null>(null);
  const [imageNaturalSizes, setImageNaturalSizes] = useState<Record<string, ImageNaturalSize>>({});
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
      if (!isInfoControlled) {
        setInternalShowInfoPanel(false);
      }
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
    if (!mainSwiper || mainSwiper.destroyed || !mainSwiper.autoplay) {
      return;
    }
    if (isSlideshowPlaying) {
      mainSwiper.autoplay.start();
    } else {
      mainSwiper.autoplay.stop();
    }
  }, [isSlideshowPlaying, mainSwiper]);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

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
  }, [isOpen, resolvedThumbSize, portalRoot]);

  if (!isOpen || resolvedItems.length === 0) {
    return null;
  }
  if (!portalRoot) {
    return null;
  }

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

  const controlsRegionStyle: CSSProperties = {
    ...styles.controlsRegion,
    width: showingInfo ? "60%" : "100%",
  };
  const resolvedMaxUpscaleFactor = Math.max(1, maxUpscaleFactor);
  const resolvedCoverAspectMismatchThreshold = Math.max(0, coverAspectMismatchThreshold);

  const hideThumbs = isSlideshowPlaying;
  const { railWidth, slideHeight } = THUMB_DIMENSIONS[resolvedThumbSize];

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
              {resolvedItems.map((item, index) => (
                <SwiperSlide key={`${item.id}-thumb`} style={{ ...styles.thumbSlide, height: slideHeight }}>
                  <button
                    type="button"
                    style={{ border: "none", padding: 0, background: "transparent", width: "100%", height: "100%" }}
                    onClick={() => handleThumbClick(index)}
                    aria-label={`Go to photo ${index + 1}`}
                  >
                    <img src={item.thumb} alt={item.title || `Thumbnail ${index + 1}`} style={styles.thumbImage} />
                  </button>
                </SwiperSlide>
              ))}
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
                    title="Previous image"
                    aria-label="Previous image"
                  >
                    <IconChevronLeft />
                  </button>
                  <button
                    type="button"
                    style={{ ...styles.navButton, ...styles.navRight }}
                    onClick={() => handleNavigate("next")}
                    disabled={!canGoNext}
                    title="Next image"
                    aria-label="Next image"
                  >
                    <IconChevronRight />
                  </button>
                </>
              )}
            </div>
          </div>

          <Swiper
            modules={[Keyboard, Thumbs, Autoplay]}
            thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
            slidesPerView={1}
            keyboard={{ enabled: true }}
            observer={true}
            observeParents={true}
            initialSlide={currentIndex}
            autoplay={
              isSlideshowPlaying
                ? {
                    delay: showPhotoDuration,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true,
                  }
                : false
            }
            onSwiper={(swiper) => {
              setMainSwiper(swiper);
              if (swiper.autoplay) {
                swiper.autoplay.stop();
              }
            }}
            onSlideChange={(swiper) => onIndexChange(swiper.activeIndex)}
            style={{ width: "100%", height: "100%", background: themeBg }}
          >
            {resolvedItems.map((item, index) => (
              (() => {
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
                      <img
                        src={item.full}
                        alt={item.title || `Photo ${index + 1}`}
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
                    </div>
                  </SwiperSlide>
                );
              })()
            ))}
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
