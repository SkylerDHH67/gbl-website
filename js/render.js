/* =========================================================
   GLOBAL BLADE LEAGUE
   render.js — shared, reusable rendering helpers used across
   every page: loading/error/empty state blocks, player lookup,
   badges, and small formatting bits that touch the DOM or build
   HTML strings. Page-specific layout logic lives in each page's
   own <page>.js file, which calls into these.
   ========================================================= */

(function () {
  "use strict";
  var U = window.APP_UTILS;

  function loadingBlock(rows) {
    rows = rows || 5;
    var html = "";
    for (var i = 0; i < rows; i++) html += '<div class="skeleton skeleton-row"></div>';
    return html;
  }

  function errorBlock(code, feedName) {
    var msg = "Something went wrong loading this data.";
    if (code === "MISSING_FEED_URL") {
      msg = "This feed hasn't been connected yet. Open js/config.js and add the published-CSV URL for <strong>" + U.esc(feedName || "this feed") + "</strong> (see the setup instructions at the top of that file).";
    } else if (code === "FEED_NOT_PUBLIC") {
      msg = "Couldn't read this data - the Google Sheet tab for <strong>" + U.esc(feedName || "this feed") + "</strong> may not be published to the web, or the published link changed. Re-publish that tab (File → Share → Publish to web) and update js/config.js.";
    }
    return '<div class="state-block"><div class="icon">⚠️</div><div class="title">Couldn\'t load this section</div><div>' + msg + "</div></div>";
  }

  function emptyBlock(title, sub) {
    return '<div class="state-block"><div class="icon">◌</div><div class="title">' + U.esc(title) + "</div>" + (sub ? "<div>" + U.esc(sub) + "</div>" : "") + "</div>";
  }

  function playerLookup(players) {
    var byId = {};
    (players || []).forEach(function (p) { byId[p.playerId] = p; });
    return function (playerId) { return byId[playerId] || { playerId: playerId, displayName: playerId, flagEmoji: "", slug: U.slugify(playerId || "") }; };
  }

  function playerCellHTML(player) {
    if (!player) return "—";
    var flag = player.flagEmoji ? '<span class="flag">' + U.esc(player.flagEmoji) + "</span>" : "";
    return '<a class="player-cell" href="player.html?id=' + encodeURIComponent(player.playerId) + '">' + flag + U.esc(player.displayName) + "</a>";
  }

  function resultBadge(wonByA, aOrB) {
    var won = aOrB === "A" ? wonByA : !wonByA;
    return '<span class="badge ' + (won ? "win" : "loss") + '">' + (won ? "W" : "L") + "</span>";
  }

  function statusBadge(status) {
    var s = String(status || "").toUpperCase();
    if (s === "LIVE" || s === "AWAITING_RESHUFFLE") return '<span class="badge live"><span class="dot"></span>LIVE</span>';
    if (s === "COMPLETE") return '<span class="badge">FINAL</span>';
    if (s === "SCHEDULED") return '<span class="badge">SCHEDULED</span>';
    if (s === "ABANDONED") return '<span class="badge loss">ABANDONED</span>';
    return '<span class="badge">' + U.esc(s || "—") + "</span>";
  }

  function buildLabel(part) {
    if (!part) return "Unknown part";
    return part.displayName + (part.system ? " (" + part.system + ")" : "");
  }

  window.APP_RENDER = {
    loadingBlock: loadingBlock, errorBlock: errorBlock, emptyBlock: emptyBlock,
    playerLookup: playerLookup, playerCellHTML: playerCellHTML, resultBadge: resultBadge,
    statusBadge: statusBadge, buildLabel: buildLabel
  };
})();
