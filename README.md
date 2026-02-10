# UOM-OPEN-Imagealign

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
