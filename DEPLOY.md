# DEPLOY — Design Validator on astrikos.xyz

Follows `deployment_context.md` exactly. Two ports, two nginx blocks, one backend.

**You will need:** an AI API key (section 5), shell access to the server with Node 18+, pm2 and
nginx, and access to Cloudflare DNS.

## 1. Process table

| Thing | Value |
| --- | --- |
| POC name | `designvalidator` |
| Frontend port | **3309** |
| Backend port (REST **+** WS, one port) | **4309** |
| Frontend subdomain | `designvalidator.astrikos.xyz` |
| Backend subdomain | `designvalidator-api.astrikos.xyz` |
| pm2 frontend name | `designvalidator_3309` |
| pm2 backend name | `designvalidator_be_4309` |
| Frontend build output | `client/dist/` |
| Backend entry | `server/index.js` |

The backend is a **single Node process** serving REST and (if enabled) websockets on
port 4309 — no second process, no extra port, no `fastapi` file. Node 18 or newer.

## 2. Registry

`deployment_context.md` §6 already carries this row:

| POC | Frontend | Backend | Status |
| --- | --- | --- | --- |
| designvalidator | 3309 | 4309 | live |

## 3. Before you start: retire the previous deployment

Ports 3309 and 4309 were previously used by this POC under the name `desval`. If that
deployment is still on the server, it must go first or the new processes cannot bind.
Its checkout and `server/data` contain documents and data that must not stay in service.

```bash
pm2 delete desval_3309 desval_be_4309    # ignore "not found" if they are already gone
pm2 save
```

Then:

- Remove the `desval.astrikos.xyz` block from `astrikos.conf` and the
  `desval-api.astrikos.xyz` block from `astriverse.conf`.
- Remove both `desval` records from Cloudflare.
- Delete the old checkout directory, including its `server/data`.

## 4. Get the code onto the server

Clone the clean repository. Do not clone the original POC repository: its name and
history contain client documents.

```bash
git clone https://github.com/productastrikos/design-validator.git <deploy-dir>
cd <deploy-dir>
```

The clone is about 60 MB because it includes the rule books in `server/docs`. If the
repository is private, give the server read access first, for example with a deploy key.

## 5. Configure the server: API key and settings

**You need an AI API key.** Without one you can sign in and upload text documents, but every
AI feature fails.

Everything secret goes in **one file on the server: `server/.env`**. You create it by hand, and
it is never committed to GitHub. Never put the key in `client/`, because everything there is
built into the public website.

### Step 1: Get an API key

1. Go to <https://console.groq.com> and sign in. A free account works.
2. Open **API Keys** and choose **Create API Key**.
3. Copy the key straight away. It starts with `gsk_` and is shown only once.

To check the key, run this from the server, which also proves the server can reach the provider.
`200` means the key works and `401` means it is wrong.

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer <your key>"
```

### Step 2: Create the file

```bash
cd <deploy-dir>/server
cp .env.example .env
chmod 600 .env        # only the deploying user can read it
nano .env
```

### Step 3: Fill in the values

Replace the first four, and leave the rest as they are unless you need to change them.

| Setting | Required? | What to put |
| --- | --- | --- |
| `LLM_API_KEY` | **Yes** | The key from Step 1 |
| `ADMIN_PASSWORD` | **Yes** | A strong password for the `admin` account |
| `ENGINEER_PASSWORD` | **Yes** | A strong password for the `engineer1` account |
| `JWT_SECRET` | **Yes** | The output of `openssl rand -hex 48` |
| `PORT` | Leave as is | `4309`. The pm2 command in section 6 also sets it |
| `MAX_UPLOAD_MB` | Leave as is | `100`. Keep it below `client_max_body_size` in nginx |
| `ORG_NAME` | Optional | Your organisation's name, printed on generated tenders and enquiry letters. If empty, tenders use the ship builder named in the source document and letters show `[Organisation Name]` |

The finished file looks like this, with your own values:

```
LLM_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
PORT=4309
ADMIN_PASSWORD=your-strong-admin-password
ENGINEER_PASSWORD=your-strong-engineer-password
JWT_SECRET=4f9c0e...the-long-openssl-output
ORG_NAME=
MAX_UPLOAD_MB=100
```

- Put no spaces around `=`.
- If a value contains `#` or a space, wrap it in double quotes. Otherwise it gets cut off there.
- The backend **will not start** while `your_api_key_here` or `change_me` remain in the file.
- The two passwords apply only when the accounts are first created, so set them **before the
  first start**. After that, change passwords under **User Management**.

### Step 4: Confirm the key after starting

Once section 6 is done, sign in and open **Settings → Test Connection**. It sends one small real
request to the AI provider, so "Inference engine online" means the key works.

### Changing the key later

```bash
nano <deploy-dir>/server/.env
pm2 restart designvalidator_be_4309
```

There is no need to rebuild the frontend or reload nginx.

### Using a different AI provider

Any OpenAI-compatible service works, including a private one if documents must stay inside your
network. Add these to `server/.env`, then restart the backend:

```
LLM_API_KEY=<that provider's key>
LLM_BASE_URL=https://provider.example.com/v1
LLM_MODEL=<its text model>
LLM_VISION_MODEL=<its vision model, used for scans and drawings>
```

End `LLM_BASE_URL` at `/v1`, without `/chat/completions`. If a private endpoint needs no key, set
`LLM_API_KEY` to any non-empty value.

### Frontend settings: nothing to add

`client/.env.production` is already committed with the correct public backend address, and holds
no secrets. If that address ever changes, edit the file and run `npm run build` in `client/` again.

### Troubleshooting

Backend errors are in `pm2 logs designvalidator_be_4309`.

| What you see | Cause | Fix |
| --- | --- | --- |
| Backend keeps restarting, and logs show `[Config] Replace the placeholder value of ...` | A placeholder is still in `server/.env` | Replace the settings it names, then restart |
| `The inference engine is not configured. Set LLM_API_KEY on the server.` | `server/.env` is missing, or the key is empty | Complete Steps 2 and 3, then restart |
| `The inference engine rejected the API key. Check LLM_API_KEY in server/.env.` | The key is wrong or was revoked | Create a new key and follow "Changing the key later" |
| `The inference engine returned an error (HTTP 429).` | The provider's rate limit was reached | Wait a minute and retry, or move to a paid plan |
| `The inference engine is unreachable.` | The server cannot reach the provider | Check outbound HTTPS with `curl -I https://api.groq.com` |
| Forgot the admin password | | Stop the backend, delete `server/data/users.json`, and start it again. **This removes all user accounts** and recreates the two defaults from `server/.env` |

## 6. Build + start

```bash
# ── Frontend (static SPA) ─────────────────────────────────────────
cd client
npm install && npm run build                       # → dist/
pm2 start serve --name "designvalidator_3309" -- ./dist -s -p 3309

# ── Backend (API + socket, single port) ───────────────────────────
cd ../server
npm install                                        # one package comes from cdn.sheetjs.com
PORT=4309 pm2 start index.js --name "designvalidator_be_4309"

pm2 save
```

`npm run build` picks up `client/.env.production` automatically (Vite loads it for the
`production` mode), so the bundle points at the backend subdomain.

On `npm install` for the client, Vite is a dev dependency: if the shell sets
`NODE_ENV=production`, use `npm install --include=dev` or the build will not find it.

The backend indexes the rule books in `server/docs` at every start, and does not answer
requests until that finishes (about 15 seconds on a developer laptop). Wait for that before
running the checks in section 9.

## 7. nginx

### `astrikos.conf` — frontend

```nginx
server {
    listen 8443 ssl;
    ssl_certificate     /etc/certs/astrikos.xyz/fullchain.pem;
    ssl_certificate_key /etc/certs/astrikos.xyz/privkey.pem;
    server_name designvalidator.astrikos.xyz;
    location / {
        add_header 'Access-Control-Allow-Origin' '*' always;
        proxy_pass http://127.0.0.1:3309;
    }
}
```

### `astriverse.conf` — backend (REST + websockets, one block)

Requires this once at the top of the file:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

```nginx
server {
    listen 8443 ssl;
    ssl_certificate     /etc/certs/astrikos.xyz/fullchain.pem;
    ssl_certificate_key /etc/certs/astrikos.xyz/privkey.pem;
    server_name designvalidator-api.astrikos.xyz;

    # Document uploads are large (PDF/DWG); the default 1m would 413 them. Set above
    # MAX_UPLOAD_MB so an oversized file gets the app's own clear error message.
    client_max_body_size 110m;

    location / {
        proxy_pass http://127.0.0.1:4309;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
        proxy_buffering off;
    }
}
```

Apply:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 8. Cloudflare DNS

| Record | Mode |
| --- | --- |
| `designvalidator.astrikos.xyz` | **Orange** (proxied) |
| `designvalidator-api.astrikos.xyz` | **Gray** (DNS-only) |

## 9. Verify

```bash
curl -k https://designvalidator.astrikos.xyz:8443            # SPA HTML
curl -k https://designvalidator-api.astrikos.xyz:8443/       # backend responds
curl -k https://designvalidator-api.astrikos.xyz:8443/api/health
```

The health response should include `"aiConfigured":true`, `"ready":true` and `"documents":3`.
`aiConfigured` only shows that a key is present, not that it works.

Then open `https://designvalidator.astrikos.xyz:8443`, sign in, and use
**Settings → Test Connection** to prove the API key works and the knowledge base is loaded.

For a full functional check, upload the fictitious documents in `sample-docs/`. Its
`README.md` lists which file goes in which module and what each module should find.

## 10. Notes

- **No hardcoded hosts, IPs, or ports in shipped source.** Every browser call goes through
  `client/src/services/apiBase.js`, which reads `VITE_API_URL`.
- **Data lives in `server/data/`** (accounts, lessons learnt, audit log, shared repository,
  rule books). Keep it across redeploys and include it in backups.
- **Uploaded document text goes to the inference endpoint.** The default endpoint is a
  cloud API (Groq). To keep documents inside a network, set `LLM_BASE_URL` to a private
  OpenAI-compatible endpoint.
- Long AI requests: the backend's own LLM timeout is ~100 s (`LLM_TIMEOUT_MS`), comfortably
  inside the 7d nginx proxy timeouts above.
- CORS is open on the backend (`app.use(cors())`), which is what the split frontend/backend
  subdomains need. Auth is a bearer token, not a cookie, so no
  `Access-Control-Allow-Credentials` is required.
