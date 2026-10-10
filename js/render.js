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

  // Small inline badge <img> for a player, or "" if there's no badge to
  // show (no match / no logo URL) - callers can just concatenate this in,
  // no need to branch on it. Badge, not wordmark: this is for dense rows
  // (standings, matchup lists) where a wide wordmark wouldn't fit well.
  function playerLogoHTML(player) {
    if (!player || !player.badgeLogoUrl) return "";
    return '<img class="player-logo" src="' + U.esc(player.badgeLogoUrl) + '" alt="" loading="lazy" onerror="this.remove()">';
  }

  // Player cell with a small badge logo to the left of the name (falls
  // back to just the name + flag if there's no logo).
  function playerCellWithLogoHTML(player) {
    if (!player) return "—";
    var flag = player.flagEmoji ? '<span class="flag">' + U.esc(player.flagEmoji) + "</span>" : "";
    return '<a class="player-cell player-cell-logo" href="player.html?id=' + encodeURIComponent(player.playerId) + '">' +
      playerLogoHTML(player) + flag + U.esc(player.displayName) + "</a>";
  }

  // Matches free-text names (e.g. from the manual Upcoming Matches tab)
  // against the real Players list, case/whitespace-insensitive. Used
  // where there's no player_id to look up by. Returns undefined if no
  // confident match is found - callers should degrade gracefully (no
  // logo, plain text name) rather than guess.
  function playerLookupByName(players) {
    var byName = {};
    (players || []).forEach(function (p) {
      var key = String(p.displayName || "").trim().toLowerCase();
      if (key) byName[key] = p;
    });
    return function (name) { return byName[String(name || "").trim().toLowerCase()]; };
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

  // Shared finish-type display labeling. Battle Event Log / Stats Lab
  // Source store finish_type as the engine's uppercase key (SPIN/OVER/
  // BURST/XTREME) - this is purely presentation, not a new data source.
  // Reused by both the Builds page (per-build detail) and Stats Lab
  // (filtered finish distribution) so the two never drift apart.
  var FINISH_LABELS = { SPIN: "Spin", OVER: "Over", BURST: "Burst", XTREME: "Xtreme" };
  var FINISH_COLORS = { SPIN: "var(--arc)", OVER: "var(--gold)", BURST: "var(--spin)", XTREME: "var(--arc-bright)" };
  var FINISH_ORDER = ["SPIN", "OVER", "BURST", "XTREME"];

  // Renders a flow-bar-style stacked horizontal bar from a { SPIN: n,
  // OVER: n, ... } count map, plus a legend with counts and percentages.
  function finishBarHTML(dist) {
    dist = dist || {};
    var total = FINISH_ORDER.reduce(function (sum, k) { return sum + (dist[k] || 0); }, 0);
    if (!total) return '<div class="state-block" style="padding:14px;"><span class="title">No finish data for this filter</span></div>';
    var segments = FINISH_ORDER.filter(function (k) { return dist[k] > 0; }).map(function (k) {
      var pct = (dist[k] / total) * 100;
      return '<span style="width:' + pct.toFixed(1) + '%;background:' + FINISH_COLORS[k] + ';display:block;height:100%;"></span>';
    }).join("");
    var legend = FINISH_ORDER.filter(function (k) { return dist[k] > 0; }).map(function (k) {
      var pct = Math.round((dist[k] / total) * 100);
      return '<span class="badge" style="border-color:' + FINISH_COLORS[k] + '33;">' +
        '<span class="dot" style="background:' + FINISH_COLORS[k] + '"></span>' + FINISH_LABELS[k] + ' ' + dist[k] + ' (' + pct + '%)</span>';
    }).join(" ");
    return '<div class="flow-bar" style="height:14px;margin-bottom:10px;">' + segments + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + legend + '</div>';
  }

  // Which of a build's three slots is the Blade - identified by role, not
  // position (shared by Builds page and Stats Lab).
  function bladeSlotOf(build) {
    if (!build) return null;
    var slots = [
      { pid: build.slot1PartId, role: build.slot1Role },
      { pid: build.slot2PartId, role: build.slot2Role },
      { pid: build.slot3PartId, role: build.slot3Role }
    ];
    return slots.filter(function (s) { return String(s.role || "").toLowerCase() === "blade" && s.pid; })[0] || null;
  }

  // Composes "Shatter Horus / 1-60 / Hexa" from a build's three slots in
  // slot order. Returns null if the build itself isn't resolvable (older/
  // test build not in the Builds feed) so callers can fall back to the
  // bare build_id.
  function fullBuildLabel(build, partsById) {
    if (!build) return null;
    var slots = [build.slot1PartId, build.slot2PartId, build.slot3PartId].filter(Boolean);
    if (!slots.length) return null;
    return slots.map(function (pid) {
      var p = partsById[pid];
      return (p && p.displayName) || pid;
    }).join(" / ");
  }

  window.APP_RENDER = {
    loadingBlock: loadingBlock, errorBlock: errorBlock, emptyBlock: emptyBlock,
    playerLookup: playerLookup, playerLookupByName: playerLookupByName,
    playerCellHTML: playerCellHTML, playerCellWithLogoHTML: playerCellWithLogoHTML,
    playerLogoHTML: playerLogoHTML, resultBadge: resultBadge,
    statusBadge: statusBadge, buildLabel: buildLabel,
    FINISH_LABELS: FINISH_LABELS, FINISH_COLORS: FINISH_COLORS, FINISH_ORDER: FINISH_ORDER,
    finishBarHTML: finishBarHTML, bladeSlotOf: bladeSlotOf, fullBuildLabel: fullBuildLabel
  };
})();
