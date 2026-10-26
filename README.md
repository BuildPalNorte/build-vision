# Viso Faces

A small Phase 1 demo: register a person's face and recognize registered faces in another photograph. It uses `@viso-lol/sdk@0.2.0` (Face collections and face-only `vision.analyze`).

- Next.js 16.4 (App Router, Node.js Route Handlers), React 19, strict TypeScript
- Tailwind CSS v4 and HeroUI v3, with an Apple-inspired light interface
- Bun for package management and scripts
- Interface copy is in Spanish; code, comments, and this README are in English

Design reference: [`design.md`](./design.md).

## What it does

| Route         | Purpose                                                      |
| ------------- | ------------------------------------------------------------ |
| `/`           | Introduction                                                 |
| `/people`     | Registered names (cursor-paginated) and delete with confirmation |
| `/people/new` | Register a face: name, one portrait, explicit consent        |
| `/recognize`  | Upload a photo and see boxes, names, and similarity scores   |

Photographs are temporary request data. The app stores no image bytes and needs no image bucket and no extra database. The indexed Viso face records are the persistent source of truth: each record keeps a server-generated UUID in `externalId`, the name in `metadata.name`, and the consent timestamp in `metadata.consentAt`.

Not in this phase: camera capture, object detection, prompts, authentication, stored portraits, history, or analytics.

## Configuration

Copy `.env.example` to `.env.local` and fill it in:

```dotenv
VISO_API_KEY=
VISO_COLLECTION_ID=
VISO_BASE_URL=https://api.viso.lol/v1
```

Requirements on the Viso side:

- **Face is enabled** for the project.
- The collection **already exists, is `active`, and belongs to the API key's project**. The app never creates collections and never accepts a collection ID from the client.
- The API key has the **`face:read`** and **`face:write`** scopes. Face-only `vision.analyze` does not need `vision:read`.
- No AWS, Gemini, or bucket credentials are needed by this app (any `VISO_BUCKET_ID` value in your environment is ignored).

Configuration is validated while handling each request, so the app builds and renders without credentials. When variables are missing, the API answers with a setup-required message instead of failing.

Secrets are only read in server modules (`import "server-only"`), are never exposed through `NEXT_PUBLIC_` variables, and are never logged. Only `.env.example` is tracked by Git.

### Vercel

1. Import the repository as a Vercel project (framework: Next.js; Bun is detected from `bun.lock`).
2. Under **Settings → Environment Variables**, add `VISO_API_KEY`, `VISO_COLLECTION_ID`, and optionally `VISO_BASE_URL` for the environments you use.
3. Deploy. The recognition and registration routes set `maxDuration = 60`; make sure your plan allows that function duration.

Browser uploads are normalized to a JPEG of at most 2 megapixels and 3 MiB so requests stay below Vercel's function payload limit.

## Development

```sh
bun install
bun run dev        # http://localhost:3000
```

| Script              | Command                                          |
| ------------------- | ------------------------------------------------ |
| `bun run dev`       | `next dev`                                       |
| `bun run build`     | `next build`                                     |
| `bun run start`     | `next start`                                     |
| `bun run format`    | `oxfmt` over source files                        |
| `bun run lint`      | `oxlint src`                                     |
| `bun run typecheck` | `tsc --noEmit`                                   |
| `bun run test`      | `vitest run`                                     |

## How it works

- **Enrollment** (`POST /api/people`): validates name (1–64 Unicode characters), literal consent `"true"`, and the image; calls `face.detect` and continues only if exactly one face is found; then `face.collections.faces.index` with `maxFaces: 1` and `qualityFilter: "auto"`. Success is reported only if exactly one face was indexed.
- **List / delete** (`GET /api/people`, `DELETE /api/people/[faceId]`): `faces.list` (page size 20, cursor) and `faces.delete`, always scoped to the configured collection.
- **Recognition** (`POST /api/recognize`): one `vision.analyze` call with `faces: { enabled: true, collectionId, threshold: 90, maxDetectedFaces: 10 }` and no `objects`. Matched, unknown, and failed faces stay distinct; partial responses keep successful faces and are never retried automatically. Boxes are drawn from the query faces (`analysis.faces[i].boundingBox`), never from the nested enrollment match. Similarity is shown as a score, not a calibrated probability.
- **Images** are validated again on the server with `sharp` (real format, dimensions, size, and a full decode) before any provider call.

## Tests and their limits

`bun run test` runs mocked unit tests for enrollment (zero/multiple faces, successful indexing), listing and deletion scoping, face-only recognition (matched/unknown/failed/partial/empty), image and request validation, input schemas, and overlay geometry. These mocks do **not** prove real recognition accuracy; they only verify how this app calls and interprets the SDK.

## Manual acceptance flow (live provider)

Use only photos of people who have given consent. Registration and recognition make real, metered Face calls.

1. Configure an existing Face-enabled project, an active collection, and a key with `face:read` and `face:write` (see above).
2. Open `/people/new` and register two authorized portraits (one face each, name, consent checked).
3. Reload `/people` and confirm both names persist.
4. Open `/recognize`, choose another photo that contains both people, and press `Reconocer rostros`. Check the boxes, names, and similarity scores; select rows and boxes to see the highlight.
5. Recognize a photo that includes a face that is not registered and confirm it shows `Sin coincidencia`.
6. Delete one registration from `/people`, confirm the dialog, and verify it disappears and is no longer recognized.
