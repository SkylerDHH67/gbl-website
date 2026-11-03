/* =========================================================
   GLOBAL BLADE LEAGUE
   ticker.js — NBA.com-style "recent results" strip, injected
   into the header on EVERY page (same self-injecting pattern as
   header-meta.js, so no page's body markup has to be hand-edited
   to add a container - only the <script> tag).

   Shows the most recent completed matches: both players' logos,
   final score (winner's side highlighted), date, and - when a
   match has Phase 8 deck data and those builds' Blade part has an
   image URL - a tiny row of the winning deck's 3 blade thumbnails.
   Falls back gracefully (no thumbnails, or the whole strip hidden)
   wherever that data isn't available, rather than showing broken
   images or an empty bar.

   Uses the shared, memoized APP_DATA.loadAppData() - on pages that
   already load the full data layer for their own content (Builds,
   Standings, etc.) this doesn't trigger a second round of fetches.
   ========================================================= */

(function () {
  "use strict";

  function splitDeck_(raw) {
    return String(raw || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function bladeThumbsHTML_(U, R, buildIds, buildsById, partsById) {
    var html = buildIds.map(function (id) {
      var slot = R.bladeSlotOf(buildsById[id]);
      var part = slot && partsById[slot.pid];
      if (!part || !part.imageUrl) return "";
      return '<img class="ticker-blade" src="' + U.esc(part.imageUrl) + '" alt="" loading="lazy" onerror="this.remove()">';
    }).join("");
    return html.indexOf("<img") === -1 ? "" : '<span class="ticker-blades">' + html + '</span>';
  }

  function buildTickerHTML_(data) {
    var U = window.APP_UTILS, R = window.APP_RENDER;
    if (!data.meta.matches.ok) return "";
    var completed = data.matches.filter(function (m) { return m.status === "COMPLETE"; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
      .slice(0, window.APP_CONFIG.TICKER_COUNT || 10);
    if (!completed.length) return "";

    var lookup = R.playerLookup(data.players);
    var buildsById = {}; (data.builds || []).forEach(function (b) { buildsById[b.buildId] = b; });
    var partsById = {}; (data.parts || []).forEach(function (p) { partsById[p.partId] = p; });

    var cards = completed.map(function (m) {
      var a = lookup(m.playerAId), b = lookup(m.playerBId);
      var aWon = m.winnerPlayerId === m.playerAId;
      var winnerDeckRaw = aWon ? m.deckABuildIds : m.deckBBuildIds;
      var blades = bladeThumbsHTML_(U, R, splitDeck_(winnerDeckRaw), buildsById, partsById);
      return '<a class="ticker-card" href="match.html?id=' + encodeURIComponent(m.matchId) + '">' +
        '<div class="ticker-matchup">' +
          R.playerLogoHTML(a) +
          '<span class="ticker-score' + (aWon ? " win" : "") + '">' + m.finalScoreA + '</span>' +
          '<span class="ticker-dash">–</span>' +
          '<span class="ticker-score' + (!aWon ? " win" : "") + '">' + m.finalScoreB + '</span>' +
          R.playerLogoHTML(b) +
        '</div>' +
        '<div class="ticker-names">' + U.esc(a.displayName) + ' <span class="ticker-vs">vs</span> ' + U.esc(b.displayName) + '</div>' +
        '<div class="ticker-meta"><span>' + U.esc(U.fmtDateShort(m.date)) + '</span>' + blades + '</div>' +
      '</a>';
    }).join("");

    return '<div class="ticker-track">' + cards + '</div>';
  }

  function mount_() {
    var header = document.querySelector("header.site-header");
    if (!header) return null;
    var wrap = document.createElement("div");
    wrap.className = "score-ticker-wrap";
    wrap.id = "score-ticker";
    wrap.style.display = "none"; // revealed only once there's real content
    header.insertAdjacentElement("afterend", wrap);
    return wrap;
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.APP_DATA || !window.APP_UTILS || !window.APP_RENDER) return;
    var el = mount_();
    if (!el) return;
    window.APP_DATA.loadAppData().then(function (data) {
      var html = buildTickerHTML_(data);
      if (!html) return; // leave hidden - no completed matches / feed error
      el.innerHTML = html;
      el.style.display = "";
    }).catch(function () { /* leave hidden on any feed failure */ });
  });
})();
