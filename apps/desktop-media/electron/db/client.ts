import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

type SQLiteDatabase = Database.Database;
export type VectorBackendMode = "classic" | "sqlite-vec";

const DESKTOP_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_libraries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_items (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  source_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  byte_size INTEGER,
  file_mtime_ms INTEGER,
  orientation INTEGER,
  file_created_at TEXT,
  checksum_sha256 TEXT,
  photo_taken_at TEXT,
  location_name TEXT,
  latitude REAL,
  longitude REAL,
  metadata_extracted_at TEXT,
  metadata_version TEXT,
  metadata_error TEXT,
  duplicate_group_id TEXT,
  ai_metadata TEXT,
  storage_metadata TEXT,
  city TEXT,
  country TEXT,
  people_detected INTEGER,
  age_min REAL,
  age_max REAL,
  photo_analysis_processed_at TEXT,
  face_detection_processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_items_library_id ON media_items (library_id);
CREATE INDEX IF NOT EXISTS idx_media_items_checksum_sha256 ON media_items (checksum_sha256);
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_items_library_source_path ON media_items (library_id, source_path);
CREATE INDEX IF NOT EXISTS idx_media_items_city ON media_items (library_id, city);
CREATE INDEX IF NOT EXISTS idx_media_items_country ON media_items (library_id, country);
CREATE INDEX IF NOT EXISTS idx_media_items_source_path ON media_items (library_id, source_path);
CREATE INDEX IF NOT EXISTS idx_media_items_file_mtime ON media_items (library_id, file_mtime_ms);
CREATE INDEX IF NOT EXISTS idx_media_items_duplicate_group ON media_items (library_id, duplicate_group_id);
CREATE INDEX IF NOT EXISTS idx_media_items_photo_analysis_processed
  ON media_items (library_id, photo_analysis_processed_at);
CREATE INDEX IF NOT EXISTS idx_media_items_face_detection_processed
  ON media_items (library_id, face_detection_processed_at);

CREATE TABLE IF NOT EXISTS media_albums (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cover_media_item_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_albums_library_id ON media_albums (library_id);

CREATE TABLE IF NOT EXISTS media_album_items (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  media_album_id TEXT NOT NULL,
  media_item_id TEXT NOT NULL,
  position INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(media_album_id, media_item_id)
);
CREATE INDEX IF NOT EXISTS idx_media_album_items_library_id ON media_album_items (library_id);

CREATE TABLE IF NOT EXISTS album_categories (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(library_id, parent_id, name)
);
CREATE INDEX IF NOT EXISTS idx_album_categories_library_parent
  ON album_categories (library_id, parent_id);

CREATE TABLE IF NOT EXISTS media_album_categories (
  album_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  library_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (album_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_media_album_categories_library
  ON media_album_categories (library_id, category_id);

CREATE TABLE IF NOT EXISTS media_album_person_tags (
  album_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  library_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (album_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_media_album_person_tags_library
  ON media_album_person_tags (library_id, tag_id);

CREATE TABLE IF NOT EXISTS media_tags (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tag_type TEXT NOT NULL,
  birth_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(library_id, name, tag_type)
);
CREATE INDEX IF NOT EXISTS idx_media_tags_library_id ON media_tags (library_id);

CREATE TABLE IF NOT EXISTS media_item_tags (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  media_item_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(media_item_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_media_item_tags_library_id ON media_item_tags (library_id);

CREATE TABLE IF NOT EXISTS media_face_instances (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  media_item_id TEXT NOT NULL,
  tag_id TEXT,
  source TEXT NOT NULL,
  confidence REAL,
  bbox_x REAL,
  bbox_y REAL,
  bbox_width REAL,
  bbox_height REAL,
  embedding_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_face_instances_library_id ON media_face_instances (library_id);
CREATE INDEX IF NOT EXISTS idx_media_face_instances_item_id ON media_face_instances (media_item_id);

CREATE TABLE IF NOT EXISTS sync_operation_log (
  operation_id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  media_id TEXT,
  operation_type TEXT NOT NULL,
  actor_id TEXT,
  occurred_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_operation_log_library_id ON sync_operation_log (library_id);
CREATE INDEX IF NOT EXISTS idx_sync_operation_log_sync_status ON sync_operation_log (sync_status);

CREATE TABLE IF NOT EXISTS sync_checkpoint (
  library_id TEXT PRIMARY KEY,
  last_pushed_at TEXT,
  last_pulled_at TEXT,
  last_operation_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  conflict_type TEXT NOT NULL,
  local_payload_json TEXT NOT NULL,
  remote_payload_json TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_library_id ON sync_conflicts (library_id);

CREATE TABLE IF NOT EXISTS fs_objects (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  current_path TEXT NOT NULL,
  volume_id TEXT,
  os_file_id TEXT,
  file_size INTEGER,
  mtime_ms INTEGER,
  ctime_ms INTEGER,
  quick_fingerprint TEXT,
  strong_hash TEXT,
  duplicate_group_id TEXT,
  deleted_at TEXT,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fs_objects_library_path ON fs_objects (library_id, current_path);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fs_objects_library_path ON fs_objects (library_id, current_path);
CREATE INDEX IF NOT EXISTS idx_fs_objects_library_file_id ON fs_objects (library_id, volume_id, os_file_id);
CREATE INDEX IF NOT EXISTS idx_fs_objects_strong_hash ON fs_objects (strong_hash);

CREATE TABLE IF NOT EXISTS folder_analysis_status (
  library_id TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  photo_in_progress INTEGER NOT NULL DEFAULT 0,
  face_in_progress INTEGER NOT NULL DEFAULT 0,
  semantic_in_progress INTEGER NOT NULL DEFAULT 0,
  photo_analyzed_at TEXT,
  face_analyzed_at TEXT,
  semantic_indexed_at TEXT,
  metadata_scanned_at TEXT,
  last_updated_at TEXT NOT NULL,
  PRIMARY KEY (library_id, folder_path)
);
CREATE INDEX IF NOT EXISTS idx_folder_analysis_status_library_id ON folder_analysis_status (library_id);

CREATE TABLE IF NOT EXISTS media_embeddings (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  media_item_id TEXT NOT NULL,
  embedding_type TEXT NOT NULL,
  model_version TEXT NOT NULL,
  dimension INTEGER NOT NULL,
  vector_json TEXT NOT NULL,
  embedding_source TEXT NOT NULL DEFAULT 'direct_image',
  embedding_status TEXT NOT NULL DEFAULT 'ready',
  indexed_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(library_id, media_item_id, embedding_type, model_version)
);
CREATE INDEX IF NOT EXISTS idx_media_embeddings_library_id ON media_embeddings (library_id);
CREATE INDEX IF NOT EXISTS idx_media_embeddings_media_item_id ON media_embeddings (media_item_id);
CREATE INDEX IF NOT EXISTS idx_media_embeddings_lookup
  ON media_embeddings (library_id, embedding_type, model_version, embedding_status);
`;

const MIGRATIONS: Array<{ id: string; sql: string }> = [
  {
    id: "001_face_recognition_columns",
    sql: `
      ALTER TABLE media_face_instances ADD COLUMN landmarks_json TEXT;
      ALTER TABLE media_face_instances ADD COLUMN embedding_model TEXT;
      ALTER TABLE media_face_instances ADD COLUMN embedding_dimension INTEGER;
      ALTER TABLE media_face_instances ADD COLUMN embedding_status TEXT DEFAULT NULL;
      ALTER TABLE media_face_instances ADD COLUMN cluster_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_media_face_instances_tag_id
        ON media_face_instances (library_id, tag_id);
      CREATE INDEX IF NOT EXISTS idx_media_face_instances_cluster_id
        ON media_face_instances (library_id, cluster_id);
      CREATE INDEX IF NOT EXISTS idx_media_face_instances_embedding_status
        ON media_face_instances (library_id, embedding_status);
    `,
  },
  {
    id: "002_person_centroids",
    sql: `
      CREATE TABLE IF NOT EXISTS person_centroids (
        tag_id TEXT PRIMARY KEY,
        library_id TEXT NOT NULL,
        embedding_model TEXT NOT NULL,
        embedding_dimension INTEGER NOT NULL,
        centroid_json TEXT NOT NULL,
        sample_count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_person_centroids_library_id
        ON person_centroids (library_id);
    `,
  },
  {
    id: "004_face_crop_path",
    sql: `
      ALTER TABLE media_face_instances ADD COLUMN crop_path TEXT;
    `,
  },
  {
    id: "003_face_clusters",
    sql: `
      CREATE TABLE IF NOT EXISTS face_clusters (
        id TEXT PRIMARY KEY,
        library_id TEXT NOT NULL,
        cluster_label TEXT,
        representative_face_id TEXT,
        member_count INTEGER NOT NULL DEFAULT 0,
        merged_into_tag_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_face_clusters_library_id
        ON face_clusters (library_id);
      CREATE INDEX IF NOT EXISTS idx_face_clusters_merged
        ON face_clusters (library_id, merged_into_tag_id);
    `,
  },
  {
    id: "005_media_processed_markers",
    sql: `
      ALTER TABLE media_items ADD COLUMN photo_analysis_processed_at TEXT;
      ALTER TABLE media_items ADD COLUMN face_detection_processed_at TEXT;
      UPDATE media_items
      SET photo_analysis_processed_at = COALESCE(photo_analysis_processed_at, updated_at)
      WHERE ai_metadata IS NOT NULL;
      UPDATE media_items
      SET face_detection_processed_at = COALESCE(face_detection_processed_at, updated_at)
      WHERE EXISTS (
        SELECT 1
        FROM media_face_instances fi
        WHERE fi.library_id = media_items.library_id
          AND fi.media_item_id = media_items.id
      );
      CREATE INDEX IF NOT EXISTS idx_media_items_photo_analysis_processed
        ON media_items (library_id, photo_analysis_processed_at);
      CREATE INDEX IF NOT EXISTS idx_media_items_face_detection_processed
        ON media_items (library_id, face_detection_processed_at);
    `,
  },
  {
    id: "006_media_items_deleted_at",
    sql: `
      ALTER TABLE media_items ADD COLUMN deleted_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_media_items_deleted_at
        ON media_items (library_id, deleted_at);
    `,
  },
  {
    id: "007_media_item_sources",
    sql: `
      CREATE TABLE IF NOT EXISTS media_item_sources (
        id TEXT PRIMARY KEY,
        media_item_id TEXT NOT NULL,
        library_id TEXT NOT NULL,
        source_path TEXT NOT NULL,
        client_id TEXT NOT NULL DEFAULT 'local-default',
        fs_object_id TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        deleted_at TEXT,
        last_verified_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_media_item_sources_lib_path
        ON media_item_sources (library_id, source_path, client_id);
      CREATE INDEX IF NOT EXISTS idx_media_item_sources_media_item
        ON media_item_sources (media_item_id);
      CREATE INDEX IF NOT EXISTS idx_media_item_sources_fs_object
        ON media_item_sources (fs_object_id);
      CREATE INDEX IF NOT EXISTS idx_media_item_sources_status
        ON media_item_sources (library_id, status);

      INSERT OR IGNORE INTO media_item_sources (
        id, media_item_id, library_id, source_path, client_id,
        fs_object_id, is_primary, status, last_verified_at, created_at, updated_at
      )
      SELECT
        ('src-' || mi.id) AS id,
        mi.id AS media_item_id,
        mi.library_id,
        mi.source_path,
        'local-default' AS client_id,
        fso.id AS fs_object_id,
        1 AS is_primary,
        CASE WHEN mi.deleted_at IS NOT NULL THEN 'deleted' ELSE 'active' END AS status,
        COALESCE(fso.last_seen_at, mi.updated_at) AS last_verified_at,
        mi.created_at,
        mi.updated_at
      FROM media_items mi
      LEFT JOIN fs_objects fso
        ON fso.library_id = mi.library_id AND fso.current_path = mi.source_path;

      ALTER TABLE media_items ADD COLUMN content_hash TEXT;
      UPDATE media_items SET content_hash = checksum_sha256 WHERE checksum_sha256 IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_media_items_content_hash
        ON media_items (library_id, content_hash);
    `,
  },
  {
    id: "008_face_bbox_reference_dimensions",
    sql: `
      ALTER TABLE media_face_instances ADD COLUMN bbox_ref_width REAL;
      ALTER TABLE media_face_instances ADD COLUMN bbox_ref_height REAL;
      UPDATE media_face_instances AS fi
      SET
        bbox_ref_width = COALESCE(
          CAST(json_extract(mi.ai_metadata, '$.people.detections.image_size_for_bounding_boxes.width') AS REAL),
          CAST(json_extract(mi.ai_metadata, '$.image_size_for_bounding_boxes.width') AS REAL)
        ),
        bbox_ref_height = COALESCE(
          CAST(json_extract(mi.ai_metadata, '$.people.detections.image_size_for_bounding_boxes.height') AS REAL),
          CAST(json_extract(mi.ai_metadata, '$.image_size_for_bounding_boxes.height') AS REAL)
        )
      FROM media_items mi
      WHERE mi.id = fi.media_item_id
        AND fi.bbox_ref_width IS NULL
        AND (
          json_extract(mi.ai_metadata, '$.people.detections.image_size_for_bounding_boxes.width') IS NOT NULL
          OR json_extract(mi.ai_metadata, '$.image_size_for_bounding_boxes.width') IS NOT NULL
        );
    `,
  },
  {
    id: "009_folder_analysis_semantic",
    sql: `
      ALTER TABLE folder_analysis_status ADD COLUMN semantic_in_progress INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE folder_analysis_status ADD COLUMN semantic_indexed_at TEXT;
    `,
  },
  {
    id: "010_face_clusters_centroid",
    sql: `
      ALTER TABLE face_clusters ADD COLUMN centroid_json TEXT;
    `,
  },
  {
    id: "011_media_item_person_suggestions",
    sql: `
      CREATE TABLE IF NOT EXISTS media_item_person_suggestions (
        library_id TEXT NOT NULL,
        media_item_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        best_similarity REAL NOT NULL,
        exemplar_face_instance_id TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (library_id, media_item_id, tag_id)
      );
      CREATE INDEX IF NOT EXISTS idx_person_suggestions_tag
        ON media_item_person_suggestions (library_id, tag_id, best_similarity);
      CREATE INDEX IF NOT EXISTS idx_person_suggestions_media
        ON media_item_person_suggestions (library_id, media_item_id);
    `,
  },
  {
    id: "012_pipeline_failed_columns",
    sql: `
      ALTER TABLE media_items ADD COLUMN face_detection_failed_at TEXT;
      ALTER TABLE media_items ADD COLUMN face_detection_error TEXT;
      ALTER TABLE media_items ADD COLUMN photo_analysis_failed_at TEXT;
      ALTER TABLE media_items ADD COLUMN photo_analysis_error TEXT;
    `,
  },
  {
    id: "013_fts5_descriptions",
    sql: `
      CREATE VIRTUAL TABLE IF NOT EXISTS media_items_fts USING fts5(
        media_item_id UNINDEXED,
        library_id UNINDEXED,
        title,
        description,
        location,
        category,
        tokenize='porter unicode61'
      )
    `,
  },
  {
    id: "014_person_groups_and_similar_counts",
    sql: `
      ALTER TABLE person_centroids ADD COLUMN similar_untagged_face_count INTEGER;
      ALTER TABLE person_centroids ADD COLUMN similar_counts_updated_at TEXT;
      CREATE TABLE IF NOT EXISTS person_groups (
        id TEXT PRIMARY KEY,
        library_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(library_id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_person_groups_library_id ON person_groups (library_id);
      CREATE TABLE IF NOT EXISTS person_tag_groups (
        tag_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        library_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (tag_id, group_id)
      );
      CREATE INDEX IF NOT EXISTS idx_person_tag_groups_library ON person_tag_groups (library_id);
      CREATE INDEX IF NOT EXISTS idx_person_tag_groups_group ON person_tag_groups (library_id, group_id);
    `,
  },
  {
    id: "015_media_tags_person_pinned",
    sql: `
      ALTER TABLE media_tags ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    id: "016_media_items_photo_precision_star_rating",
    sql: `
      ALTER TABLE media_items ADD COLUMN photo_taken_precision TEXT;
      ALTER TABLE media_items ADD COLUMN star_rating INTEGER;
      CREATE INDEX IF NOT EXISTS idx_media_items_star_rating
        ON media_items (library_id, star_rating);
    `,
  },
  {
    id: "018_path_extraction_event_date_location",
    sql: `
      ALTER TABLE media_items ADD COLUMN event_date_start TEXT;
      ALTER TABLE media_items ADD COLUMN event_date_end TEXT;
      ALTER TABLE media_items ADD COLUMN event_date_precision TEXT;
      ALTER TABLE media_items ADD COLUMN event_date_source TEXT;
      ALTER TABLE media_items ADD COLUMN location_area TEXT;
      ALTER TABLE media_items ADD COLUMN location_place TEXT;
      ALTER TABLE media_items ADD COLUMN location_source TEXT;
      ALTER TABLE media_items ADD COLUMN display_title TEXT;
      ALTER TABLE media_items ADD COLUMN path_extraction_at TEXT;
      ALTER TABLE media_items ADD COLUMN path_llm_extraction_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_media_items_event_date
        ON media_items (library_id, event_date_start, event_date_end);
      CREATE INDEX IF NOT EXISTS idx_media_items_location
        ON media_items (library_id, country, city, location_area)
    `,
  },
  {
    id: "017_media_items_fts_rating_tokens",
    sql: `
      CREATE VIRTUAL TABLE IF NOT EXISTS media_items_fts_new USING fts5(
        media_item_id UNINDEXED,
        library_id UNINDEXED,
        title,
        description,
        location,
        category,
        rating_tokens,
        tokenize='porter unicode61'
      )
      ;
      INSERT INTO media_items_fts_new (
        media_item_id,
        library_id,
        title,
        description,
        location,
        category,
        rating_tokens
      )
      SELECT
        fts.media_item_id,
        fts.library_id,
        fts.title,
        fts.description,
        fts.location,
        fts.category,
        CASE
          WHEN mi.star_rating IS NULL THEN ''
          WHEN mi.star_rating = -1 THEN 'file_rating_rejected'
          WHEN mi.star_rating = 0 THEN 'file_rating_unrated'
          ELSE 'file_rating_' || CAST(mi.star_rating AS TEXT)
        END
      FROM media_items_fts fts
      LEFT JOIN media_items mi ON mi.id = fts.media_item_id AND mi.library_id = fts.library_id
      ;
      DROP TABLE media_items_fts
      ;
      ALTER TABLE media_items_fts_new RENAME TO media_items_fts
    `,
  },
  {
    id: "019_media_items_media_kind_video_duration",
    sql: `
      ALTER TABLE media_items ADD COLUMN media_kind TEXT NOT NULL DEFAULT 'image';
      ALTER TABLE media_items ADD COLUMN video_duration_sec REAL;
      UPDATE media_items SET media_kind = 'video' WHERE lower(COALESCE(mime_type, '')) LIKE 'video/%';
      UPDATE media_items SET media_kind = 'image' WHERE lower(COALESCE(mime_type, '')) LIKE 'image/%';
      UPDATE media_items SET media_kind = 'video' WHERE lower(filename) LIKE '%.mp4' OR lower(filename) LIKE '%.mov' OR lower(filename) LIKE '%.m4v' OR lower(filename) LIKE '%.webm' OR lower(filename) LIKE '%.mkv' OR lower(filename) LIKE '%.avi';
      UPDATE media_items SET media_kind = 'image' WHERE lower(filename) LIKE '%.jpg' OR lower(filename) LIKE '%.jpeg' OR lower(filename) LIKE '%.png' OR lower(filename) LIKE '%.gif' OR lower(filename) LIKE '%.bmp' OR lower(filename) LIKE '%.webp' OR lower(filename) LIKE '%.tif' OR lower(filename) LIKE '%.tiff'
    `,
  },
  {
    id: "020_face_subject_classification",
    sql: `
      ALTER TABLE media_face_instances ADD COLUMN bbox_area_image_ratio REAL;
      ALTER TABLE media_face_instances ADD COLUMN bbox_short_side_ratio_to_largest REAL;
      ALTER TABLE media_face_instances ADD COLUMN subject_role TEXT;
      ALTER TABLE media_face_instances ADD COLUMN detector_model TEXT;
      CREATE INDEX IF NOT EXISTS idx_media_face_instances_subject_role
        ON media_face_instances (library_id, subject_role);
    `,
  },
  {
    id: "021_face_age_gender",
    sql: `
      ALTER TABLE media_face_instances ADD COLUMN estimated_age_years REAL;
      ALTER TABLE media_face_instances ADD COLUMN estimated_gender TEXT;
      ALTER TABLE media_face_instances ADD COLUMN age_gender_confidence REAL;
      ALTER TABLE media_face_instances ADD COLUMN age_gender_model TEXT;
    `,
  },
  {
    id: "022_album_desktop_capabilities",
    sql: `
      ALTER TABLE media_albums ADD COLUMN cover_media_item_id TEXT;
      ALTER TABLE media_album_items ADD COLUMN position INTEGER;
      CREATE TABLE IF NOT EXISTS album_categories (
        id TEXT PRIMARY KEY,
        library_id TEXT NOT NULL,
        name TEXT NOT NULL,
        parent_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(library_id, parent_id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_album_categories_library_parent
        ON album_categories (library_id, parent_id);
      CREATE TABLE IF NOT EXISTS media_album_categories (
        album_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        library_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (album_id, category_id)
      );
      CREATE INDEX IF NOT EXISTS idx_media_album_categories_library
        ON media_album_categories (library_id, category_id);
      CREATE TABLE IF NOT EXISTS media_album_person_tags (
        album_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        library_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (album_id, tag_id)
      );
      CREATE INDEX IF NOT EXISTS idx_media_album_person_tags_library
        ON media_album_person_tags (library_id, tag_id);
    `,
  },
  {
    id: "023_folder_metadata_scan_timestamp",
    sql: `
      ALTER TABLE folder_analysis_status ADD COLUMN metadata_scanned_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_folder_analysis_status_metadata_scanned
        ON folder_analysis_status (library_id, metadata_scanned_at)
    `,
  },
  {
    id: "024_media_items_location_area2",
    sql: `
      ALTER TABLE media_items ADD COLUMN location_area2 TEXT;
      DROP INDEX IF EXISTS idx_media_items_location;
      CREATE INDEX IF NOT EXISTS idx_media_items_location_v2
        ON media_items (library_id, country, location_area, location_area2, city);
    `,
  },
  {
    id: "025_person_birth_date",
    sql: `
      ALTER TABLE media_tags ADD COLUMN birth_date TEXT;
    `,
  },
];

let db: SQLiteDatabase | null = null;
let mediaEmbeddingsCompatStatus = "not-checked";
let vectorBackendStatus: {
  requestedMode: VectorBackendMode;
  activeMode: VectorBackendMode;
  extensionLoaded: boolean;
  extensionPath: string | null;
  lastError: string | null;
} = {
  requestedMode: "classic",
  activeMode: "classic",
  extensionLoaded: false,
  extensionPath: null,
  lastError: null,
};

/**
 * One-time backfill: populates the FTS5 index from existing ai_metadata.
 * Runs on every startup but is a no-op once the index is already populated
 * (checks if rows exist to avoid duplicate work).
 */
function backfillFts5FromAiMetadata(database: SQLiteDatabase): void {
  try {
    const existing = database
      .prepare("SELECT COUNT(*) AS cnt FROM media_items_fts")
      .get() as { cnt: number } | undefined;
    if (existing && existing.cnt > 0) return;

    const rows = database
      .prepare(
        `SELECT mi.id, mi.library_id,
            COALESCE(
              NULLIF(TRIM(json_extract(mi.ai_metadata, '$.file_data.exif_xmp.title')), ''),
              json_extract(mi.ai_metadata, '$.image_analysis.title')
            ) AS title,
            COALESCE(
              NULLIF(TRIM(json_extract(mi.ai_metadata, '$.file_data.exif_xmp.description')), ''),
              json_extract(mi.ai_metadata, '$.image_analysis.description')
            ) AS description,
            COALESCE(
              NULLIF(TRIM(mi.location_name), ''),
              NULLIF(TRIM(json_extract(mi.ai_metadata, '$.file_data.exif_xmp.location_text')), '')
            ) AS location,
            json_extract(mi.ai_metadata, '$.image_analysis.image_category') AS category,
            CASE
              WHEN mi.star_rating IS NULL THEN ''
              WHEN mi.star_rating = -1 THEN 'file_rating_rejected'
              WHEN mi.star_rating = 0 THEN 'file_rating_unrated'
              ELSE 'file_rating_' || CAST(mi.star_rating AS TEXT)
            END AS rating_tokens
         FROM media_items mi
         WHERE mi.ai_metadata IS NOT NULL
           AND mi.photo_analysis_processed_at IS NOT NULL
           AND mi.deleted_at IS NULL`,
      )
      .all() as Array<{
      id: string;
      library_id: string;
      title: string | null;
      description: string | null;
      location: string;
      category: string | null;
      rating_tokens: string;
    }>;

    if (rows.length === 0) return;

    const insert = database.prepare(
      `INSERT INTO media_items_fts (media_item_id, library_id, title, description, location, category, rating_tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    database.transaction(() => {
      for (const row of rows) {
        if (!row.title && !row.description) continue;
        insert.run(
          row.id,
          row.library_id,
          row.title ?? "",
          row.description ?? "",
          row.location ?? "",
          row.category ?? "",
          row.rating_tokens ?? "",
        );
      }
    })();
    console.log(`[desktop-db] FTS5 backfill: indexed ${rows.length} items`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[desktop-db] FTS5 backfill skipped: ${msg}`);
  }
}

export function initDesktopDatabase(userDataPath: string): void {
  if (db) {
    return;
  }

  fs.mkdirSync(userDataPath, { recursive: true });
  const dbPath = path.join(userDataPath, "desktop-media.db");
  // Never wipe desktop DB by default during dev startup.
  // Opt-in reset remains available for explicit troubleshooting.
  if (process.env.EMK_DESKTOP_RESET_DB === "1") {
    resetDesktopDatabaseFiles(dbPath);
  }
  const nextDb = new Database(dbPath);
  nextDb.pragma("journal_mode = WAL");
  nextDb.pragma("synchronous = NORMAL");
  nextDb.pragma("foreign_keys = ON");

  nextDb.exec(DESKTOP_SCHEMA_SQL);
  runPendingMigrations(nextDb);
  reconcileCriticalSchema(nextDb);
  reconcileFolderAnalysisSemanticColumns(nextDb);
  reconcileFolderAnalysisMetadataScanColumn(nextDb);
  reconcileMediaEmbeddingsSchema(nextDb);
  backfillFts5FromAiMetadata(nextDb);
  initializeVectorBackend(nextDb);
  db = nextDb;
}

export function getDesktopDatabase(): SQLiteDatabase {
  if (!db) {
    throw new Error("Desktop database is not initialized");
  }
  return db;
}

/** Close the singleton DB (Vitest / isolated integration tests only). */
export function __closeDesktopDatabaseForTesting(): void {
  if (!db) {
    return;
  }
  try {
    db.close();
  } catch {
    // ignore
  }
  db = null;
}

export function getVectorBackendStatus(): {
  requestedMode: VectorBackendMode;
  activeMode: VectorBackendMode;
  extensionLoaded: boolean;
  extensionPath: string | null;
  lastError: string | null;
} {
  return vectorBackendStatus;
}

export function getMediaEmbeddingsCompatStatus(): string {
  return mediaEmbeddingsCompatStatus;
}

function runPendingMigrations(database: SQLiteDatabase): void {
  const applied = new Set(
    (
      database
        .prepare("SELECT id FROM schema_migrations")
        .all() as Array<{ id: string }>
    ).map((row) => row.id),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) {
      continue;
    }
    database.transaction(() => {
      for (const stmt of migration.sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)) {
        try {
          database.exec(stmt);
        } catch (error) {
          if (!isIgnorableMigrationStatementError(error)) {
            throw error;
          }
        }
      }
      database
        .prepare(
          "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
        )
        .run(migration.id, new Date().toISOString());
    })();
  }
}

function isIgnorableMigrationStatementError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("duplicate column name") ||
    message.includes("already exists")
  );
}

function reconcileCriticalSchema(database: SQLiteDatabase): void {
  const mediaItemsColumns = new Set(
    (
      database
        .prepare("PRAGMA table_info(media_items)")
        .all() as Array<{ name: string }>
    ).map((column) => column.name),
  );

  const addedPhotoAnalysisColumn = !mediaItemsColumns.has("photo_analysis_processed_at");
  if (addedPhotoAnalysisColumn) {
    database.exec("ALTER TABLE media_items ADD COLUMN photo_analysis_processed_at TEXT");
  }

  const addedFaceDetectionColumn = !mediaItemsColumns.has("face_detection_processed_at");
  if (addedFaceDetectionColumn) {
    database.exec("ALTER TABLE media_items ADD COLUMN face_detection_processed_at TEXT");
  }

  if (addedPhotoAnalysisColumn) {
    database.exec(`
      UPDATE media_items
      SET photo_analysis_processed_at = COALESCE(photo_analysis_processed_at, updated_at)
      WHERE ai_metadata IS NOT NULL
    `);
  }

  if (addedFaceDetectionColumn) {
    database.exec(`
      UPDATE media_items
      SET face_detection_processed_at = COALESCE(face_detection_processed_at, updated_at)
      WHERE EXISTS (
        SELECT 1
        FROM media_face_instances fi
        WHERE fi.library_id = media_items.library_id
          AND fi.media_item_id = media_items.id
      )
    `);
  }

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_media_items_photo_analysis_processed
      ON media_items (library_id, photo_analysis_processed_at)
  `);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_media_items_face_detection_processed
      ON media_items (library_id, face_detection_processed_at)
  `);

  if (!mediaItemsColumns.has("face_detection_failed_at")) {
    database.exec("ALTER TABLE media_items ADD COLUMN face_detection_failed_at TEXT");
  }
  if (!mediaItemsColumns.has("face_detection_error")) {
    database.exec("ALTER TABLE media_items ADD COLUMN face_detection_error TEXT");
  }
  if (!mediaItemsColumns.has("photo_analysis_failed_at")) {
    database.exec("ALTER TABLE media_items ADD COLUMN photo_analysis_failed_at TEXT");
  }
  if (!mediaItemsColumns.has("photo_analysis_error")) {
    database.exec("ALTER TABLE media_items ADD COLUMN photo_analysis_error TEXT");
  }
  if (!mediaItemsColumns.has("media_kind")) {
    database.exec("ALTER TABLE media_items ADD COLUMN media_kind TEXT NOT NULL DEFAULT 'image'");
  }
  if (!mediaItemsColumns.has("video_duration_sec")) {
    database.exec("ALTER TABLE media_items ADD COLUMN video_duration_sec REAL");
  }
}

function reconcileFolderAnalysisSemanticColumns(database: SQLiteDatabase): void {
  const columns = new Set(
    (
      database
        .prepare("PRAGMA table_info(folder_analysis_status)")
        .all() as Array<{ name: string }>
    ).map((column) => column.name),
  );
  if (!columns.has("semantic_in_progress")) {
    database.exec(
      "ALTER TABLE folder_analysis_status ADD COLUMN semantic_in_progress INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!columns.has("semantic_indexed_at")) {
    database.exec("ALTER TABLE folder_analysis_status ADD COLUMN semantic_indexed_at TEXT");
  }
}

function reconcileFolderAnalysisMetadataScanColumn(database: SQLiteDatabase): void {
  const columns = new Set(
    (
      database
        .prepare("PRAGMA table_info(folder_analysis_status)")
        .all() as Array<{ name: string }>
    ).map((column) => column.name),
  );
  if (!columns.has("metadata_scanned_at")) {
    database.exec("ALTER TABLE folder_analysis_status ADD COLUMN metadata_scanned_at TEXT");
  }
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_folder_analysis_status_metadata_scanned
      ON folder_analysis_status (library_id, metadata_scanned_at)
  `);
}

function reconcileMediaEmbeddingsSchema(database: SQLiteDatabase): void {
  const columns = new Set(
    (
      database
        .prepare("PRAGMA table_info(media_embeddings)")
        .all() as Array<{ name: string }>
    ).map((column) => column.name),
  );
  const added: string[] = [];

  if (!columns.has("embedding_source")) {
    database.exec(
      "ALTER TABLE media_embeddings ADD COLUMN embedding_source TEXT NOT NULL DEFAULT 'direct_image'",
    );
    added.push("embedding_source");
  }
  if (!columns.has("embedding_status")) {
    database.exec(
      "ALTER TABLE media_embeddings ADD COLUMN embedding_status TEXT NOT NULL DEFAULT 'ready'",
    );
    added.push("embedding_status");
  }
  if (!columns.has("indexed_at")) {
    database.exec("ALTER TABLE media_embeddings ADD COLUMN indexed_at TEXT");
    added.push("indexed_at");
  }
  if (!columns.has("last_error")) {
    database.exec("ALTER TABLE media_embeddings ADD COLUMN last_error TEXT");
    added.push("last_error");
  }
  database.exec(
    `CREATE INDEX IF NOT EXISTS idx_media_embeddings_lookup
      ON media_embeddings (library_id, embedding_type, model_version, embedding_status)`,
  );

  if (added.length > 0) {
    mediaEmbeddingsCompatStatus = `reconciled:${added.join(",")}`;
  } else {
    mediaEmbeddingsCompatStatus = "ok";
  }
}

function resetDesktopDatabaseFiles(dbPath: string): void {
  for (const suffix of ["", "-shm", "-wal"]) {
    const candidate = `${dbPath}${suffix}`;
    if (fs.existsSync(candidate)) {
      try {
        fs.rmSync(candidate);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[desktop-db] Failed to remove ${candidate}: ${message}`);
      }
    }
  }
}

function initializeVectorBackend(database: SQLiteDatabase): void {
  const requestedMode =
    process.env.EMK_DESKTOP_VECTOR_BACKEND?.toLowerCase() === "sqlite-vec"
      ? "sqlite-vec"
      : "classic";
  vectorBackendStatus = {
    requestedMode,
    activeMode: "classic",
    extensionLoaded: false,
    extensionPath: null,
    lastError: null,
  };

  if (requestedMode !== "sqlite-vec") {
    return;
  }

  const extensionPath = process.env.EMK_DESKTOP_SQLITE_VEC_PATH?.trim();
  if (!extensionPath) {
    vectorBackendStatus.lastError =
      "EMK_DESKTOP_SQLITE_VEC_PATH is not set. Falling back to classic backend.";
    return;
  }

  try {
    database.loadExtension(extensionPath);
    vectorBackendStatus = {
      requestedMode,
      activeMode: "sqlite-vec",
      extensionLoaded: true,
      extensionPath,
      lastError: null,
    };
  } catch (error) {
    vectorBackendStatus = {
      requestedMode,
      activeMode: "classic",
      extensionLoaded: false,
      extensionPath,
      lastError: error instanceof Error ? error.message : "Failed to load sqlite-vec extension",
    };
  }
}
