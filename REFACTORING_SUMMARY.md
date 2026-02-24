# Architectural Refactor Summary

**Date**: February 24, 2026
**Status**: Core structure complete, gradual migration in progress

## 🎯 New Architecture

The project has been refactored from a semi-organized domain-based structure into a clean, layered architecture:

```
src/
├── core/                          # Pure state container
│   ├── projectStore.ts           # Svelte stores + pure mutations
│   ├── types.ts                  # Auto-generated from schema
│   ├── runtimeTypes.ts          # Runtime-only types
│   └── schema.json              # JSON schema definition
│
├── image/                         # Image processing (pure)
│   ├── derivation.ts            # Image caching & preprocessing
│   ├── hashing.ts               # SHA-256 + dHash hashing
│   ├── groupingStrategies.ts     # All grouping algorithms
│   ├── hasher.worker.ts         # Worker for hashing
│   ├── dhash.ts                 # Perceptual hash algorithm
│   ├── phashSimilarity.ts       # Similarity comparison
│   ├── profileSimilarity.ts     # Vector similarity
│   └── visualProfile.ts         # Color histogram extraction
│
├── services/                      # Orchestration layer
│   ├── loadService.ts           # Load + rehydrate projects
│   ├── prepareService.ts        # Geometry confirmation workflow
│   ├── groupService.ts          # Group management + strategies
│   └── alignService.ts          # Alignment workflow
│
├── workspace/                    # UI mode components (moved)
│   ├── PrepareMode/
│   ├── GroupMode/
│   ├── AlignMode/
│   └── AnnotateMode/
│
├── ui/                          # UI components (moved)
│   ├── app/
│   ├── shared/
│   └── features/
│
└── lib/                         # TEMPORARY: Import bridges
    ├── domain/
    │   ├── projectStore.ts      # Re-exports from core/
    │   └── imageOperations.ts   # Re-exports from image/
    └── services.ts             # Re-exports from services/
```

## 🔄 Migration Path

### Phase 1: Core Architecture (COMPLETE)
- ✅ Created `src/core/` with clean projectStore
- ✅ Created `src/image/` with derivation, hashing, strategies
- ✅ Created `src/services/` with load, prepare, group, align
- ✅ Created import bridges in `src/lib/` for backward compatibility

### Phase 2: Import Updates (IN PROGRESS)
- ⏳ Update component imports to use new paths
- ⏳ Remove old `src/lib/domain/` directory
- ⏳ Remove old `src/lib/strategies/` directory

### Phase 3: Clean Up (NOT STARTED)
- ⏳ Delete old domain files
- ⏳ Delete unused components
- ⏳ Delete bridging files in `src/lib/`

## 📐 Architectural Principles

### 1. Core Layer (`src/core/projectStore.ts`)
**Pure state container - ONLY:**
- Writable stores for images, groups, alignments, annotations
- Derived stores for computed values (imagesById, ungroupedImageIds, etc.)
- Pure state mutation functions
- NO lifecycle logic
- NO IndexedDB access
- NO derivation functions
- NO workflow management

**Functions:**
- `addImage()`, `updateImage()`, `findImageByContentHash()`
- `addGroups()`, `updateGroup()`, `removeFromAllGroups()`
- `addAlignment()`, `removeAlignmentsForImage()`
- `updateProjectUI()`

### 2. Image Layer (`src/image/`)
**Pure computation - ONLY:**
- No store access
- No service calls
- No workflow management
- Deterministic cache layer (IndexedDB)

**Files:**
- `derivation.ts` - Working, prepared, canonical, thumbnail generation
- `hashing.ts` - File hashing (SHA-256 + perceptual)
- `groupingStrategies.ts` - All grouping algorithms
- `visualProfile.ts`, `phashSimilarity.ts` - Similarity metrics

### 3. Services Layer (`src/services/`)
**Orchestration - coordinates core + image + workflows:**

**loadService.ts** - Project load workflow
```typescript
await loadProjectFromFile(file);
// Orchestrates:
// 1. Parse + validate
// 2. Populate projectStore
// 3. Ensure working + thumbnail
// 4. Rehydrate runtimeUri
```

**prepareService.ts** - Geometry workflow
```typescript
await confirmPreparation(imageIds, preparation);
// Orchestrates:
// 1. Update metadata
// 2. Invalidate old artefacts
// 3. Regenerate prepared + canonical
// 4. Compute pHash
// 5. Invalidate downstream (groups, alignments)
```

**groupService.ts** - Group management
```typescript
applyGroupingProposal(proposal);
await runPHashGrouping(threshold);
runFilenameGrouping();
```

**alignService.ts** - Alignment workflow
```typescript
await ensurePreparedImage(imageId, preparation);
recordAlignment(alignment);
```

## 🔧 How to Update Component Imports

### Old Pattern (still works via bridges):
```typescript
import { loadProject } from '$lib/domain/project/projectStore';
import { ensureThumbnail } from '$lib/domain/image/ImageDerivationStore';
import { groupByFilename } from '$lib/strategies/grouping/byFilename';
```

### New Pattern (preferred):
```typescript
import { images, groups, addGroups } from '../../core/projectStore';
import { ensureThumbnail } from '../../image/derivation';
import { groupByFilename } from '../../image/groupingStrategies';
import { confirmPreparation } from '../../services/prepareService';
import { loadProjectFromFile } from '../../services/loadService';
```

## 📋 Example: Refactored Workspace Component

### Before
```svelte
<script lang="ts">
  import { images, groups, project } from '$lib/domain/project/projectStore';
  import { applyGroupingProposal } from '$lib/domain/project/groupActions';
  import { initialiseSingleImageProposals } from '$lib/domain/grouping/groupingStore';

  onMount(() => {
    if (get(images).length > 0) {
      initialiseSingleImageProposals();
    }
  });

  function confirmProposal(proposal) {
    applyGroupingProposal(proposal);
    // ... manual invalidation
  }
</script>
```

### After
```svelte
<script lang="ts">
  import { images, groups, project } from '../../core/projectStore';
  import { applyGroupingProposal } from '../../services/groupService';
  import { runFilenameGrouping } from '../../services/groupService';

  function runGrouping() {
    const proposals = runFilenameGrouping();
    // Service handles invalidation internally
  }

  function confirmProposal(proposal) {
    applyGroupingProposal(proposal);
    // Service handles cascading invalidation
  }
</script>
```

## 🧹 Files to Delete (When Migration Complete)

**Old Domain Structure:**
- `src/lib/domain/project/projectStore.ts` (now `src/core/`)
- `src/lib/domain/project/workflow.ts` (merged → prepareService)
- `src/lib/domain/project/invalidation.ts` (merged → prepareService)
- `src/lib/domain/project/groupActions.ts` (merged → groupService)
- `src/lib/domain/grouping/groupingStore.ts` (merged → groupService)
- `src/lib/domain/image/ImageDerivationStore.ts` (merged → image/derivation)
- `src/lib/domain/image/Rehydration.ts` (merged → image/derivation)
- `src/lib/strategies/grouping/*.ts` (merged → image/groupingStrategies)

**Unused Components (already identified):**
- `src/lib/workspace/viewer/TransformOverlay.svelte`
- `src/lib/workspace/viewer/BaseImageViewer.svelte`
- `src/lib/workspace/shared/WorkspaceLayout.svelte`
- `src/lib/workspace/modes/AlignMode/AlignmentControls.svelte`
- `src/lib/workspace/modes/AlignMode/AlignmentViewer.svelte`
- `src/lib/workspace/modes/AnnotateMode/AnnotationLayer.svelte`
- `src/lib/workspace/modes/AnnotateMode/AnnotationToolbar.svelte`
- `src/lib/domain/image/AutoTrim.ts` (unused)
- `src/lib/domain/image/ProcessQueue.js` (unused)

**Bridging Files (temporary):**
- `src/lib/domain/projectStore.ts`
- `src/lib/domain/imageOperations.ts`
- `src/lib/services.ts`

## ✨ Benefits of New Architecture

1. **Single Ownership**: Each feature (load, prepare, group, align) has clear ownership
2. **Lazy Generation**: Canonical and prepared images generated on-demand
3. **Clear Separation**: Image processing is pure, services orchestrate
4. **Reduced Coupling**: Components call services, not domain functions
5. **Testability**: Services easily tested with mock stores
6. **Maintainability**: New workflows are simple service additions

## 📝 Next Steps

1. Run `npm run dev` to check for errors
2. Systematically update component imports (use search-replace)
3. Test functionality  in each workspace mode
4. Once working, delete old files  and bridges
5. Run `npm run build` for final check
