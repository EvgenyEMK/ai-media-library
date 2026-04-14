# Image Rotation Detection: Current & Future Approaches

## Current implementation (as of March 2026)

### VLM-based detection (Qwen 3.5 9B via Ollama)

The primary rotation detection uses the vision language model to identify
whether a photo is sideways or upside-down. The VLM returns an
`observed_orientation` label and/or an `angle_degrees_clockwise` value
(90, 180, 270).

**Known limitation:** The VLM sometimes suggests the correct rotation
axis but the wrong direction (e.g. 90 instead of 270), resulting in
upside-down images after rotation.

### Two-pass VLM consistency check

When enabled, a second VLM analysis runs on the rotated image to
confirm or correct the first pass. Residual rotation angles are
combined. This improves accuracy but doubles analysis time for rotated
photos and still relies on VLM judgment.

### Face-landmark verification (implemented)

Uses RetinaFace 5-point landmarks (eyes, nose, mouth) to verify
rotation direction. The spatial relationship between the eye-midpoint
and nose provides a deterministic orientation signal. When faces are
detected with high confidence, this overrides or corrects the VLM
suggestion. Shared logic lives in `@emk/shared-contracts`
(`face-detection/rotation-heuristics.ts`).

---

## Future improvements (not yet implemented)

### Method B: YOLO Pose Estimation

**What:** Use Ultralytics YOLO pose models (e.g. `yolo26n-pose`,
~6 MB) to detect 17 body keypoints (eyes, ears, shoulders, elbows,
wrists, hips, knees, ankles).

**How it helps rotation detection:** Anatomical constraints are strong
orientation signals — shoulders should be above hips, hips above knees.
If the vertical ordering is inverted, the image is upside-down. For
90/270 rotation, horizontal ordering changes predictably.

**Advantages over face landmarks:**
- Works for full-body photos where faces may be small or turned away
- 17 keypoints give a more robust signal than 5 face landmarks
- Handles partially visible people (e.g. only torso visible)

**Implementation path:**
1. Add a `/detect-pose` endpoint to the existing `retinaface-api`
   Python service (port 8010). The service already has the Python
   environment; adding `ultralytics` is straightforward.
2. Return keypoint coordinates + confidence per person.
3. Add shared heuristics in `@emk/shared-contracts` for pose-based
   orientation estimation (similar pattern to face landmarks).
4. Integrate as an additional voting signal in the rotation decision.

**Wider use cases:** Pose estimation data could power future features
like activity recognition, photo composition analysis, or accessibility
metadata.

### Method D: Pre-trained image orientation classifier (lightweight CNN)

**What:** A small CNN trained specifically for the 4-class
orientation problem (0°, 90°, 180°, 270°).

**How it helps:** Purpose-built for this exact task — no reliance on
face/body detection. Works on landscapes, architecture, documents,
and other photos without people.

**Advantages:**
- Content-agnostic (works on any image type)
- Very fast inference (~5-10 ms per image)
- Deterministic output

**Limitations:**
- Requires training data representative of the target photo collection
- May not generalise well to unusual content (old scanned photos,
  abstract images)
- Additional model to deploy and maintain

**Implementation path:**
1. Evaluate existing open-source orientation classifiers
2. Fine-tune on a representative sample if needed
3. Deploy as ONNX model in Node.js (via `onnxruntime-node`) or as an
   additional endpoint in the Python service
4. Add as a voting signal alongside VLM and face/pose methods
