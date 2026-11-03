/* =========================================================
   GLOBAL BLADE LEAGUE
   ticker.js — NBA.com-style "recent results" strip, injected
   into the header on EVERY page (same self-injecting pattern as
   header-meta.js, so no page's body markup has to be hand-edited
   to add a container - only the <script> tag).

   Shows every completed match from the single most recent "session"
   (calendar day with completed matches) - not a fixed count. Once a
   newer session happens, the whole strip switches over to that
   session's matches and the previous session's results fall off,
   with everything older than the current session living on the
   Schedule page instead. Newest match first (left), oldest match of
   that same session last (right) - true chronological order from
   the match's own timestamp, not just feed row order.

   Uses the shared, memoized APP_DATA.loadAppData() - on pages that
   already load the full data layer for their own content (Builds,
   Standings, etc.) this doesn't trigger a second round of fetches.
   ========================================================= */

(function () {
  "use strict";

  // Local-calendar-day key (not a UTC day) - two matches logged late
  // evening vs just after midnight on what a human would call "the same
  // night" should still count as different sessions if they're genuinely
  // different calendar days; this only collapses matches that share an
  // actual local date.
  function dayKey_(dateVal) {
    var d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;
    return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
  }

  function buildTickerHTML_(data) {
    var U = window.APP_UTILS, R = window.APP_RENDER;
    if (!data.meta.matches.ok) return "";
    var completed = data.matches.filter(function (m) { return m.status === "COMPLETE" && m.date; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); }); // newest first
    if (!completed.length) return "";

    var currentSessionKey = dayKey_(completed[0].date);
    var session = completed.filter(function (m) { return dayKey_(m.date) === currentSessionKey; });
    // Sanity cap only - a session is normally a handful of matches from one
    // day of play, not a count the UI is designed around.
    session = session.slice(0, 40);

    var lookup = R.playerLookup(data.players);

    var cards = session.map(function (m) {
      var a = lookup(m.playerAId), b = lookup(m.playerBId);
      var aWon = m.winnerPlayerId === m.playerAId;
      return '<a class="ticker-card" href="match.html?id=' + encodeURIComponent(m.matchId) + '">' +
        '<div class="ticker-matchup">' +
          R.playerLogoHTML(a) +
          '<span class="ticker-score' + (aWon ? " win" : "") + '">' + m.finalScoreA + '</span>' +
          '<span class="ticker-dash">–</span>' +
          '<span class="ticker-score' + (!aWon ? " win" : "") + '">' + m.finalScoreB + '</span>' +
          R.playerLogoHTML(b) +
        '</div>' +
        '<div class="ticker-names">' + U.esc(a.displayName) + ' <span class="ticker-vs">vs</span> ' + U.esc(b.displayName) + '</div>' +
        '<div class="ticker-meta"><span>' + U.esc(U.fmtDateShort(m.date)) + '</span></div>' +
      '</a>';
    }).join("");

    return '<button class="ticker-arrow ticker-arrow-left" type="button" aria-label="Scroll to newer matches">‹</button>' +
      '<div class="ticker-track">' + cards + '</div>' +
      '<button class="ticker-arrow ticker-arrow-right" type="button" aria-label="Scroll to older matches">›</button>';
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

  // Arrow buttons just nudge the native scroll container - no custom
  // scroll-physics reimplementation, so trackpad/touch scrolling and the
  // buttons never fight each other.
  function wireArrows_(el) {
    var track = el.querySelector(".ticker-track");
    if (!track) return;
    var left = el.querySelector(".ticker-arrow-left");
    var right = el.querySelector(".ticker-arrow-right");
    if (left) left.addEventListener("click", function () { track.scrollBy({ left: -240, behavior: "smooth" }); });
    if (right) right.addEventListener("click", function () { track.scrollBy({ left: 240, behavior: "smooth" }); });
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
      wireArrows_(el);
    }).catch(function () { /* leave hidden on any feed failure */ });
  });
})();
