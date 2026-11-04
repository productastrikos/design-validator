# Design Validator

An AI-driven design-validation workbench for shipbuilding design teams. It interprets
classification-society rules, IMO conventions (SOLAS, MARPOL, the LSA Code) and IEC 60092
electrical standards, and applies them to the documents a user uploads — compliance checks,
drawing data extraction, inspection-report classification, technical-offer scrutiny,
binding-data gap analysis, pre-bid queries, BOM and SOTR generation, cost estimation and design
review.

It is not tied to any organisation or project. Everything it analyses comes from the documents
you upload, and fictitious documents to try it with are in [sample-docs/](sample-docs/README.md).

---

## 1. How it works

### Inference engine
All generation and document understanding runs server-side through a single engine
(`server/lib/llm.js`) that calls an OpenAI-compatible endpoint. The browser never receives
credentials or raw model output beyond the finished answer. Vision-capable requests receive page
images so scanned pages, figures and drawings can be read.

Document text and queries are sent to that endpoint. The default is a cloud API; set
`LLM_BASE_URL` to a private endpoint if documents must stay inside your network.

### Knowledge base
On boot, the server parses the published rule books in `server/docs/` and indexes them into a
hybrid retrieval engine (BM25 keyword search, with optional local semantic embeddings via
`@xenova/transformers`, fused with RRF and diversified with MMR). These sources ground every AI
answer. Any PDF placed in that folder is indexed on the next start. Versioned rule books can also
be added without a restart through the admin-only `/api/rulebooks` API, which has no screen yet.

`server/docs/` is for published rules and conventions only. **Never put a project or client
document there:** its text is sent to every signed-in user's browser and can appear in any answer.

### Your documents (browser-held)
Documents are uploaded on the Document Intelligence page. On upload the server:
1. extracts the text, page by page where the format has pages,
2. sends any page with no usable text (scanned or image-only) to the **vision model**, and
3. **auto-detects the document type** from the file name and content (no manual selection).

The extracted content is stored in the browser and stays available to every tool for the rest of
the session. **Signing out clears all uploaded documents.** The analysis pages present a
**dropdown** to select one of those uploaded documents.

### Supported file types

| Kind | Formats |
| --- | --- |
| Documents | PDF (text or scanned), Word `.docx` and `.doc`, RTF, OpenDocument `.odt`, plain text, Markdown |
| Spreadsheets | Excel `.xlsx`, `.xlsm`, `.xls`, OpenDocument `.ods`, CSV, TSV |
| Presentations | PowerPoint `.pptx`, OpenDocument `.odp` |
| Images | PNG, JPEG, TIFF (including multi-page), BMP, WebP, GIF |
| Drawings | AutoCAD `.dwg` and `.dxf`, PDF, images |

Any other binary file is refused with a message listing these formats, rather than being analysed
as garbage. Password-protected and corrupted files get a clear error. At most
`EXTRACT_MAX_VISION_PAGES` scanned pages per document are read (default 10), and the extracted text
states how many further pages were skipped.

---

## 2. Project layout

```
design-validator/
├── server/
│   ├── index.js              # API routes, upload + auto-classification, RAG wiring
│   ├── rag/                  # Hybrid retrieval engine
│   ├── docs/                 # Built-in published rule books
│   ├── lib/
│   │   ├── llm.js            # Inference engine client (text + vision)
│   │   ├── extract.js        # Text extraction for every supported format
│   │   ├── classify.js       # Automatic document-type detection
│   │   ├── rasterize.js      # PDF / TIFF → page images (for the vision model)
│   │   ├── cad.js            # AutoCAD .dwg / .dxf reader
│   │   ├── ela.js            # Electrical Load Analysis workbook parser
│   │   └── excel.js          # Workbook generation
│   ├── features/             # Drawings, inspection, lessons, compliance, binding, prebid, BOM, cost, review
│   ├── auth/                 # JWT auth + user store
│   ├── data/                 # Runtime data, created on first use (gitignored)
│   └── .env                  # Server configuration (gitignored)
├── client/
│   └── src/
│       ├── pages/            # Dashboard, Chatbot, Documents, feature pages, Settings, Users
│       ├── components/       # Layout + shared feature UI kit
│       └── services/
│           ├── apiBase.js    # Backend origin, from VITE_API_URL
│           ├── aiService.js  # Fetch calls to the backend
│           ├── featureApi.js # Feature-route clients
│           └── docStore.js   # Browser document store (IndexedDB)
├── sample-docs/              # Fictitious documents for demos and testing
└── scripts/sample-docs/      # Generators for those documents
```

---

## 3. Running it

From the project root:

```
npm run install:all
npm run dev
```

This starts the API server (port 4309) and the client (port 3309) together. The client's dev
proxy forwards `/api` to the server, so no host or port appears in the source.

For deployment (frontend and backend served separately, on their own ports and subdomains) see
[DEPLOY.md](DEPLOY.md).

### Configuration

Server configuration lives in `server/.env` (server-side only, never sent to the browser). See
[server/.env.example](server/.env.example) for every setting:

```
LLM_API_KEY=...            # required
LLM_BASE_URL=...           # optional override
LLM_MODEL=...              # optional override
LLM_VISION_MODEL=...       # optional override
ADMIN_PASSWORD=...         # password for the admin account created on first boot
ENGINEER_PASSWORD=...      # password for the engineer account created on first boot
JWT_SECRET=...             # token signing secret
ORG_NAME=...               # organisation name printed on generated tenders and enquiries
PORT=4309
```

A free key works: create one at <https://console.groq.com> → **API Keys** → **Create API Key**,
and paste it as `LLM_API_KEY` in `server/.env`. The endpoint is OpenAI-compatible, so any other
OpenAI-compatible provider works too — set `LLM_BASE_URL` and `LLM_MODEL` to match.

The client's own environment lives in `client/.env` (development) and `client/.env.production` (the
deployed backend URL). Nothing secret goes in either — every `VITE_*` value is inlined into the
public bundle.

Use **Settings → Test Connection** to confirm the engine is online and the knowledge base has
loaded.

---

## 4. Roles

Two roles, authenticated with JWT (8-hour expiry):

- **Administrator** — all pages plus User Management and the Audit Log.
- **Design Engineer** — all analysis pages.

Default accounts `admin` and `engineer1` are created on first boot (`server/data/users.json`) with
the passwords in `ADMIN_PASSWORD` and `ENGINEER_PASSWORD`. If those are unset, the passwords fall
back to `admin123` and `engineer123`, which is only acceptable on a local machine. The login page
shows shortcuts to these accounts only when `VITE_SHOW_DEMO_ACCOUNTS=true`, set in development.

---

## 5. Security model

- Inference credentials stay on the server; there is no user-facing cloud configuration.
- Document text is sent to the configured inference endpoint for processing.
- Uploaded documents are otherwise held only in the browser and are wiped on logout, except those
  a user deliberately saves to the shared repository.
- All API routes require a bearer token except login and the health check.
