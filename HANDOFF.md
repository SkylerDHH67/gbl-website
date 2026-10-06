# GBL — Tonight's Handoff (Phases 5–7)

Written at the end of a single long session, done under a real time
constraint. This is the honest state of things: what's built and tested,
what's deliberately deferred, and what to do next.

## 1. What shipped tonight

**Phase 5 — Destructive QA.** A synthetic-data stress test
(`GBL Phase 5 - QA and Feeds/stress_test.js`) drove the real, unmodified
MatchEngine.js and RatingEngine.js through every scenario in the spec:
matches-played spread, tiny-sample undefeated vs proven records, repeated
matchups, redos, multiple reshuffles, first-to-7/10, illegal decks (6
different rejection paths), mixed product systems, stage reassignment,
inactive/historical players, and undo at every boundary (mid-battle, across
a reshuffle, after completion). **33/33 passing.** One bug was found and
fixed — in the test harness itself (a premature loop break masked an
undo-after-completion scenario), not in the product code. Zero real
engine/rating bugs found. Confirmed findings: the engine is fully
system/category-agnostic (safe for X/Burst/CX/future parts with zero code
changes), an inactive player's history is permanently preserved, and stage
reassignment works cleanly.

**CSV feed export** (`GBL Phase 5 - QA and Feeds/FeedExport.gs`). New Apps
Script that populates 9 `feed_*` tabs from the real data, excluding internal
notes columns, for the website to consume via Google's own "Publish to web"
CSV export. 8/8 integration tests passing, including a real bug fix
(`feed_reshuffle_log` now gets auto-created with correct headers instead of
requiring a nontechnical admin to build it by hand).

**Phase 6/7 — Website** (`GBL Website/`). Static HTML/CSS/JS, same proven
architecture as Dark Horse Hoops/Dark Horse Series (Google Sheets as the
database, no build step, no server). Home, Standings, Schedule/Results,
Players + player profiles, Builds, and a full Match Center (header, decks,
chronological battle log with reshuffle/redo markers, per-build box score,
match flow). The CSV parser is the same RFC4180 implementation proven in
Dark Horse Series, and it was re-stress-tested here against GBL-specific
values (commas in names, quotes in notes, emoji flags, embedded newlines) —
all passing. With no headless browser available in this environment, the
actual shipped JS (not a mental model of it) was verified by loading the
real files into a scripted Node context against realistic synthetic feed
data — 7 additional tests passing there, covering feed parsing, graceful
degradation when a feed is missing/unpublished, and the Match Center's
timeline ordering, voided-event exclusion, and box-score attribution.

## 2. What you need to do tomorrow

1. **Apps Script**: add the new `FeedExport.gs` file (full contents given in
   chat), and make the small `onOpen()` edit (adds an "Export Feeds" menu
   item) - also given in chat, same pattern as the earlier Recalculate
   Standings edit.
2. **Publish the 9 `feed_*` tabs to the web** (File → Share → Publish to web,
   one tab at a time, CSV format) - see `GBL Website/README.md` for the
   exact steps.
3. **Fill in `GBL Website/js/config.js`** with each feed's published URL.
4. **Push `GBL Website/` to its own GitHub repo** and enable GitHub Pages -
   exactly like your other two repos. No build step, so it's a straight
   push.

## 3. Deliberately deferred (not forgotten)

- **Stats Lab depth** (combined player/opponent/season/stage/build
  filtering, the custom-metric write-ups the spec calls for). The Builds
  page already shows real usage/win-rate numbers; the fully filterable
  version deserves its own session rather than a rushed one at 1am.
- **Archive** - there's nothing to show yet (no season has closed). The
  page is a real, honest placeholder, not a dead link.
- **Deck completeness for very short matches.** A player's full 3-build deck
  is reconstructed from the battle/reshuffle logs. If a match ends inside
  rotation 1 before a 3rd build is ever reached, and no reshuffle happens,
  that unused build isn't knowable from the feeds as they exist today. The
  clean fix: store `deck_a_build_ids`/`deck_b_build_ids` directly on Match
  Database when a match completes (a small addition to `apiRecordResult` in
  Code.gs). Not done tonight to avoid touching the tested live-scoring path
  under time pressure.
- **No GBL-specific branding** exists yet (logos/colors) - the site uses a
  placeholder identity. Every image is URL-driven and degrades gracefully,
  so this is a data fill-in later, never a code change.

## 4. Future enhancements, roughly prioritized

**High value:** store deck_a/b_build_ids on Match Database (closes the
limitation above); real Stats Lab with combined filtering; a scheduled/cron
refresh so Standings/Feeds update automatically instead of needing a manual
menu click after each match session.

**Medium value:** player photos/badges once real assets exist; head-to-head
and matchup-explorer pages (the `Build Matchup Explorer` tab is explicitly
labeled "Phase 8" in the original scaffold); bracket visualization if you
ever do want structured playoffs later.

**Low value / nice-to-have:** dark/light theme toggle; export standings as
an image for social sharing; multi-language support.

## 5. IDs and settings worth preserving somewhere safe

- GBL Master Sheet ID: `1o-uG9qMyG6kDwlglU8C8Vf0fNoZpQDCGZWuO-fh9fgY`
- Each `feed_*` tab's individual "Publish to web" URL, once you generate them
  (there's no way to regenerate the exact same URL if lost - you'd republish
  and get a new one, then need to update `config.js`).
- Whatever GitHub repo name/Pages URL you create for `GBL Website/`.

## 6. Test suites available if you want to re-verify anything

- `GBL Phase 3 - Live Match Engine/integration.test.js` - 7 tests, live
  match engine + Sheets adapter.
- `GBL Phase 4 - Rating Engine/RatingEngine.test.js` - 14 tests, pure rating
  math.
- `GBL Phase 4 - Rating Engine/standings_integration.test.js` - 8 tests,
  standings adapter.
- `GBL Phase 5 - QA and Feeds/stress_test.js` - 33 tests, destructive QA.
- `GBL Phase 5 - QA and Feeds/feed_export.test.js` - 8 tests, feed export.

All runnable with plain `node <file>.js`, no install step.
