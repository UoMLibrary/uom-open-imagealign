# UOM-OPEN-Imagealign

## Overview

**UOM-OPEN-Imagealign** is a static, browser-based tool for assembling and preparing images for **annotation, comparison, and downstream reuse** (e.g. datasets, PDFs, research outputs).

A project represents a **working set of images**, their grouping and base-image relationships, and any associated annotation data — **not** a copy of the images themselves. This allows annotation work to begin immediately, even when images live on local file systems or are not yet hosted or IIIF-served.

The application runs entirely client-side (SvelteKit + GitHub Pages compatible), with no backend or server dependency.

---

## Image identity and project model

An _image alignment project_ captures **structure and intent**, not image storage.

Images may originate from:

- local folders (File System Access API or fallback upload)
- public URLs
- future IIIF manifests

To ensure long-term trust in annotations, the system explicitly separates:

- **image content identity** (what the image _is_)
- **project-local image instances** (how the image is _used here_)

### Content identity (cryptographic)

Each image’s raw bytes are hashed using **SHA-256** (`hashes.contentHash`) at ingest time, inside a Web Worker.

This hash:

- uniquely and cryptographically identifies the exact image data
- survives across machines, sessions, and projects
- is used to verify that annotations refer to the _correct image_

> If the bytes change, the hash changes — no ambiguity.

### Project-local instances

Each project maintains its own image instances with:

- a project-local UUID
- grouping order
- base-image selection
- alignment metadata
- UI state

This allows multiple projects to reference the same underlying image content **without coupling their workflows or decisions**.

---

## Ephemeral image availability & relinking

Local file access is intentionally treated as **ephemeral**.

- Blob URLs (`uri`) are **runtime-only**
- They are never trusted or relied upon across reloads
- When a project is reloaded, images start in an **unlinked** state

Re-importing images:

- recomputes SHA-256 hashes
- matches files back to project images by `contentHash`
- rehydrates blob URLs
- restores thumbnails and UI state safely

This keeps project files:

- portable
- honest
- reproducible
- safe to share

---

## Identity model summary

| Concept                 | Field                           | Scope             | Purpose                                                            |
| ----------------------- | ------------------------------- | ----------------- | ------------------------------------------------------------------ |
| Image content identity  | `hashes.contentHash` (SHA-256)  | Global, stable    | Cryptographically verifies the exact image an annotation refers to |
| Perceptual similarity   | `hashes.perceptualHash` (dHash) | Global, heuristic | Used for grouping/similarity hints — **not** identity              |
| Project image instance  | `id` (UUID)                     | Project-local     | Grouping, ordering, base image selection, UI state                 |
| Image availability      | `uri` (blob / URL)              | Ephemeral         | Runtime-only image access; never persisted as trusted              |
| Annotation verification | `annotations.imageContentHash`  | Global            | Confirms annotations match the intended image content              |

---

## Current implemented behaviour

✔ Image ingestion from folders
✔ Worker-based hashing (SHA-256 + dHash)
✔ Duplicate detection by content hash
✔ Project save/load (JSON)
✔ Image relinking via re-import
✔ Thumbnail grid with correct lifecycle handling
✔ Store-driven, mutation-safe architecture

**Important implementation detail:**
Thumbnail components are explicitly keyed by `image.uri` to ensure correct remounting when images transition from “unlinked” → “linked”.

---

## Folder structure rationale

| Folder        | Purpose                                        |
| ------------- | ---------------------------------------------- |
| `image/`      | All bitmap, hashing, and pixel-level work      |
| `stores/`     | Authoritative project state & mutation APIs    |
| `components/` | Pure UI — no project mutation logic            |
| `validation/` | AJV + schema validation                        |
| `migration/`  | Explicit, versioned project upgrades           |
| `types/`      | Generated, read-only TypeScript contracts      |
| `strategies/` | Grouping & alignment heuristics (non-UI logic) |

> **Rule:** Components never mutate project JSON directly — only store actions do.

---

## Project creation mental model

1. Images are ingested **ungrouped**
2. Hashing demonstrates identity before anything else
3. Images appear in the grid (linked or unlinked)
4. Groups and base images are created later
5. Alignment and annotation come downstream

---

## Hashing strategy

- **SHA-256**
  - authoritative identity
  - used for relinking, validation, and annotation trust

- **dHash (perceptual)**
  - fast, heuristic similarity
  - used to suggest grouping
  - never used as identity

Hashing runs in a **Web Worker** to keep the UI responsive, even for large images.

---

## Schema, validation, and migrations

- `schema.json` is the single source of truth
- Types are generated and treated as read-only
- AJV is used for runtime validation
- Version upgrades are explicit and boring (by design)

```sh
npm install ajv ajv-formats
npm install --save-dev json-schema-to-typescript
```

---

## What this tool is (and is not)

**This tool is:**

- a project preparation and structuring tool
- a trustable bridge between raw images and annotation systems
- safe for local-only and offline workflows

**This tool is not:**

- an image hosting service
- a permanent image store
- a full annotation editor (by design)

---

## Core principle

> **“This annotation was made against this exact image.”**

## Grouping model and workflow

Image grouping in this project is intentionally **human-confirmed and strategy-agnostic**.

Grouping strategies (for example, filename similarity or perceptual hash matching) are treated as **transient UI tools**. They propose candidate groupings but never modify the project state directly. This allows users to experiment with different strategies, thresholds, and heuristics without committing to any structural changes until they explicitly choose to do so.

Only the **confirmed output of grouping** is persisted in the project file.

### Key principles

- **Strategies are disposable**
  Grouping strategies are not stored, versioned, or recorded in the project. They exist solely to help the user discover meaningful relationships between images.

- **Groups are commitments**
  When a user confirms a group, it is recorded as an `imageGroup` containing:
  - a stable group ID
  - the IDs of the grouped images
  - a designated base image
  - a locked flag to prevent accidental modification

- **Human-in-the-loop by design**
  The tool never auto-groups images permanently. All grouping decisions require explicit user confirmation.

### Base image concept

Each group has a single **base image**, which acts as the anchor for:

- alignment transforms
- annotations (stored externally and opaquely)
- downstream comparison workflows

Other images in the group exist to support comparison, difference detection, and alignment relative to this base image.

### Locking behaviour

Groups can be marked as `locked` to indicate that their membership and base image selection should not change unless the user explicitly unlocks them. This protects established work as new images or strategies are introduced.

### Separation from alignment and annotation

- Grouping defines **which images belong together**
- Alignment defines **how images relate geometrically**
- Annotation data is treated as **opaque** and is not interpreted or validated by this tool

Annotations are anchored to base images using stable content hashes and may optionally reference which comparison image or alignment was used, but their internal structure is outside the scope of this project.

### Why this approach

This design keeps the project model:

- stable over time
- resilient to changing algorithms
- reproducible and auditable
- free from accidental automation bias

It allows grouping strategies to improve or change without breaking existing projects, while ensuring that only deliberate, user-approved structure is persisted.

### Design guarantees

- Grouping strategies **never create groups directly**; they only propose candidate groupings.
- Groups are only created when **explicitly confirmed by the user**.
- Each group has a single base image, which anchors alignment and annotation.
- **Annotations always belong to the base image**; other images may provide comparison context only.
- The tool asserts image identity and geometric relationships, not interpretive meaning.
- **Annotation data is treated as opaque** and is not interpreted, validated, or rendered by this tool.

## TODO

- Update in Image prepare needs to regenerate the normalised image
- Strategy return matches, they need to also return unmatched as groups of 1
- Lots of wasted screen real estate with group suggestions, use grid?
- Need visual component for Group > Sidebar > item
- If importing an image folder and it contains a project.json file, use it
- Need to be able to order within the group
- Align mode can infer base image as groupImage[0]
