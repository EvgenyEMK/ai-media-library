#!/usr/bin/env python3
"""
Inspect face rows / embeddings for a library photo (stdlib sqlite3 only).

Example:
  python scripts/diagnose_face_tag_suggest.py ^
    --db "%APPDATA%\\Electron\\desktop-media.db" ^
    --image "C:\\EMK-Media\\Photo 2018\\_2018 BEST\\DSC_0062_3b.jpg"
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sqlite3
import sys


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--db", required=True, help="Path to desktop-media.db")
    p.add_argument("--image", required=True, help="Full path to image file")
    return p.parse_args()


def cos(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


def main() -> int:
    args = parse_args()
    db_path = os.path.expandvars(os.path.expanduser(args.db))
    image_path = os.path.normpath(os.path.expandvars(os.path.expanduser(args.image)))

    if not os.path.isfile(db_path):
        print("DB not found:", db_path, file=sys.stderr)
        return 1

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    variants = list({image_path, image_path.lower(), image_path.upper()})
    placeholders = ",".join("?" * len(variants))
    row = conn.execute(
        f"SELECT id, source_path, library_id FROM media_items "
        f"WHERE deleted_at IS NULL AND source_path IN ({placeholders})",
        variants,
    ).fetchone()

    if not row:
        print("No media_items row for path. Tried:", variants[:3], "...")
        base = os.path.basename(image_path)
        like = conn.execute(
            "SELECT id, source_path FROM media_items WHERE deleted_at IS NULL AND "
            "(source_path LIKE ? OR source_path LIKE ?)",
            (f"%{base}", f"%{base.lower()}"),
        ).fetchall()
        if like:
            print("Same basename (sample):", like[:10])
        conn.close()
        return 2

    mid, stored_path, library_id = row
    print("media_item id:", mid)
    print("stored source_path:", stored_path)
    print("library_id:", library_id)

    faces = conn.execute(
        "SELECT id, tag_id, embedding_status, "
        "CASE WHEN embedding_json IS NOT NULL AND length(embedding_json) > 2 THEN 1 ELSE 0 END "
        "FROM media_face_instances WHERE media_item_id = ? AND library_id = ? ORDER BY rowid",
        (mid, library_id),
    ).fetchall()
    print("face_instances (id, tag_id, embedding_status, has_embedding_json):", faces)

    tagged = conn.execute(
        "SELECT COUNT(*) FROM media_face_instances fi WHERE fi.library_id = ? "
        "AND fi.tag_id IS NOT NULL AND fi.embedding_json IS NOT NULL "
        "AND (fi.embedding_status = 'ready' OR fi.embedding_status IS NULL)",
        (library_id,),
    ).fetchone()[0]
    print("tagged faces with usable embeddings in library:", tagged)

    if not faces or not faces[0][3]:
        conn.close()
        return 0

    face_id = faces[0][0]
    emb_row = conn.execute(
        "SELECT embedding_json FROM media_face_instances WHERE id = ?", (face_id,)
    ).fetchone()
    if not emb_row or not emb_row[0]:
        conn.close()
        return 0
    v = json.loads(emb_row[0])

    best = 0.0
    best_tag: tuple[str, str] | None = None
    for emb_json, tag_id, name in conn.execute(
        "SELECT fi.embedding_json, fi.tag_id, t.name FROM media_face_instances fi "
        "LEFT JOIN media_tags t ON t.id = fi.tag_id "
        "WHERE fi.library_id = ? AND fi.tag_id IS NOT NULL AND fi.embedding_json IS NOT NULL "
        "AND (fi.embedding_status = 'ready' OR fi.embedding_status IS NULL) AND fi.id != ?",
        (library_id, face_id),
    ):
        w = json.loads(emb_json)
        if len(w) != len(v):
            continue
        s = cos(v, w)
        if s > best:
            best = s
            best_tag = (tag_id, name or "")
    print("best cosine vs tagged face:", round(best, 4), best_tag)

    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
