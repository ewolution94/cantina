# Cantina

The Kochwerk canteen menu (OTTO, Hamburg) as a fast, installable web app. It shows every outlet and every day, in German and English. The data is the same as on [kochwerk-web.webspeiseplan.de](https://kochwerk-web.webspeiseplan.de/menu); only the Speiseplan is shown.

- **Outlets side by side:** Elbe, Bistro Boulevard, bonprix, Steelrunner and Kiosk, in a pill bar like Clinch's. On a phone it scrolls inside its frame, with chevrons wherever more outlets are hidden. The outlet's header shows whether it's open right now (Hamburg time) and its week's hours, with days that share hours folded into one line.
- **Overview:** the first pill lists every outlet's menu for the selected day on one page, with just the outlet, each dish and its price, plus a link to that outlet's full menu. Filters apply, so Vegan here shows what's vegan anywhere today. On desktop the outlets sit side by side; `/overview` links straight to it.
- **Simplified view (Settings):** no photos, halftone, nutrition or CO₂. Each dish is a diet dot, its name and its price, and the outlet header is its name, status and hours. Tapping a dish still opens everything.
- **Both weeks:** the day strip covers this week and next. On a phone you can swipe the menu left or right to change the day.
- **Real photos when Kochwerk has them:** the kitchen photographs most dishes on the day. A dish without a photo gets a generated dot "plate" instead, coloured by what it is (vegan, fish, poultry …).
- **Outlet photos in halftone:** the outlet photo is drawn as dots in its own muted colours, at the same 4.6 px pitch as the portrait on ewolution.cloud. Switching outlets morphs the dots, and the portrait's magnifier makes dots near the cursor swell and part.
- **What's in it:** each dish shows its price, CO₂ rating (A–E) with grams, kcal, macros, allergens and additives.
- **Filters:** vegetarian and vegan sit right above the menu. No pork, allergens to avoid, and hide instead of dim live in Settings, where the menu's Filter button opens them. Dishes that don't fit are dimmed, with the reason shown ("Contains milk"), and the top of the menu says how many.
- **Search (⌘K or `/`):** searches every dish at every outlet across both weeks. It also lists your favourites that are coming up.
- **Favourites:** a saved dish is marked whenever it's back on the menu. The heart in the header lists every favourite with its next day and outlet, and gets a dot when one is on today. Optionally, the menu points out a favourite that's on at another outlet the same day.
- **Settings (⌘,):** the simplified view, language, theme, where to open (the last outlet or Overview visited by default, as in Clinch), the filters, and the favourites hint.
- **Shareable links:** `/elbe/2026-10-01?dish=248749` opens exactly that dish. The back button closes an open dish.
- **English and German:** the app follows the browser's language until you pick one in Settings. Light and dark follow the system the same way. Prices read "5,80€" / "5.80€", with the euro sign after the amount in both languages.
- **Installs to a home screen:** it opens instantly and shows the last menu it saw when there's no signal.

Keyboard: `←`/`→` change the day, `0` opens the Overview, `1`–`5` pick an outlet, `t` jumps to today, `f` opens the filters, `,` or `⌘,` opens Settings, `d` switches the theme, and `⌘K` or `/` opens search.

## How it works

```
 Browser (Svelte 5)                          Cantina server (no dependencies)           Kochwerk
 ┌────────────────────────────────┐  /api/menu ┌──────────────────────────────────┐
 │ one ~15 KB (br) JSON document  │ ◄───────── │ kochwerk.mjs                     │  index.php?model=…
 │ both languages, both weeks,    │            │  • 11 model calls with Referer   │ ────────────────► webspeiseplan.de
 │ every outlet                   │  /img/…    │  • normalize(): stations, diets, │ ◄──────────────── (~2.3 MB raw)
 │ halftone canvas, plates, …     │ ◄───────── │    allergens, till-code cleanup  │
 └────────────────────────────────┘            │  • cache 15 min + last good copy │  photos
                                               │  • photo proxy (one host only)   │ ────────────────► kochwerk.konkaapps.de
                                               └──────────────────────────────────┘
```

webspeiseplan.de is a jQuery app talking to `/index.php?token=…&model=…`. That endpoint sends no CORS headers, and it answers with an empty body unless the request carries the site's own Referer. So the browser can't use it directly. The server makes those calls and turns them into one compact document. The raw menu model alone is about 2.3 MB.

- **The token** comes from webspeiseplan's own public bundle (`PROXY_TOKEN` in `index.js`). If a request ever comes back empty, the server reads the current token out of that bundle again and retries, so a rotated token fixes itself.
- **Caching is stale-while-revalidate.** A menu older than 15 minutes is still served at once and refreshed behind it. After midnight the server waits for a fresh copy instead, because the week window moves. The last good document is written to `CANTINA_CACHE`, so a restart or a Kochwerk outage never shows an empty page.
- **The photo proxy** (`/img/KMSLiveRessources/…`) only fetches image paths from `kochwerk.konkaapps.de`. It exists because the halftone canvas has to read pixels, which needs same-origin images.

### What the normalizer cleans up

Kochwerk's data is written for its tills, so `normalize()` in `server/kochwerk.mjs` tidies it:

- **Categories become stations.** "Green Daily Salad 1…4" becomes one "Green Daily Salad" station, and outlet suffixes are dropped: "F&T Vegan Elbe" → "F&T Vegan", "Lust auf Suppe Groß Bistro" → "Lust auf Suppe Groß".
- **Only active plans count.** Archived plans (a 2021 backup, a 2020 counter plan) sit outside the date window, and weekends are dropped.
- **Daily assortments merge.** Screen-only plans ("Monitore …") fold into the outlet's main assortment, and a dish is never listed twice.
- **Till codes are removed from names.** "Gulasch Pute Bi" becomes "Gulasch Pute". If the English name is till shorthand, the German name is used instead. Notes stay in their own language.
- **Diet comes from Kochwerk's features.** Fish is inferred from the allergen code, since there's no feature for it.
- **Codes are cleaned up.** "No declarable allergens" (X99) and similar codes are dropped. Allergen names in capitals are toned down, and the client shows short names like "Milk" or "Mustard".

Bump `REVISION` in `kochwerk.mjs` whenever the normalizer's output changes. That way a cache written by an older build gets refetched.

## Keeping scrolling smooth

When the cursor rests over the list, scrolling slides rows under it, and each row enters and leaves its hover state. Early builds animated a paint property on hover: the row background, plus ~120 individually animated SVG circles per plate. Each row repainted, including downscaling its full-size photo, and wheel scrolling fell to 30 fps. The rules that fixed it:

- **Hover effects are compositor-only.** The row highlight is its own layer that only fades, and photos and plates scale as whole elements. Effects ease in but drop instantly, so the start of a scroll costs nothing.
- **Hover is paused while scrolling.** `src/lib/scrolling.ts` sets `data-scrolling` on `<html>` until 140 ms after the last scroll event, and CSS turns off pointer events on `main` for that time. This only applies to a mouse or trackpad, and any real mouse movement ends it at once, so the pause never swallows a click or a tap.
- **Lists use thumbnails.** Kochwerk renders a 205 px square of every dish photo (`small_MEAL_1_1_<file>`). The list uses it, and the full photo only loads in the dish sheet. The proxy falls back to the original if a square doesn't exist yet.
- **No endless paint animations.** The "open" beacon scales and fades a ring instead of animating `box-shadow`.
- **Photos are decoded off the main thread.** The halftone decodes and shrinks them with `createImageBitmap`; the Kiosk photo is 3072 × 4096.

`tools/scroll-bench.mjs` measures all of this: frame times and input latency, with suspects switchable one by one. Run it after changing anything that is on screen while scrolling.

## Run it

```bash
npm install
npm run dev          # http://localhost:5200, with the API mounted in Vite
npm run check        # svelte-check / TypeScript
npm test             # unit tests: normalizer + opening hours (Node 24+)
npm run build && npm start   # production server on :8080 (or --port 5201)
```

## Deploy (NAS)

This mirrors Fermata and Clinch:

- `ci.yml` runs the typecheck, the tests and the build, then smoke-tests the production server. That includes checking that the photo proxy refuses other paths.
- `docker-publish.yml` gates on `ci.yml`, then pushes `ghcr.io/ewolution94/cantina:latest` for amd64 and arm64.
- The shared Watchtower picks the image up. With this setup, a push to `release` is the whole deploy.
- The NAS runs `deploy/portainer-stack.yml`, on port **5200** by default.
- Make the GHCR package public, so that Watchtower can pull it anonymously.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `--port` | `8080` | Listen port |
| `CANTINA_LOCATION` | `1800` | webspeiseplan location (1800 = OTTO Kochwerk) |
| `CANTINA_TTL` | `15` | Minutes a fetched menu counts as fresh |
| `CANTINA_CACHE` | `data/menu.json` (`/data/menu.json` in Docker) | Last good menu, kept across restarts |
| `CANTINA_ORIGIN` | `https://kochwerk-web.webspeiseplan.de` | webspeiseplan instance |
| `CANTINA_TOKEN` | the public one | Only if auto-discovery ever fails |

## Project layout

```
server/kochwerk.mjs       upstream client, normalize(), cache, /api/menu + /img/ proxy
server/server.mjs         static files + API + security headers, no dependencies
src/lib/state/            app state + URL, settings (filters, favourites, start outlet), theme, toasts
src/lib/data/             document types, labels (allergens, diets), the filter, dish occurrences
src/components/           UI; Settings, Favorites, Palette and DishSheet are sheets (Sheet.svelte)
src/lib/halftone.ts       outlet photos as halftone dots (canvas)
src/lib/plate.ts          generated dot plates for dishes without a photo
src/lib/time.ts           Hamburg clock, opening status, ISO weeks
src/lib/scrolling.ts      pauses hover while the page scrolls
tools/scroll-bench.mjs    scroll benchmark (headless Chrome over CDP)
public/sw.js              offline shell, fonts and photos
brand/                    the fork-and-spoon mark and app icons (public/icons/ is rendered from them)
```
