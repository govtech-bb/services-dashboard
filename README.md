# Service Dashboard

Internal admin tool for **GovTech Barbados** to manage the visibility of government services on the [alpha-preview](../alpha-preview) portal. Authenticated administrators can view all services, inspect their status, and toggle feature flags at both the service and subpage level.

---

## Features

### Authentication
- Protected behind **AWS Cognito** using the OIDC Authorization Code flow
- Unauthenticated users see a sign-in prompt; the dashboard is fully inaccessible without a valid session
- Full sign-in/sign-out cycle with redirect through the Cognito Hosted UI

### Services Table
- Lists all government services with sortable columns: **Service** (title + slug), **Category**, **Status**, and **Feature flag**
- Row expansion reveals **subpage-level flags** for services that have sub-pages (e.g. `/apply`, `/check`, `/eligibility`)

### Feature Flag Management
- **Service-level toggle** — enabling or disabling the flag cascades to all subpages in a single request
- **Subpage-level toggle** — each subpage can be independently flagged from the expanded row panel
- Both mutations use **optimistic updates**: the UI reflects the change immediately and rolls back on error

### Filtering & Search
- Tab bar with counts: **All / Backlog / Feature flagged / Live**
- Text search across service name, slug, and category

### Service Status Derivation
A service's status is computed by combining data from two upstream APIs:

| Status | Condition |
|---|---|
| `backlog` | No form implementation exists yet (sourced from alpha-preview) |
| `feature-flagged` | Has an implementation but `isProtected` is `true` for the service or any subpage |
| `live` | Has an implementation and nothing is protected |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build tool | Vite 7 |
| Language | TypeScript 5.9 |
| Routing | TanStack Router v1 (file-based) |
| Data fetching | TanStack Query v5 |
| Table | TanStack Table v8 |
| Auth | react-oidc-context v3 + oidc-client-ts v3 (AWS Cognito) |
| Styling | Tailwind CSS v4 |
| UI components | CVA-based shadcn-style components (`Badge`, `Switch`) |
| Icons | Lucide React |
| State | Zustand v5 |
| Linting | Biome v2 (via `ultracite` preset) |
| Package manager | pnpm 9.10 |

---

## Project Structure

```
service-dashboard/
├── src/
│   ├── main.tsx                  # App entry — wires AuthProvider, QueryClient, RouterProvider
│   ├── router.ts                 # TanStack Router instance
│   ├── routeTree.gen.ts          # Auto-generated route tree (do not edit manually)
│   ├── index.css                 # Tailwind v4 import + CSS theme tokens
│   ├── routes/
│   │   ├── __root.tsx            # Root layout: auth guard, header, sign-out, Outlet
│   │   └── index.tsx             # "/" — Services page (tabs + table)
│   ├── components/
│   │   ├── services-table.tsx    # TanStack Table with sorting, row expansion, subpage flags
│   │   └── ui/
│   │       ├── badge.tsx         # Status badge variants
│   │       └── switch.tsx        # Toggle switch
│   ├── api/
│   │   ├── types.ts              # Shared types: ServiceSummary, ServiceAccessConfig, EnrichedService
│   │   ├── client.ts             # Fetch wrappers for alpha-preview + form-processor-api
│   │   └── queries.ts            # TanStack Query hooks
│   └── lib/
│       └── utils.ts              # cn() helper (clsx + tailwind-merge)
├── vite.config.ts
├── tsr.config.json               # TanStack Router CLI config
└── biome.jsonc
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9.10+
- A running instance of [alpha-preview](../alpha-preview) and [form-processor-api](../form-processor-api)
- An AWS Cognito User Pool configured with an app client

### Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```sh
cp .env.example .env
```

| Variable | Description |
|---|---|
| `VITE_PROCESSING_API_URL` | Base URL for `form-processor-api` (e.g. `http://localhost:5500/api`) |
| `VITE_ALPHA_PREVIEW_URL` | Base URL of the alpha-preview app (e.g. `http://localhost:3000`) |
| `VITE_COGNITO_AUTHORITY` | Cognito User Pool endpoint (`https://cognito-idp.{region}.amazonaws.com/{userPoolId}`) |
| `VITE_COGNITO_CLIENT_ID` | Cognito app client ID |
| `VITE_COGNITO_REDIRECT_URI` | OAuth callback URL (e.g. `http://localhost:5173`) |
| `VITE_COGNITO_DOMAIN` | Cognito Hosted UI domain (without `https://`) — used for sign-out redirect |

### Development

```sh
pnpm install
pnpm dev
```

The app runs on `http://localhost:5173` by default.

> The `dev` and `build` scripts both run `tsr generate` first to regenerate `routeTree.gen.ts` from the file-based routes directory.

### Build

```sh
pnpm build
```

---

## Roadmap

- [ ] **Fetch services from a remote data source** — Replace the current alpha-preview API dependency for the service catalogue with a direct integration against a remote source such as Notion or Airtable. This would allow non-technical staff to maintain the canonical list of services (including backlog items) without a code deployment, and would decouple the dashboard from the alpha-preview runtime.
