# Deploy

Static Vite SPA + Pages Functions (API) + KV (storage) on Cloudflare Pages.

## 1. Create the KV namespace

```sh
pnpm dlx wrangler kv namespace create FORECAST_KV
```

Copy the returned `id` into `wrangler.toml` (replace `REPLACE_WITH_KV_NAMESPACE_ID`).

## 2. Connect the repo to Cloudflare Pages

Dashboard → Pages → Create → Connect to Git → `stoiccapital/engineering.office`.

- Framework preset: **Vite**
- Build command: `pnpm build`
- Output dir: `dist`
- Node version: `20`

## 3. Bind KV + set the shared password

In the Pages project → Settings → Functions:

- **KV namespace bindings**: variable `FORECAST_KV` → the namespace from step 1
- **Environment variables (encrypted)**: `AUTH` = your shared office password

(For preview deploys, repeat the same bindings in the Preview tab.)

## 4. Deploy

Push to `main`. Cloudflare builds + deploys automatically.

## Local dev with the API

```sh
pnpm build
pnpm dlx wrangler pages dev dist --kv FORECAST_KV --binding AUTH=dev-password
```

Then open <http://localhost:8788>. The Vite dev server (`pnpm dev` on port 5173) will **not** run the Functions — use `wrangler pages dev` when testing the API.
