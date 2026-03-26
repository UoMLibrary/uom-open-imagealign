import { browser } from '$app/environment';

export type PythonProfileKind = 'importGrouping' | 'exportShape';

export type PythonProfile = {
    id: string;
    kind: PythonProfileKind;
    name: string;
    description: string;
    script: string;
    sampleInput: unknown;
    sampleOutput?: unknown;
    updatedAt: string;
};

export type AnnotationSchemaProfile = {
    id: string;
    name: string;
    description: string;
    schema: Record<string, unknown>;
    defaultData: Record<string, unknown>;
    updatedAt: string;
};

type SettingsSnapshot = {
    importGroupingProfiles: PythonProfile[];
    exportProfiles: PythonProfile[];
    annotationSchemaProfiles: AnnotationSchemaProfile[];
};

const STORAGE_KEY = 'uom-imagealign:settings:v1';

function nowIso(): string {
    return new Date().toISOString();
}

function uid(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

const DEFAULT_GROUPING_SCRIPT = `from collections import defaultdict
from pathlib import PurePosixPath

def process(data):
    files = data.get("files", [])
    grouped = defaultdict(list)

    for item in files:
        rel = item.get("relativePath", "")
        path = PurePosixPath(rel)
        key = path.parent.name or "Ungrouped"
        grouped[key].append(rel)

    result = []
    for label, image_refs in grouped.items():
        result.append({
            "label": label,
            "imageRefs": sorted(image_refs)
        })

    return sorted(result, key=lambda g: g["label"].lower())
`;

const DEFAULT_GROUPING_INPUT = {
    files: [
        {
            relativePath: 'MS_A/page-001/front.jpg',
            filename: 'front.jpg',
            stem: 'front',
            extension: '.jpg'
        },
        {
            relativePath: 'MS_A/page-001/back.jpg',
            filename: 'back.jpg',
            stem: 'back',
            extension: '.jpg'
        },
        {
            relativePath: 'MS_A/page-002/front.jpg',
            filename: 'front.jpg',
            stem: 'front',
            extension: '.jpg'
        }
    ]
};

const DEFAULT_EXPORT_SCRIPT = `def process(data):
    rows = []

    for annotation in data.get("annotations", []):
        geometry = annotation.get("geometry", {})
        row = {
            "annotation_id": annotation.get("id"),
            "group_id": annotation.get("groupId"),
            "geometry_type": geometry.get("type"),
            "label": annotation.get("data", {}).get("label", ""),
            "category": annotation.get("data", {}).get("category", ""),
            "notes": annotation.get("data", {}).get("notes", "")
        }
        rows.append(row)

    return {
        "files": [
            {
                "filename": "annotations.json",
                "contentType": "application/json",
                "text": rows
            }
        ]
    }
`;

const DEFAULT_EXPORT_INPUT = {
    project: {
        id: 'project-1',
        title: 'Demo Project'
    },
    annotations: [
        {
            id: 'ann-1',
            groupId: 'group-1',
            geometry: {
                type: 'rect',
                value: { x: 0.1, y: 0.2, w: 0.3, h: 0.15 }
            },
            data: {
                label: 'Marginal note',
                category: 'marginalia',
                notes: 'Brown ink in outer margin'
            }
        }
    ]
};

const DEFAULT_ANNOTATION_SCHEMA = {
    title: 'Annotation',
    type: 'object',
    required: ['label'],
    properties: {
        label: {
            type: 'string',
            title: 'Label'
        },
        category: {
            type: 'string',
            title: 'Category',
            enum: ['damage', 'marginalia', 'print', 'hand', 'other']
        },
        notes: {
            type: 'string',
            title: 'Notes'
        },
        needsReview: {
            type: 'boolean',
            title: 'Needs review'
        }
    }
};

const DEFAULT_ANNOTATION_DATA = {
    label: '',
    category: 'other',
    notes: '',
    needsReview: false
};

function buildDefaultSnapshot(): SettingsSnapshot {
    return {
        importGroupingProfiles: [
            {
                id: uid('grouping'),
                kind: 'importGrouping',
                name: 'Leaf folder',
                description: 'Groups files by the last folder in the relative path.',
                script: DEFAULT_GROUPING_SCRIPT,
                sampleInput: DEFAULT_GROUPING_INPUT,
                updatedAt: nowIso()
            }
        ],
        exportProfiles: [
            {
                id: uid('export'),
                kind: 'exportShape',
                name: 'Annotation JSON',
                description: 'Turns annotations into a simple JSON export payload.',
                script: DEFAULT_EXPORT_SCRIPT,
                sampleInput: DEFAULT_EXPORT_INPUT,
                updatedAt: nowIso()
            }
        ],
        annotationSchemaProfiles: [
            {
                id: uid('schema'),
                name: 'Basic annotation',
                description: 'A simple label, category, notes, and review flag.',
                schema: DEFAULT_ANNOTATION_SCHEMA,
                defaultData: DEFAULT_ANNOTATION_DATA,
                updatedAt: nowIso()
            }
        ]
    };
}

function createSettingsState() {
    const state = $state<SettingsSnapshot>(buildDefaultSnapshot());

    function persist() {
        if (!browser) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clone(state)));
    }

    function hydrate(snapshot: Partial<SettingsSnapshot> | null | undefined) {
        const defaults = buildDefaultSnapshot();

        state.importGroupingProfiles = clone(snapshot?.importGroupingProfiles?.length
            ? snapshot.importGroupingProfiles
            : defaults.importGroupingProfiles);

        state.exportProfiles = clone(snapshot?.exportProfiles?.length
            ? snapshot.exportProfiles
            : defaults.exportProfiles);

        state.annotationSchemaProfiles = clone(snapshot?.annotationSchemaProfiles?.length
            ? snapshot.annotationSchemaProfiles
            : defaults.annotationSchemaProfiles);
    }

    function load() {
        if (!browser) return;

        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                persist();
                return;
            }

            const parsed = JSON.parse(raw) as Partial<SettingsSnapshot>;
            hydrate(parsed);
        } catch (error) {
            console.warn('Failed to load settings store, using defaults.', error);
            persist();
        }
    }

    function resetAll() {
        hydrate(buildDefaultSnapshot());
        persist();
    }

    function createPythonProfile(kind: PythonProfileKind): PythonProfile {
        return {
            id: uid(kind === 'importGrouping' ? 'grouping' : 'export'),
            kind,
            name: kind === 'importGrouping' ? 'New grouping profile' : 'New export profile',
            description: '',
            script: kind === 'importGrouping' ? DEFAULT_GROUPING_SCRIPT : DEFAULT_EXPORT_SCRIPT,
            sampleInput: kind === 'importGrouping' ? DEFAULT_GROUPING_INPUT : DEFAULT_EXPORT_INPUT,
            updatedAt: nowIso()
        };
    }

    function createImportGroupingProfile() {
        const profile = createPythonProfile('importGrouping');
        state.importGroupingProfiles = [profile, ...state.importGroupingProfiles];
        persist();
        return profile.id;
    }

    function updateImportGroupingProfile(id: string, patch: Partial<PythonProfile>) {
        state.importGroupingProfiles = state.importGroupingProfiles.map((profile) =>
            profile.id === id ? { ...profile, ...clone(patch), updatedAt: nowIso() } : profile
        );
        persist();
    }

    function deleteImportGroupingProfile(id: string) {
        state.importGroupingProfiles = state.importGroupingProfiles.filter((profile) => profile.id !== id);
        persist();
    }

    function duplicateImportGroupingProfile(id: string) {
        const existing = state.importGroupingProfiles.find((profile) => profile.id === id);
        if (!existing) return null;

        const copy: PythonProfile = {
            ...clone(existing),
            id: uid('grouping'),
            name: `${existing.name} copy`,
            updatedAt: nowIso()
        };

        state.importGroupingProfiles = [copy, ...state.importGroupingProfiles];
        persist();
        return copy.id;
    }

    function createExportProfile() {
        const profile = createPythonProfile('exportShape');
        state.exportProfiles = [profile, ...state.exportProfiles];
        persist();
        return profile.id;
    }

    function updateExportProfile(id: string, patch: Partial<PythonProfile>) {
        state.exportProfiles = state.exportProfiles.map((profile) =>
            profile.id === id ? { ...profile, ...clone(patch), updatedAt: nowIso() } : profile
        );
        persist();
    }

    function deleteExportProfile(id: string) {
        state.exportProfiles = state.exportProfiles.filter((profile) => profile.id !== id);
        persist();
    }

    function duplicateExportProfile(id: string) {
        const existing = state.exportProfiles.find((profile) => profile.id === id);
        if (!existing) return null;

        const copy: PythonProfile = {
            ...clone(existing),
            id: uid('export'),
            name: `${existing.name} copy`,
            updatedAt: nowIso()
        };

        state.exportProfiles = [copy, ...state.exportProfiles];
        persist();
        return copy.id;
    }

    function createAnnotationSchemaProfile() {
        const profile: AnnotationSchemaProfile = {
            id: uid('schema'),
            name: 'New annotation schema',
            description: '',
            schema: clone(DEFAULT_ANNOTATION_SCHEMA),
            defaultData: clone(DEFAULT_ANNOTATION_DATA),
            updatedAt: nowIso()
        };

        state.annotationSchemaProfiles = [profile, ...state.annotationSchemaProfiles];
        persist();
        return profile.id;
    }

    function updateAnnotationSchemaProfile(id: string, patch: Partial<AnnotationSchemaProfile>) {
        state.annotationSchemaProfiles = state.annotationSchemaProfiles.map((profile) =>
            profile.id === id ? { ...profile, ...clone(patch), updatedAt: nowIso() } : profile
        );
        persist();
    }

    function deleteAnnotationSchemaProfile(id: string) {
        state.annotationSchemaProfiles = state.annotationSchemaProfiles.filter((profile) => profile.id !== id);
        persist();
    }

    function duplicateAnnotationSchemaProfile(id: string) {
        const existing = state.annotationSchemaProfiles.find((profile) => profile.id === id);
        if (!existing) return null;

        const copy: AnnotationSchemaProfile = {
            ...clone(existing),
            id: uid('schema'),
            name: `${existing.name} copy`,
            updatedAt: nowIso()
        };

        state.annotationSchemaProfiles = [copy, ...state.annotationSchemaProfiles];
        persist();
        return copy.id;
    }

    load();

    return {
        get importGroupingProfiles() {
            return state.importGroupingProfiles;
        },
        get exportProfiles() {
            return state.exportProfiles;
        },
        get annotationSchemaProfiles() {
            return state.annotationSchemaProfiles;
        },
        resetAll,

        createImportGroupingProfile,
        updateImportGroupingProfile,
        deleteImportGroupingProfile,
        duplicateImportGroupingProfile,

        createExportProfile,
        updateExportProfile,
        deleteExportProfile,
        duplicateExportProfile,

        createAnnotationSchemaProfile,
        updateAnnotationSchemaProfile,
        deleteAnnotationSchemaProfile,
        duplicateAnnotationSchemaProfile
    };
}

export const settingsState = createSettingsState();