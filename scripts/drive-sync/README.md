# Drive media sync (idempotent)

This script imports **new** files from the Google Drive folders already used by D31.UNIVERSE and skips true duplicates. It does **not** talk to Google itself. A recurring agent (or a person) lists and downloads files with the Drive connector, then runs this importer.

Watched folders are listed in `folders.json`:

| Folder | Id | Role |
|---|---|---|
| 1Plus 10R Video | `1hJrHl2D4fPUxAhCrUG3ZMrHCBgieTpf3` | Exercise clip sources |
| Background d31 | `1FQQD40JeblZuc6gWtavGmXRDEV3q__TT` | Shoot / gallery stills |
| D31 KNOWLEDGE | `1JpV8qaI29rtwQ-aINWhRQ7R6-fkMp5md` | Knowledge posts — use `scripts/sync-knowledge.mjs`, not this importer |

## Persistent state

Keep working state **outside** any `dist` / `build` / `.cache` folder, at:

```
/workspace/d31-drive-sync/
  catalog.json          # written by the recurring run (latest Drive listing)
  inbox/                # downloaded files named {driveFileId} or {driveFileId}.ext
  previews/             # 12-frame video contact sheets for human / agent review
  state/
    manifest.json       # every seen Drive file id + decision + hashes
    hashes.json         # sha256 and perceptual hashes (never re-add a duplicate)
    pending-review.json # new videos (and unapplied photos) waiting for a review
    last-run.json       # summary of the most recent import
```

A copy of `manifest.json` also lives in this directory in the repo so the imported-id set is versioned.

## Catalog format

`catalog.json` is a JSON array (or `{ "files": [ ... ] }`). Each file:

```json
{
  "id": "1abc…",
  "name": "VID_20261128_120000.mp4",
  "mimeType": "video/mp4",
  "size": 12345678,
  "md5Checksum": "optional",
  "modifiedTime": "2026-11-28T06:00:00.000Z",
  "folderId": "1hJrHl2D4fPUxAhCrUG3ZMrHCBgieTpf3",
  "path": "optional/relative/path/inside/the/folder",
  "parents": ["optional"]
}
```

List **every file in every subfolder** of the watched folders. The importer skips folders, already-seen ids (same hash), AI / Veo / SynthID-style filenames, screenshots, educational slideshows, and exact / near-duplicate photos (perceptual hash).

## Recurring run (exact command)

From the repo root, after the Drive listing and any new downloads are on disk:

```bash
node scripts/drive-sync/import.mjs \
  --catalog /workspace/d31-drive-sync/catalog.json \
  --inbox   /workspace/d31-drive-sync/inbox \
  --state   /workspace/d31-drive-sync/state \
  --repo    . \
  --apply-photos
```

Dry run (no writes):

```bash
node scripts/drive-sync/import.mjs \
  --catalog /workspace/d31-drive-sync/catalog.json \
  --inbox   /workspace/d31-drive-sync/inbox \
  --state   /workspace/d31-drive-sync/state \
  --repo    . \
  --dry-run
```

Inputs the recurring run must provide:

1. A recursive listing of the three watched folders (all subfolders) written to `/workspace/d31-drive-sync/catalog.json`.
2. Downloads of files whose ids are **not** already in `/workspace/d31-drive-sync/state/manifest.json` (or whose md5 / size changed) into `/workspace/d31-drive-sync/inbox/{fileId}` (or `{fileId}.{ext}`).
3. The command above, run at the repo root (this app). No Google API key, service account, or GitHub secret is required — the Drive connector already used by the agent is the only auth.
4. After the script exits, commit any applied photo / `gallery.ts` / `manifest.json` changes on `features-beta` (or follow the current release branch rules). Videos are **never auto-added** as exercise clips.

## What is automatic vs reviewed

- **Photos** with `--apply-photos`: professional-resolution stills (≥ 800 px on the long edge), no AI / screenshot filename, not a near-duplicate of an existing Shoot image, are written to `public/media/shoot/{id}.webp` (max 1200 px) and `{id}-sm.webp` (max 520 px) and appended to `src/data/gallery.ts`. Titles stay honest (`Studio shoot`) unless a reviewer names the pose later — the script will not guess an exercise.
- **Videos**: a preview grid is written to `/workspace/d31-drive-sync/previews/{fileId}.jpg` and the file is queued in `state/pending-review.json`. A person or agent must confirm it is Darshan, a clean take, not AI / watermarked, and either attach it to an existing exercise or add a new exercise only with a confident identification. Then encode mp4 + webm + poster (480×854, 24 fps) and a small looping GIF (about 320 px, palette-optimized, under ~1.5 MB) like the existing clips.

## Skip rules (always)

- True duplicates (same Drive id already imported, or same SHA-256).
- Near-duplicate photos (perceptual / average hash Hamming distance ≤ 8). Among duplicates, the gallery already keeps the best-resolution original; a larger replacement needs a deliberate review.
- Filenames or metadata suggesting AI / Gemini / Veo / SynthID / “Google verification”, plus `file_000000…` AI-export names.
- Screenshots, educational slideshows / “hack” / “masterclass” title cards.
- The “Hide. One+10R” folder and any folder not listed in `folders.json`.
- Knowledge posts (handled by `scripts/sync-knowledge.mjs`).

## Dependencies

Node 18+, `python3` with Pillow, and `ffmpeg` (for video preview grids). No extra npm packages.
