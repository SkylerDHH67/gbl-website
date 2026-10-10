/* =========================================================
   GLOBAL BLADE LEAGUE
   header-meta.js — injects a small "active season + today's
   date" strip into the header bar on EVERY page, so the site
   always signals it's being kept up to date, not just on the
   home page. Sourced from feed_config (key/value rows, same
   "season:<id>" / "season_status:<id>" convention data.js's
   buildConfigMaps uses) - the active season is config-driven,
   never hardcoded, so a new season just works once Settings
   is updated.

   Like footer-social.js, this only depends on config.js +
   utils.js (NOT data.js), so it works on every page including
   ones that don't load the full data layer, and fails silently
   (strip just doesn't appear) if feed_config is unreachable.
   ========================================================= */

(function () {
  "use strict";

  function fetchConfigRows() {
    var U = window.APP_UTILS;
    var url = window.APP_CONFIG.getFeedUrl(window.APP_CONFIG.FEED_TABS.CONFIG);
    if (U.isBlank(url)) return Promise.resolve([]);
    var bust = url + (url.indexOf("?") !== -1 ? "&" : "?") + "_=" + Date.now();
    return fetch(bust, { credentials: "omit", cache: "no-store" })
      .then(function (res) { return res.text(); })
      .then(function (text) {
        var looksLikeHTML = /^\s*</.test(text) && /<html/i.test(text);
        if (looksLikeHTML) return [];
        return U.rowsToObjects(window.APP_UTILS.parseCSV(text).slice(2));
      })
      .catch(function () { return []; });
  }

  function findActiveSeasonLabel(rows) {
    var seasons = {}, seasonStatus = {};
    rows.forEach(function (r) {
      var key = r.key || "";
      if (key.indexOf("season_status:") === 0) seasonStatus[key.slice(14)] = r.value;
      else if (key.indexOf("season:") === 0) seasons[key.slice(7)] = r.value;
    });
    var activeId = Object.keys(seasonStatus).filter(function (id) {
      return String(seasonStatus[id] || "").toLowerCase() === "active";
    })[0];
    if (activeId) return seasons[activeId] || activeId;
    // Fallback: no season explicitly flagged active - show the last one
    // listed rather than nothing.
    var ids = Object.keys(seasons);
    return ids.length ? seasons[ids[ids.length - 1]] : null;
  }

  function renderStrip(seasonLabel) {
    var U = window.APP_UTILS;
    var today = new Date();
    var dateStr = today.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    var bits = [];
    if (seasonLabel) bits.push('<strong>' + U.esc(seasonLabel) + '</strong>');
    bits.push(U.esc(dateStr));

    document.querySelectorAll("header.site-header").forEach(function (header) {
      var row = document.createElement("div");
      row.className = "wrap header-meta-row";
      var el = document.createElement("div");
      el.className = "header-meta-strip";
      el.innerHTML = bits.join(' <span class="dot-sep">•</span> ');
      row.appendChild(el);
      header.appendChild(row);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.APP_CONFIG || !window.APP_UTILS) return;
    fetchConfigRows().then(function (rows) {
      renderStrip(findActiveSeasonLabel(rows));
    });
  });
})();
