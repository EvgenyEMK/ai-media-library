import argparse
import datetime as dt
import json
import sqlite3
from pathlib import Path
from typing import Any


def _as_int_count(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        if value != value:  # NaN guard
            return None
        if value < 0:
            return 0
        return int(value)
    return None


def _sanitize_metadata_in_place(metadata: dict[str, Any]) -> bool:
    changed = False
    provenance = metadata.get("provenance")
    if isinstance(provenance, dict):
        if metadata.get("metadata_version") is None and provenance.get("metadata_version") is not None:
            metadata["metadata_version"] = provenance.get("metadata_version")
            changed = True
        file_data = metadata.get("file_data")
        if not isinstance(file_data, dict):
            file_data = {}
            metadata["file_data"] = file_data
            changed = True
        if (
            file_data.get("metadata_extracted_at") is None
            and provenance.get("metadata_extracted_at") is not None
        ):
            file_data["metadata_extracted_at"] = provenance.get("metadata_extracted_at")
            changed = True
        del metadata["provenance"]
        changed = True

    if metadata.get("ai") is not None and metadata.get("image_analysis") is None:
        metadata["image_analysis"] = metadata.get("ai")
        changed = True
    if "ai" in metadata:
        del metadata["ai"]
        changed = True

    technical = metadata.get("technical")
    embedded = metadata.get("embedded")
    if technical is not None or embedded is not None:
        file_data = metadata.get("file_data")
        if not isinstance(file_data, dict):
            file_data = {}
            metadata["file_data"] = file_data
            changed = True
        if technical is not None and file_data.get("technical") is None:
            file_data["technical"] = technical
            changed = True
        if embedded is not None and file_data.get("exif_xmp") is None:
            file_data["exif_xmp"] = embedded
            changed = True
    if "technical" in metadata:
        del metadata["technical"]
        changed = True
    if "embedded" in metadata:
        del metadata["embedded"]
        changed = True

    for key in ("rotation_decision", "two_pass_rotation_consistency", "face_rotation_override"):
        if key in metadata:
            del metadata[key]
            changed = True

    image_analysis = metadata.get("image_analysis")
    if not isinstance(image_analysis, dict):
        image_analysis = {}
        metadata["image_analysis"] = image_analysis
        changed = True

    # Move historically leaked top-level AI-analysis fields into image_analysis.
    if image_analysis.get("is_low_quality") is None and isinstance(metadata.get("is_low_quality"), bool):
        image_analysis["is_low_quality"] = metadata.get("is_low_quality")
        changed = True
    if image_analysis.get("edit_suggestions") is None and metadata.get("edit_suggestions") is not None:
        image_analysis["edit_suggestions"] = metadata.get("edit_suggestions")
        changed = True
    if image_analysis.get("photo_estetic_quality") is None and isinstance(
        metadata.get("photo_estetic_quality"), (int, float)
    ):
        image_analysis["photo_estetic_quality"] = metadata.get("photo_estetic_quality")
        changed = True
    if "quality_issues" in metadata and image_analysis.get("quality_issues") is None:
        image_analysis["quality_issues"] = metadata.get("quality_issues")
        changed = True

    for key in (
        "is_low_quality",
        "quality_issues",
        "edit_suggestions",
        "photo_estetic_quality",
        "photo_star_rating_1_5",
        "star_rating_1_5",
    ):
        if key in metadata:
            del metadata[key]
            changed = True

    if isinstance(image_analysis, dict):
        if "photo_star_rating_1_5" in image_analysis:
            del image_analysis["photo_star_rating_1_5"]
            changed = True
        if "star_rating_1_5" in image_analysis:
            del image_analysis["star_rating_1_5"]
            changed = True

        quality_issues = image_analysis.get("quality_issues")
        if isinstance(quality_issues, list):
            normalized_quality_issues = [
                entry.strip()
                for entry in quality_issues
                if isinstance(entry, str) and entry.strip() and entry.strip().lower() != "none"
            ]
            if normalized_quality_issues != quality_issues:
                image_analysis["quality_issues"] = normalized_quality_issues
                changed = True
        elif isinstance(quality_issues, dict):
            normalized_quality_issues = [
                quality_issues[k].strip()
                for k in sorted(quality_issues.keys(), key=lambda x: int(x) if str(x).isdigit() else 10**9)
                if str(k).isdigit()
                and isinstance(quality_issues[k], str)
                and quality_issues[k].strip()
                and quality_issues[k].strip().lower() != "none"
            ]
            image_analysis["quality_issues"] = normalized_quality_issues
            changed = True

    people = metadata.get("people")
    if not isinstance(people, dict):
        return changed

    legacy_number = people.get("number_of_people")
    legacy_has_children = people.get("has_children")
    legacy_people_detected = people.get("people_detected")

    vlm = people.get("vlm_analysis")
    if not isinstance(vlm, dict):
        vlm = {}
        people["vlm_analysis"] = vlm
        changed = True

    if vlm.get("number_of_people") is None:
        v = _as_int_count(legacy_number)
        if v is not None:
            vlm["number_of_people"] = v
            changed = True
    if vlm.get("has_children") is None and isinstance(legacy_has_children, bool):
        vlm["has_children"] = legacy_has_children
        changed = True
    if vlm.get("people_detected") is None and isinstance(legacy_people_detected, list):
        vlm["people_detected"] = legacy_people_detected
        changed = True

    if people.get("face_count") is None:
        legacy_count = _as_int_count(legacy_number)
        if legacy_count is not None:
            people["face_count"] = legacy_count
            changed = True

    for key in ("number_of_people", "has_children", "people_detected"):
        if key in people:
            del people[key]
            changed = True

    detections = people.get("detections")
    if isinstance(detections, dict) and "face_orientation" in detections:
        del detections["face_orientation"]
        changed = True

    return changed


def _derive_people_detected(metadata: dict[str, Any]) -> int | None:
    people = metadata.get("people")
    if not isinstance(people, dict):
        return None
    face_count = _as_int_count(people.get("face_count"))
    if face_count is not None:
        return face_count
    vlm = people.get("vlm_analysis")
    if not isinstance(vlm, dict):
        return None
    return _as_int_count(vlm.get("number_of_people"))


def _normalize_display_title(metadata: dict[str, Any], filename: str | None) -> bool:
    if not filename:
        return False
    path_extraction = metadata.get("path_extraction")
    if not isinstance(path_extraction, dict):
        return False
    display_title = path_extraction.get("display_title")
    if not isinstance(display_title, str):
        return False
    filename_stem = Path(filename).stem.strip()
    if not filename_stem:
        return False
    if display_title.strip() != filename_stem:
        return False
    del path_extraction["display_title"]
    return True


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "One-off rewrite for ai_metadata schema normalization: move legacy ai/technical/embedded "
            "keys to image_analysis/file_data, normalize people.vlm_analysis + face_count, "
            "drop AI star_rating fields, normalize quality_issues, "
            "drop display_title when it equals filename stem, and sync media_items.people_detected."
        )
    )
    parser.add_argument("--db", required=True, help="Absolute path to desktop-media.db")
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.is_absolute():
        raise SystemExit(f"--db must be an absolute path, got: {db_path}")
    if not db_path.exists():
        raise SystemExit(f"DB file not found: {db_path}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    rows = cur.execute(
        "SELECT id, filename, ai_metadata FROM media_items WHERE ai_metadata IS NOT NULL"
    ).fetchall()
    now = dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    updated = 0
    skipped = 0
    try:
        cur.execute("BEGIN")
        for row in rows:
            raw = row["ai_metadata"]
            try:
                parsed = json.loads(raw)
            except Exception:
                skipped += 1
                continue
            if not isinstance(parsed, dict):
                skipped += 1
                continue

            changed = _sanitize_metadata_in_place(parsed)
            changed = _normalize_display_title(parsed, row["filename"]) or changed
            if not changed:
                skipped += 1
                continue

            people_detected = _derive_people_detected(parsed)
            cur.execute(
                "UPDATE media_items SET ai_metadata = ?, people_detected = ?, updated_at = ? WHERE id = ?",
                (json.dumps(parsed, ensure_ascii=True), people_detected, now, row["id"]),
            )
            updated += 1

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print(f"[metadata-migrate] DB: {db_path}")
    print(f"[metadata-migrate] scanned={len(rows)} updated={updated} skipped={skipped}")


if __name__ == "__main__":
    main()
