/* =========================================================
   GLOBAL BLADE LEAGUE
   config.js — the only file you should need to touch to point
   this site at your Google Sheet. League data itself lives
   entirely in the Sheet, never here.

   HOW THIS WORKS (updated model - no "Publish to web" needed):
   1. Share the Display Sheet (NOT Master) as "Anyone with the link"
      -> Viewer. That's the only sharing step - no per-tab publish.
   2. Put the Display Sheet's file ID below (the long string in its
      URL, between /d/ and /edit).
   3. Every feed_* tab is listed once in FEED_TABS below. getFeedUrl()
      builds the CSV URL for any tab automatically - nothing else
      needs to change when a new feed tab is added, just add one
      line to FEED_TABS.
   4. On Master, run "Export Feeds" (and Recalculate Standings /
      Recalculate Stats Lab) any time you want the live site to
      reflect new matches - these URLs stay the same forever, you're
      just updating the data behind them. "Enable Auto-Refresh" on
      Master does this on a timer automatically.
   ========================================================= */

window.APP_CONFIG = {
  SITE_NAME: "Global Blade League",
  SITE_SHORT: "GBL",

  // The Display Sheet's file ID - the long string in its URL between
  // /d/ and /edit. This is NOT the Master Sheet's ID; the Display
  // Sheet is the public-safe mirror the website actually reads from.
  DISPLAY_SHEET_ID: "19BnGx3L4T1Io0cp0nYV8Hu1WtbzbMFYNO3jTDv7pZK0",

  // One entry per feed_* tab in the Display Sheet. Add a tab here the
  // moment you create it on Master/Display - everything downstream
  // (data.js, any page) references these keys, never a raw URL.
  FEED_TABS: {
    PLAYERS: "feed_players",
    PARTS_CATALOG: "feed_parts_catalog",
    CONFIG: "feed_config",
    SCHEDULE: "feed_schedule",
    MATCHES: "feed_matches",
    BATTLE_LOG: "feed_battle_log",
    RESHUFFLE_LOG: "feed_reshuffle_log",
    STANDINGS: "feed_standings",
    BUILD_STATS: "feed_build_stats",
    HEAD_TO_HEAD: "feed_head_to_head",
    DECK_RECORDS: "feed_deck_records",
    BUILD_PAIR_SYNERGY: "feed_build_pair_synergy",
    STATS_LAB_SOURCE: "feed_stats_lab_source",
    MEDIA: "feed_media"
  },

  // Shown when a feed is unreachable, so the site never just looks
  // broken - it tells you exactly what to do.
  SETUP_HELP_URL: "README.md",

  // Default GBL brand mark - replace with a real logo URL once you have
  // one. Every image on this site is URL-driven and falls back gracefully
  // if blank or unreachable, so nothing breaks either way. League-wide
  // static assets (logos, wordmarks, banners) live in /images - reference
  // them as a relative path, e.g. "images/gbl-logo.png".
  DEFAULT_LOGO_URL: "",

  // Most recent N results/matches to show on the home page.
  HOME_RESULTS_COUNT: 5,
  HOME_SCHEDULE_COUNT: 5,
  HOME_LEADERS_COUNT: 5
};

// Builds the public CSV export URL for a Display Sheet tab by name. Works
// off plain "Anyone with the link" view sharing - no "Publish to web"
// step required. Equivalent in spirit to the old published-CSV links, but
// one sharing action covers every current and future tab instead of a
// separate publish per tab.
window.APP_CONFIG.getFeedUrl = function (tabName) {
  if (!tabName) return "";
  return "https://docs.google.com/spreadsheets/d/" + window.APP_CONFIG.DISPLAY_SHEET_ID +
    "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(tabName);
};
