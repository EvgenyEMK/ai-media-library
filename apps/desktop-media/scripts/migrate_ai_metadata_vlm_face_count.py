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
    for key in ("rotation_decision", "two_pass_rotation_consistency", "face_rotation_override"):
        if key in metadata:
            del metadata[key]
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


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "One-off rewrite for ai_metadata people shape: move legacy people fields under "
            "people.vlm_analysis, populate people.face_count from legacy number_of_people, "
            "remove face_orientation + rotation debug keys, and sync media_items.people_detected."
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
        "SELECT id, ai_metadata FROM media_items WHERE ai_metadata IS NOT NULL"
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
