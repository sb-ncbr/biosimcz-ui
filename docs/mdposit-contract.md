# MDposit public API: observed contract (spike L0)

Observed 2026-10-05 against `https://mdposit.mddbr.eu/api/rest/v1`. About 40 anonymous read-only GET requests, no credentials.
The spec (`openapi/`) is incomplete for `/projects`; this file records what the live server really does. Fixtures and the
adapter (`src/server/repositories/record/mdposit/`) follow this file, not the spec.

## GET /projects

Envelope: `{ filteredCount: number, totalMdsCount: number | null, projects: ProjectMD[] }`. There is no `totalCount`.
The repository total comes from `GET /projects/summary` -> `projectsCount` (15190 at the time; cached 10 min).

| Param | Finding |
|---|---|
| `limit` | Honoured. `limit=500` returned 100 items (server clamp 100). `limit=0` returned all matches' count but is not used. We send 1..100. |
| `page` | Honoured, 1-based (`limit=3&page=2` returned items 4..6). |
| `sort` | HONOURED. JSON object: `{"_id":1}`, `{"_id":-1}`, `{"metadata.NAME":1}`, `{"metadata.NAME":-1}` all change the order. Default (no sort) is ascending accession (`MD-A00001`, ...), i.e. oldest first. |
| `search` | Honoured, plain text over name, description, authors, groups. Word matching, not substring: `lysozyme` and the phrase `carbonic anhydrase` returned 0 while `SARS`, `MoDEL`, `Orozco` matched. |
| `query` | Honoured, stringified MongoDB filter. `$in`, `$regex` + `$options:"i"`, `$gte`, `$and` all work. Invalid JSON gives 400 `Wrong query syntax: ...`. `$where` gives 400 (`$where is not allowed in this context`). |
| `search` + `query` | COMBINE as an intersection (`search=SARS` 1406, `query=GROMACS` 481, both 69). Mode `combined` is correct, no `$or` folding needed. |

Field names confirmed by queries: `metadata.PROGRAM` (string), `metadata.FF` (array of strings), `metadata.WAT` (string),
`metadata.ENSEMBLE`, `metadata.METHOD`, `metadata.TYPE`, `metadata.COLLECTIONS` (array), `metadata.TEMP` (number),
`metadata.TIMESTEP` (number), `metadata.AUTHORS` (array), `metadata.GROUPS` (array).
Atom count: the field is `metadata.SYSTATS` (spec says `SYSATS`; a `$gte` on `SYSATS` matched 0, on `SYSTATS` matched). `metadata.atomCount` also exists.

List item (same shape as the detail): `accession`, `published`, `metadata`, `chains`, `mdref`, `mds` (array of replica NAMES,
strings), `files` (array of file NAME strings, not objects), `mdcount`, `analyses`, `updateDate` and `creationDate` (ISO
strings, present on the real data), `totalSize` (bytes), `totalTime`, `totalFrames`, `identifier`, `mdNumber`, ...
Metadata of interest: `NAME`, `DESCRIPTION`, `AUTHORS[]`, `GROUPS[]`, `PROGRAM`, `VERSION` (string, may be number), `TYPE`,
`METHOD`, `LICENSE` (a sentence), `LINKCENSE` (license URL), `CITATION` (text), `THANKS` (string or null), `LENGTH` (ns),
`TIMESTEP`, `FF[]`, `TEMP`, `WAT`, `ENSEMBLE`, `SYSTATS`, `PDBIDS[]`, `REFERENCES[]` (UniProt ids), `COLLECTIONS[]`, `LINKS[]`
(`{ name, url }`), `CONTACT`. Large fields (`SEQUENCES`, `ATNAME`, ...) are ignored.
Many fields are `null` on some projects, so every mapper read is tolerant.

## GET /projects/options

`projection` is REQUIRED (no projection -> 400 `"Missing projection"`). ONE field per call: a space separated list or a JSON
projection are not understood (they return `{ "<raw projection>": {} }`). `query` (same filter grammar) narrows the counts.
Response: `{ "metadata.PROGRAM": { "GROMACS": 481, "Amber": 7397, "null": 517, ... } }`: field name -> value -> count. The key
`"null"` means "no value" and is dropped by the mapper. Numbers come back as string keys (`"300": 3106`).
No `search` param, so counts are unavailable while a text query is active.

Distinct values (counts at the time): PROGRAM 9, FF 29, WAT 5 (TIP3P, SPCE, OPC, Martini 2.2), ENSEMBLE 2 (NPT, NVT),
METHOD 9 ("Classical MD" 15141), TYPE 2 (trajectory, ensemble), COLLECTIONS 10, TEMP 9, TIMESTEP 3 (2, 4, 20), LICENSE 7
(long sentences; not a usable facet in v1).

## GET /projects/summary

`{ projectsCount, mdCount, totalTime, totalFrames, totalFiles, totalAnalyses, storageStats }`.

## GET /projects/{accession}

Same object as a list item. Unknown id -> 404 with a JSON string body (`"Project MD-ZZZZZZ was not found"`). A replica id
`MD-A00001.1` resolves (200) to the project.
`GET /projects/{accession}/files` returns an array of file names (strings), no sizes.

## Latency

200 ms typical, about 1 s for 100 items. Timeouts used: list 8 s, options 5 s, detail 10 s.

## GET /projects/{accession}/structure (Mol* viewer)

Observed 2026-10-05, 3 anonymous GETs. `GET /projects/MD-A00001/structure` answers `302` with `Location:
https://irb-dev.mddbr.eu/api/rest/v1/projects/A0001/structure` (same pattern as the screenshot). The target answers `200`,
`content-type: chemical/x-pdb`, `content-length` present (316824 bytes for A0001), body is PDB text (`REMARK MDDB API produced PDB file`, `ATOM ...`).
`openStructure` follows exactly one hop, https and `*.mddbr.eu` only. BFF `GET /bff/records/[id]/structure` is public, relays the body
as a stream, accepts content types `chemical/x-pdb`, `chemical/x-cif`, `text/plain`, `application/octet-stream`, caps the body at 50 MB
(declared length -> 413, undeclared -> the stream errors), `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`, 404 on upstream 404.

Trajectory: `GET /projects/{accession}.{N}/trajectory?format=xtc&frames=0:5:1` answered 500 (`Internal Server Error`) for MD-A00001.1; the
full XTC has no known size bound, so no trajectory BFF route exists yet. `trajectoryUrlFor` is exported but the viewer ignores it.

## GET /projects/{accession}/files/screenshot.jpg (structure preview)

Observed 2026-10-05, 3 anonymous GETs. `MD-A00001` answers `302` with a `Location` on a sibling host
(`https://irb-dev.mddbr.eu/api/rest/v1/projects/A0001/files/screenshot.jpg`); that host answers `200`, a JPEG of about 24 KB, with
`content-type: application/octet-stream` (not `image/*`). Unknown accession -> 404 JSON. The old UI used the same URL as a plain `<img src>`.
`getScreenshot` follows one redirect (https, `*.mddbr.eu` only); `/bff/records/[id]/thumbnail` decides the type from the magic bytes
(jpeg, png, gif, webp; never svg) and caps the body at 2 MB.
