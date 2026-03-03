## Image Alignment Project Refactor Specification (draft)

### 0) Purpose

A browser-based (app-hosted) workflow for ingesting a folder of images, grouping them, aligning each group member to a chosen base image, annotating comparisons, and exporting results (PDF/web component/etc.). IndexedDB is used as a deterministic cache for derived image artefacts.

---

## 1) User-facing workflow (modes)

### 1. Load Project (development mode retained)

- User can load an existing `project.json` file.
- User can save the current project state as `project.json` (download folder).
- User can still “Import Images” via file selection (kept for development convenience).

### 2. Ingest Images

Goal: ensure all selected images exist in IndexedDB in a deduplicated, versioned way.

**Requirements**

- The user selects a folder (or a set of files) via a click-driven file picker (required by the app wrapper).

- Each ingested file becomes a **Project Image** record with:
  - a **unique image ID** (unique per file instance / folder structure entry, even if duplicates exist),
  - a **content hash** (used for cache dedupe),
  - optional metadata such as label/structural path.

- Storage rule:
  - Binary image data is cached in IndexedDB keyed by **content hash**, so duplicates are stored once.
  - Project JSON stores _references_ (IDs, hashes, metadata), not the binary image data.

**Derived artefacts created during ingest**
For each unique content hash (only once per hash):

- **work image**: square canvas output containing the full source image fit within the square (letterboxed), max dimension e.g. `2048`.
- **thumbnail image**: same square-fit rule, fixed dimension e.g. `256`.

**Cache key versioning**

- Cache keys must include:
  - content hash
  - artefact type (`work`, `thumb`, etc.)
  - artefact dimension (e.g. `work_2048`, `thumb_256`)
  - an explicit version token (so the cache can be rebuilt if algorithms change)

Clearing IndexedDB must affect performance only, not correctness.

---

## 3) Group Mode

Goal: allow the user to organise images into comparison sets.

**Requirements**

- A **Group** contains:
  - unique group ID
  - a list of image IDs (members)
  - a designated **base image ID**

- UI actions:
  - add image to group
  - remove image from group
  - set / change base image

- The base image is the reference for alignment + annotation in later modes.

---

## 4) Align Mode

Goal: produce an alignment for each “compared image” against the group’s base image.

**Requirements**

- Alignment is always “image in group” → “base image”.
- Multiple alignment methods are supported:
  - currently: `Manual`, `Auto`
  - future: additional methods without schema churn

**Alignment record must store**

- which image pair it applies to:
  - base image ID (or base content hash)
  - compared image ID (or compared content hash)

- the **alignment method type** (e.g. `manual`, `auto`)
- the **transform output** (e.g. affine/homography matrix) needed to generate aligned imagery at runtime
- the **method payload** needed to reproduce the alignment later using the stored `work` images:
  - For Manual: point pairs (and any relevant settings)
  - For Auto: whatever parameters/results are needed to re-run / explain (e.g. feature settings, matches, confidence inputs, etc.)

Alignment should be reproducible from cached `work` artefacts, without requiring original files.

---

## 5) Annotation Mode

Goal: annotate differences between the base image and a selected aligned group member.

**Runtime behaviour**

- Load base `work` image.
- When the user selects another image in the same group:
  - load that image’s `work`
  - apply the stored alignment transform to generate an **aligned view** suitable for overlay/fade/compare in the annotation workspace

**Storage requirements**

- Annotations are stored **per base image + compared image** (or per base + compared + alignment version if needed).
- The annotation payload is intentionally flexible:
  - store an opaque `data` object (to support different organisation-specific annotation formats)

- The record must include enough identifiers to reattach annotations when the user revisits:
  - base image ID (or hash)
  - compared image ID (or hash)
  - optional alignment ID / method signature if multiple alignments are possible

---

## 6) Output Mode

Goal: export “finished results” from the project state + cached artefacts.

**Requirements**

- User chooses an output format (e.g. PDF, web component package, etc.).
- Output generation can:
  - use cached `work` / derived images
  - use alignment transforms to render aligned views
  - include annotations (format-dependent)

---

## 7) Data and responsibility split (important constraints)

- **Project JSON** is the durable, portable state:
  - images (IDs, hashes, metadata)
  - groups (membership, base selection)
  - alignments (transform + reproducibility payload)
  - annotations (flexible payload keyed to image IDs)
  - UI state as optional convenience

- **IndexedDB** is a deterministic cache:
  - stores derived blobs keyed by hash + artefact type + dimension + version
  - can be wiped and rebuilt from source files (via re-ingest) without breaking the project structure
