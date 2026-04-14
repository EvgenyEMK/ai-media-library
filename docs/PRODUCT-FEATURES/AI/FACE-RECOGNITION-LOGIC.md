# FACE RECOGNITION LOGIC

## Scope

This document describes the current face recognition logic used in the desktop media app:
- Face detection and embedding generation
- Auto-grouping of unnamed faces
- Person-tag assignment and related-face suggestion
- Operational guidelines for quality and long-term maintenance

---

## 1. End-to-End Pipeline

1. Face detection creates face instances with bounding boxes, confidence, and landmarks.
2. Embedding generation computes an ArcFace vector per detected face.
3. Each face embedding is stored on the face instance (`embedding_json`, status = `ready`).
4. Unnamed faces can be auto-grouped into clusters using embedding similarity.
5. Users assign a face (or cluster) to a person tag.
6. For each person tag, a centroid vector is computed from all tagged face embeddings.
7. Related-face suggestions for a person use nearest-neighbor search against this centroid.

---

## 2. How Person Matching Works

### Person representation

- One person tag is represented by one centroid embedding.
- Centroid = arithmetic mean of all tagged, ready embeddings for that tag.
- Centroid is L2-normalized before storage.

### Candidate retrieval

- Search runs over faces with ready embeddings.
- Already tagged faces are excluded from suggestions.
- Faces already tagged to the same person are excluded.
- Similarity threshold is applied (default around 0.6).
- Top matches are returned (bounded by limit).

### Effect of assigning additional faces

- Assigning a face to a person triggers centroid recomputation for that person.
- Clearing a face tag also triggers centroid recomputation.
- Assigning a cluster to a person triggers centroid recomputation.

Interpretation: yes, adding correct faces generally improves future matching because the person centroid is updated from the expanded sample set.

---

## 3. Auto-Grouping (Unnamed Faces)

- Only untagged faces with ready embeddings are grouped.
- Clustering is agglomerative (single-linkage) with cosine similarity threshold.
- Default threshold is lower than person matching threshold (grouping is broader).
- Clusters below minimum size are dropped.
- Representative face in a cluster is selected by highest detection confidence.

Purpose: accelerate manual naming by letting users label groups in bulk.

---

## 4. Data Volume Strategy Per Person

### Is more data always better?

Not always. More samples help only if labels are correct and face quality is acceptable.

### Practical recommendation

- Keep many samples when they are clean and diverse.
- Prioritize diversity (pose, lighting, age period) over raw count.
- Remove obvious mislabels and unusable faces (extreme blur/occlusion/tiny crops).
- Hundreds of good samples are generally useful; thousands are acceptable if quality is controlled.

### Why this matters

Current centroid logic is an unweighted mean. Outliers and mislabels pull the centroid and may increase false matches.

---

## 5. Age Progression (Baby -> Child -> Adult)

### Current behavior

- One centroid per person is used for all ages.
- This works for moderate appearance changes, but large age gaps can reduce accuracy.

### Recommended direction

Use multi-prototype identity modeling:
- Keep one person tag, but maintain several representative sub-centroids (e.g., childhood, adolescence, adult).
- Match against the best similarity across prototypes.
- Optionally expose these sub-groups as internal technical buckets and/or user-visible filters.

### Industry practice

Established systems commonly:
- Keep a single identity graph with multiple exemplars over time.
- Continuously refine from user confirmations.
- Use quality-aware weighting, outlier suppression, and periodic background recalibration.

---

## 6. Quality and Governance Principles

1. Label quality is the primary determinant of match quality.
2. Wrong assignments are high-impact and should be corrected early.
3. Similarity thresholds should be calibrated on real library data (precision/recall trade-off).
4. Clustering should be treated as suggestion, not truth.
5. Keep an operational loop: detect -> embed -> review -> assign -> re-evaluate.

---

## 7. Known Current Constraints

- Centroid updates are tied to assignment flows; they are not fully event-driven for every embedding lifecycle change.
- Single centroid per person may underfit multi-modal identities (age, style, appearance transitions).
- Clustering is O(N^2) over untagged embeddings; acceptable for moderate scale, expensive at very large scale.
- Mean-centroid approach does not currently weight by confidence/quality.

---

## 8. Future Enhancements (Recommended)

1. Trigger centroid recompute on every relevant mutation:
   - new embedding for tagged face
   - tagged face deletion
   - embedding status recovery/failure changes
2. Add quality weighting (confidence, crop size, sharpness) for centroid updates.
3. Add multi-prototype support per person.
4. Add outlier detection to protect centroids from mislabeled faces.
5. Add threshold tuning tooling and monitoring metrics (precision, false accept/reject trends).

---

## 9. Operational Policy (Human Workflow)

- Start with high-confidence, front-facing exemplars for each person.
- Expand gradually with diverse but reliable samples.
- Review low-similarity suggestions manually before assignment.
- Periodically clean person tags by removing obvious mistakes.
- Re-run matching after significant curation rounds.

This policy improves stability over time and keeps suggestions useful as the library grows.

---

## 10. IMPROVEMENT PLAN

### Identity modeling upgrades

1. Move from single-centroid person representation to multi-prototype representation:
   - Keep one person tag (single identity).
   - Maintain multiple sub-centroids/exemplars per person.
   - Match a query face against all prototypes and use the best similarity.
2. Use age as a soft routing/ranking signal, not a hard gating rule:
   - Optional broad age bins (if needed): 0-5, 6-12, 13-17, 18-34, 35-54, 55+.
   - If age confidence is low, ignore age in ranking.
3. Prefer appearance-driven prototype creation:
   - Cluster each person's embeddings into a small number of modes (for example 2-6).
   - Let these modes capture age, hairstyle, glasses, beard, makeup, and lighting changes.

### Inference and update pipeline

4. For every new face box:
   - Detect -> embed (existing flow).
   - Compute quality metrics (sharpness/blur, face size, occlusion/landmarks confidence, pose).
   - Optionally estimate age range + confidence.
5. Candidate scoring:
   - For each person, compute max cosine similarity across prototypes.
   - Re-rank with soft priors (timestamp proximity, age-range compatibility, quality).
6. Prototype update policy:
   - On confirmed assignment, update nearest prototype using quality-weighted mean/EMA.
   - High-quality samples get higher weight; low-quality or outlier-like samples get reduced weight.
7. Background maintenance jobs:
   - Merge near-duplicate prototypes.
   - Split prototypes with high internal variance.
   - Recompute prototype centroids periodically after major curation.

### Data and operations

8. Add storage structures for prototype-level state:
   - person_prototypes: person_id, centroid, sample_count, quality_sum, optional age_bin/time-span metadata.
   - face_prototype_links: face_id, prototype_id, similarity, quality, optional age prediction metadata.
9. Calibrate thresholds on real library data:
   - Measure precision/recall and false accept/reject trends.
   - Tune separately for auto-grouping and person suggestion.
10. Rollout strategy:
   - Phase 1: quality-aware weighting and outlier suppression with existing centroid logic.
   - Phase 2: multi-prototype retrieval and updates.
   - Phase 3: optional age estimator integration and re-ranking.

---

## 11. REASONING and Q&A

### Core reasoning

- Multi-prototype identity modeling is more robust than one global centroid when a person has multiple appearance modes.
- Broad age groups can help ranking in large age gaps, but strict age partitions increase brittleness and missed matches.
- Quality scoring usually delivers higher practical gains than age estimation, because poor crops are a major source of centroid drift.
- Using age as an optional soft feature improves explainability without turning age-estimator error into hard recognition error.
- Max-over-prototypes matching preserves one-identity UX while capturing long-term changes (childhood -> adulthood) and style variation.
- Quality-weighted updates and outlier suppression reduce false positives caused by mislabels and low-quality detections.
- Periodic merge/split maintenance keeps prototype sets compact and accurate as libraries grow.

### Q1: What are best practices for age-based sub-profiles?

- Treat age as a helper feature, not as identity truth.
- Keep age buckets broad to avoid sparse or unstable bins:
  - 0-5 (early childhood), 6-12 (child), 13-17 (teen), 18-34 (young adult), 35-54 (adult), 55+ (older adult).
- Keep one person identity with multiple prototypes; do not split person IDs by age period.
- Use age only to re-rank or explain a suggestion, never as a hard gate unless confidence and policy requirements are very strict.
- If age confidence is low, ignore age and rely on embedding similarity + quality + timestamp/context.

### Q2: Are there better organizing options than age groups?

Yes. In many real libraries, these options outperform fixed age bins:

- Appearance-driven prototypes (recommended default):
  - Build 2-6 clusters per person from embeddings.
  - Clusters naturally capture age and non-age variation (beard, glasses, hair, makeup, lighting).
- Time-epoch organization:
  - Group by capture date windows (for example, older years vs recent years).
  - Useful when timestamp metadata is reliable.
- Quality-tier organization:
  - Separate "gold" exemplars from lower-quality samples.
  - Use gold samples to anchor centroids and reduce drift.
- Hybrid organization:
  - Primary: appearance prototypes.
  - Secondary metadata: age range estimate, timestamp span, source/camera domain.

### Q3: Should every new face box run age and quality models?

Recommended production policy:

- Quality model: yes (high priority).
  - Compute quality for each detected face box (sharpness, face size, pose, occlusion, landmark confidence).
  - Use quality to filter unusable faces and weight prototype updates.
- Age model: optional (medium priority).
  - Run if compute budget allows and store age range + confidence.
  - Use as a soft ranking prior and UI hint, not as a strict acceptance criterion.
- Assignment update:
  - On confirmed assignment, update nearest prototype with quality-weighted mean/EMA.
  - Down-weight low-quality or outlier-like samples.

### Practical takeaway

- If only one additional model can be added now, add quality scoring first.
- Add age estimation later for better ranking/context in long age-span datasets.
- Keep the system identity-centric (one person, many prototypes) with optional metadata signals.
