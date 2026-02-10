# UOM-OPEN-Imagealign

## Image identity and project model

An _image alignment project_ is a **working set of images assembled for annotation**, comparison, and downstream reuse (e.g. generating annotation datasets or PDFs). Images may come from public URLs, local folders, or future IIIF sources, and the project file exists to capture _structure and annotation state_ rather than to store image data itself. This allows annotation work to begin immediately, without waiting for images to be hosted or transformed into a specific delivery format.

To ensure long-term trust in annotations, the system distinguishes between **image content identity** and **project-local image instances**. Each image’s _bytes_ are identified using a cryptographic SHA-256 hash (`contentHash`), which allows the tool to verify that an annotation was created against _exactly the same image data_, even across projects, machines, or time. At the same time, each project maintains its own image instances with local IDs, enabling independent grouping, base-image selection, and annotation workflows without accidental cross-project coupling.

When a project is loaded, image availability is treated as **ephemeral**: local file references and blob URLs are intentionally cleared, and images are considered _unlinked_ until the user re-imports the relevant folder or source. Re-importing images rehydrates the project by matching files via their `contentHash`, ensuring correctness while keeping the project file portable, honest, and reproducible.

---

## Identity model summary

| Concept                 | Field                           | Scope             | Purpose                                                                 |
| ----------------------- | ------------------------------- | ----------------- | ----------------------------------------------------------------------- |
| Image content identity  | `hashes.contentHash` (SHA-256)  | Global, stable    | Cryptographically verifies the exact image data an annotation refers to |
| Perceptual similarity   | `hashes.perceptualHash` (dHash) | Global, heuristic | Used for grouping and similarity detection, **not** identity            |
| Project image instance  | `id` (UUID)                     | Project-local     | Manages grouping, ordering, base image selection, and UI state          |
| Image availability      | `uri` (blob / URL)              | Ephemeral         | Runtime-only reference to image data; never persisted as trusted        |
| Annotation verification | `annotations.imageContentHash`  | Global            | Confirms annotations match the intended image content                   |

This separation allows multiple projects to safely reference the same underlying image data while remaining independent, auditable, and resilient to changes in how or where images are stored.

## Why these folders

| Folder      | Reason                                    |
| ----------- | ----------------------------------------- |
| image/      | All pixel + bitmap work lives here        |
| validation/ | AJV + schema logic stays isolated         |
| migration/  | Version upgrades stay boring and explicit |
| types/      | Generated, read-only contract             |
| strategies/ | Keeps heuristics out of UI                |

This keeps components/ pure UI.

**NOTE: Components never mutate JSON directly — only stores.**

## Creating a project structure

### Mental model

- Images enter the system ungrouped
- Groups are created after ingestion
- Hashing happens before adding to the store

### Minimal flow

1. User selects a folder
2. You iterate files
3. For each image:
   - create ImageBitmap
   - hash it (worker)
   - add to images store
4. Groups are empty initially

## Creating the types from schema.json

```sh
npm install --save-dev json-schema-to-typescript
```

## Install ajv

ajv by itself does not include format validators like:

- date-time
- email
- uri

```sh
npm install ajv ajv-formats
```

## We are building:

- A project = a working set for annotation

- Images may be:
  - local files
  - temporary blobs
  - URLs
  - later IIIF
- Images must not be copied or hosted just to annotate them
- Multiple projects may reference the same underlying image
- You must be able to say with confidence:

> “This annotation was made against this exact image”
