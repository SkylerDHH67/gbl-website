# Global Blade League — public website

A static site with no build step and no server. Google Sheets is the
database; this repo is only the display layer — same pattern as
Dark Horse Hoops and Dark Horse Series.

## One-time setup

### 1. Populate the feed tabs in the GBL Master Sheet

Open the Sheet, use the **GBL Live Match** menu → **Export Feeds (for website)**.
This fills in `feed_players`, `feed_parts_catalog`, `feed_config`,
`feed_schedule`, `feed_matches`, `feed_battle_log`, `feed_reshuffle_log`
(created automatically if it doesn't exist yet), `feed_standings`, and
`feed_build_stats` from your real data. Run **Recalculate Standings**
first if you want fresh ratings baked into the export.

### 2. Publish each feed tab to the web

For **each** of the 9 `feed_*` tabs: **File → Share → Publish to web** →
choose that specific tab from the dropdown (never "Entire document") →
format **CSV** → **Publish**. Copy the URL it gives you.

This is a one-time step per tab — the URL never changes once published,
even as you re-run Export Feeds later with new data.

### 3. Fill in `js/config.js`

Paste each tab's published URL into the matching slot in `window.APP_CONFIG.FEEDS`.
That's the only file you should ever need to edit for normal operation.

### 4. Preview locally (optional)

```
python3 -m http.server 8000
```
then open `http://localhost:8000` — or just open `index.html` directly in a
browser, since there's no build step.

### 5. Deploy

Push this folder to its own GitHub repo and enable **GitHub Pages** (Settings
→ Pages → deploy from the `main` branch), exactly like `dark-horse-hoops` and
`dark-horse-series`. Any static host works too (Netlify, Vercel, Cloudflare
Pages) since there's genuinely no build step — just point it at this folder.

## Keeping the site fresh

There is no redeploy step for data changes. Whenever you want the public
site to reflect new matches/standings:

1. In the Sheet: **Recalculate Standings**, then **Export Feeds**.
2. That's it — the site re-fetches all 9 CSVs fresh on every page load
   (no caching), so the next visit already shows the new data.

You only touch this repo's code if you want to change the site's design or
add a feature — never for routine league updates.

## Repository structure

```
index.html            Home
standings.html         Per-stage standings
schedule.html          Schedule + results
players.html           Player directory
player.html            Individual player profile (?id=...)
builds.html             Build usage/win-rate
match.html              Match Center (?id=...)
stats-lab.html          Placeholder - deep analytics, planned follow-up
playoffs.html           Placeholder - populates automatically once a Playoffs/Championship stage has matches
archive.html            Placeholder - populates automatically once a season is archived
css/styles.css          All visual design
js/config.js            Feed URLs - the one file worth knowing about
js/utils.js             Pure helpers (CSV parsing, formatting) - CSV parser is the same
                        RFC4180-ish implementation proven in Dark Horse Series,
                        stress-tested against commas/quotes/newlines/emoji
js/data.js               Fetches + normalizes all 9 feeds, never lets one bad
                        feed block the others
js/render.js             Shared loading/error/empty state builders, player
                        lookup, badges
js/nav.js                Mobile nav toggle + active-link highlighting
js/home.js, js/standings.js, js/schedule.js, js/players.js, js/player.js,
js/builds.js, js/match-center.js
                        One file per page, each calling into utils/data/render
```

## Known limitations (see full handoff notes for detail)

- **Stats Lab** (combined player/opponent/season/stage/build filtering) is a
  placeholder. The Builds page already shows real usage/win-rate data; the
  deeper cross-filtered version is a larger build deliberately deferred
  rather than rushed.
- **Archive** is a placeholder with nothing to show yet — no season has
  been archived. It will populate once `Archive_Standings`/`Archive_Champions`
  etc. have real rows and a matching feed/export step is added.
- **Match Center decks**: a player's full 3-build deck is reconstructed from
  whichever builds actually appear in the battle/reshuffle logs for that
  match. A build that was locked in but never piloted (very short matches
  only) won't be knowable until `deck_a_build_ids`/`deck_b_build_ids` are
  also stored on Match Database - see handoff notes.
- No GBL-specific logo/colors exist yet - the brand mark is a placeholder.
  Every image on the site (player badges, part art) is URL-driven and falls
  back gracefully when blank, so adding real assets later is just filling in
  a column, never a code change.
