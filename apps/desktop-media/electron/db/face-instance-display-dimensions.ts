/**
 * Face instance bboxes (bbox_x/y/width/height) are in the same pixel space as
 * RetinaFace's decoded bitmap (`image_size_for_bounding_boxes` in ai_metadata),
 * which can differ from `media_items.width` / `media_items.height` (e.g. EXIF
 * storage dimensions vs browser-oriented decode size).
 *
 * Use these expressions whenever joining `media_face_instances fi` with `media_items mi`
 * to supply `imageWidth` / `imageHeight` for thumbnails, hover previews, and crops.
 */
export const FACE_BBOX_REF_WIDTH_SQL = "COALESCE(fi.bbox_ref_width, mi.width)";
export const FACE_BBOX_REF_HEIGHT_SQL = "COALESCE(fi.bbox_ref_height, mi.height)";
