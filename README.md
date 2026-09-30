# UDD Flood Tracker

A React + Material UI testing website for the Universidad de Dagupan community flood reporting proposal. A light, Google Material-inspired interface makes road observations easier to scan on desktop and mobile while preserving UDD’s navy and sky-blue identity.

**Testing website:** https://gabmac222.github.io/udd-flood-tracker/

## What you can test

- Search and filter road observations; switch between the schematic map and a text list.
- Read all observations on a road, including conflicting levels. Pins show the highest reported level.
- Submit a manual Baha Level, observation time, description, optional approximate GPS, and photo.
- Cover identifying details before saving a photo. Only the canvas-generated JPEG is retained; the original file is not uploaded.
- View, export, and remove your own reports. Expired observations leave the current view but remain in history.
- Reload and report offline after the first successful load.
- Check endpoint observations, browse safety resources, record a personal exposure date, and test local help records.

**GitHub Pages uses browser storage.** Each visitor’s reports, photos, and help records stay in that browser’s IndexedDB. They are not shared with other visitors or sent to responders. Clearing site data removes them. This is a testing pilot, not an operational emergency service.

The map is an explicitly labeled schematic. Seeded conditions are samples. AI depth estimation, automatic privacy detection, real navigation, official agency feeds, forecasts, SMS, and rescue dispatch are not connected.

## Run locally

Node.js **24+** is required for the optional SQLite backend.

```sh
npm ci
npm run dev
```

Open the Vite localhost address shown in the terminal. Browser testing mode runs without a backend.

To use the included Node + SQLite API instead, run these in two terminals:

```sh
npm run server
```

```sh
npm run dev:local
```

The API binds to `127.0.0.1:4173`; Vite binds to `127.0.0.1:5173` and proxies API requests. Stop an older server on those ports first. The database lives in `local-server/data/` and is excluded from version control. In API mode, offline submissions use an IndexedDB outbox and retry automatically. Browser identifiers support local ownership and are not production authentication.

## Verify

```sh
npx playwright install chromium
npm test
npm run test:api
npm run build
npm run preview -- --port 4180
# In a separate terminal:
npm run test:ui
```

The frontend tests cover the five-level scale, expiry, filtering, conflict handling, and input/GPS validation. The backend suite covers persistence, ownership, idempotency, report expiry, confirmations, help-record privacy, and validation. Browser tests cover reporting, pixel-level photo redaction, approximate GPS, offline reload/reporting, record deletion, route checks, responsive layouts, and automated WCAG checks. Automated scans do not replace field or assistive-technology testing.

With the API and `dev:local` running, `node test/local-api.mjs` verifies the React-to-SQLite integration and removes its synthetic record afterward. Screenshots are saved under `test-results/`, which is excluded from version control.

## Publish updates

This repository publishes the prebuilt `docs/` folder from `main` through GitHub Pages. It needs no API secrets or external hosting subscription.

```sh
npm run build:pages
```

Commit the source changes and generated `docs/` files, then push to `main`. GitHub Pages will publish the updated build. `docs/` is generated; edit `src/` and `public/` instead. Vite uses relative asset paths and hash navigation so the project works under `/udd-flood-tracker/`.

The service worker precaches the compiled application, fonts, and assets. A successful first visit is required before offline use. Static test reports remain browser-local even when online.

## Design and assets

- React 19, Material UI, Vite, and Lucide outline controls.
- Locally served Roboto and Manrope fonts, with licenses in `THIRD-PARTY-NOTICES.txt`.
- UDD navy `#000269`, sky `#8DC9FD`, white, and derived light blue surfaces.
- Five Baha Levels preserve the proposal’s numbers, names, and metric depth ranges.
- Six custom illustrated elements were generated using the built-in **image_gen** tool. The transparent sprite sheet is `public/assets/safety-illustrations.png`; its exact prompt is `IMAGEGEN-PROMPT.txt`. It is used in the report flow, community card, safety hub, guide, and empty states.
- The existing university seal is used without alteration. The original proposal’s stock/meme photos and private workspace documents are not included in the published website.

## Safety sources

- [Dagupan City contact directory](https://www.dagupan.gov.ph/contact-us/) — public CDRRMO contact.
- [CDC flood-related leptospirosis prevention](https://www.cdc.gov/leptospirosis/prevention/index.html) — general exposure guidance.

Contacts and advice were checked during the prototype work on 30 September 2026. Current facility opening, capacity, road safety, and agency connection status are not inferred from sample data.
