import { useEffect, useState } from "react";
import type { ImageEditSuggestionsItem } from "@emk/media-viewer";
import type { RotationReviewScope } from "../types/app-types";

interface RotationReviewItemsState {
  items: ImageEditSuggestionsItem[];
  total: number;
  loading: boolean;
  error: string | null;
}

export function useRotationReviewItems(
  scope: RotationReviewScope | null,
  page: number,
  pageSize: number,
): RotationReviewItemsState {
  const [state, setState] = useState<RotationReviewItemsState>({
    items: [],
    total: 0,
    loading: false,
    error: null,
  });

  useEffect(() => {
    let active = true;
    if (!scope) {
      setState({ items: [], total: 0, loading: false, error: null });
      return () => {
        active = false;
      };
    }

    setState((current) => ({ ...current, loading: true, error: null }));
    void window.desktopApi
      .getFolderAiWronglyRotatedImages({
        folderPath: scope.folderPath,
        recursive: scope.includeSubfolders,
        page,
        pageSize,
      })
      .then((result) => {
        if (!active) return;
        setState({
          total: result.total,
          loading: false,
          error: null,
          items: result.items.map((item): ImageEditSuggestionsItem => ({
            id: item.sourcePath,
            title: item.name,
            imageUrl: item.imageUrl,
            folderPathRelative: scope.includeSubfolders ? item.folderPathRelative : null,
            suggestions: [
              {
                editType: "rotate",
                priority: "high",
                reason: "Orientation detection suggests rotating this image.",
                rotationAngleClockwise: item.rotationAngleClockwise,
                cropRel: null,
              },
              ...(item.cropRel
                ? [
                    {
                      editType: "crop",
                      priority: "medium" as const,
                      reason: "Crop suggestion from image analysis.",
                      rotationAngleClockwise: null,
                      cropRel: item.cropRel,
                    },
                  ]
                : []),
            ],
          })),
        });
      })
      .catch(() => {
        if (!active) return;
        setState({
          items: [],
          total: 0,
          loading: false,
          error: "Unable to load wrongly rotated images.",
        });
      });

    return () => {
      active = false;
    };
  }, [page, pageSize, scope]);

  return state;
}
