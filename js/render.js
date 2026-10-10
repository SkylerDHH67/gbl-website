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
  var FINISH_COLORS = { SPIN: "var(--arc)", OVER: "var(--gold)", BURST: "var(--spin)", XTREME: "var(--xtreme)" };
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

  // Net Rating (points_scored / points_against) is a ratio centered on 1.0
  // ("keeping its head above water"), so rather than a hard red/blue cutoff
  // right at 1.0 (which made anything at 0.99 look just as alarming as
  // 0.3), this blends smoothly between the site's red and blue accents.
  // Uses log2 so the scale is symmetric for a RATIO metric - a build at
  // 2.0 (scores double what it concedes) is exactly as far from 1.0 as a
  // build at 0.5 (concedes double what it scores), each pegged to a pure
  // end color; 1.0 itself lands on a neutral blend, not full red.
  var NET_RATING_LOW_RGB = [239, 62, 74];   // --spin (red) - net rating well under 1
  var NET_RATING_HIGH_RGB = [95, 216, 236]; // --arc (blue) - net rating well over 1
  function netRatingColor(netRating) {
    var n = Number(netRating);
    if (!isFinite(n) || n <= 0) n = 1;
    var t = Math.max(-1, Math.min(1, Math.log(n) / Math.LN2)); // log2, clamped to [0.5x, 2x]
    var frac = (t + 1) / 2; // 0 = pure red, 1 = pure blue
    var rgb = NET_RATING_LOW_RGB.map(function (lo, i) {
      return Math.round(lo + (NET_RATING_HIGH_RGB[i] - lo) * frac);
    });
    return "rgb(" + rgb.join(",") + ")";
  }

  // Picks the highest-count entry out of a { SPIN: n, OVER: n, ... } map,
  // e.g. for "most common way this build wins" / "most common way this
  // build loses" callouts. Returns null for an empty/all-zero map rather
  // than a misleading zero-count "winner".
  function topFinish(dist) {
    dist = dist || {};
    var best = null;
    FINISH_ORDER.forEach(function (k) {
      var n = dist[k] || 0;
      if (n > 0 && (!best || n > best.count)) best = { type: k, label: FINISH_LABELS[k], count: n };
    });
    return best;
  }

  // Determines the site's one current/active stage: whichever stage has
  // the most recent real match across ALL players (the strongest signal -
  // "where is actual play happening right now"), falling back to whichever
  // stage belongs to a season marked "active" in Settings/Config (highest
  // stage order) only when no matches exist anywhere yet. Shared so "is
  // this player's last stage the current one" means the same thing on
  // every page, rather than each page guessing its own definition of
  // "active" (a per-player most-recent-match check doesn't tell you
  // whether that stage itself is still ongoing league-wide).
  function pickCurrentStageId(data) {
    var lastDateByStage = {};
    (data.matches || []).forEach(function (m) {
      var t = new Date(m.date).getTime();
      if (!isNaN(t) && (!lastDateByStage[m.stageId] || t > lastDateByStage[m.stageId])) lastDateByStage[m.stageId] = t;
    });
    var stageIds = Object.keys(lastDateByStage);
    if (stageIds.length) {
      stageIds.sort(function (a, b) { return lastDateByStage[b] - lastDateByStage[a]; });
      return stageIds[0];
    }
    var activeStageIds = Object.keys(data.stages || {}).filter(function (id) {
      var st = data.stages[id];
      return st.seasonId && data.seasonStatus[st.seasonId] && String(data.seasonStatus[st.seasonId]).toLowerCase() === "active";
    });
    activeStageIds.sort(function (a, b) { return (data.stages[b].order || 0) - (data.stages[a].order || 0); });
    return activeStageIds[0] || null;
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

  // Ratchet parts are catalogued with spelled-out numbers (e.g. "One
  // Sixty") because that's how the live scorekeeper sidebar needs them
  // typed/read during a match, but the public site should show the actual
  // Beyblade X-style code ("1-60"). Only ever applied to the Ratchet slot,
  // and only when every word is a recognized number word - "No Ratchet"
  // (an integrated-ratchet build with no separate ratchet part) has a
  // non-number word in it and is deliberately left untouched.
  var NUMBER_WORDS = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
  };
  function formatRatchetName(name) {
    var raw = String(name == null ? "" : name).trim();
    if (!raw) return raw;
    var words = raw.split(/\s+/);
    if (words.length < 2) return raw;
    var nums = words.map(function (w) { return NUMBER_WORDS[w.toLowerCase()]; });
    if (nums.some(function (n) { return n === undefined; })) return raw; // not a pure number-word name - leave as-is
    return nums.join("-");
  }

  // Composes "Shatter Horus / 1-60 / Hexa" from a build's three slots in
  // slot order, formatting the Ratchet slot's name via formatRatchetName.
  // Returns null if the build itself isn't resolvable (older/test build
  // not in the Builds feed) so callers can fall back to the bare
  // build_id - though build_id itself should never reach page text; see
  // buildLabelOrFallback below for the safe version of that fallback.
  function fullBuildLabel(build, partsById) {
    if (!build) return null;
    var slots = [
      { pid: build.slot1PartId, role: build.slot1Role },
      { pid: build.slot2PartId, role: build.slot2Role },
      { pid: build.slot3PartId, role: build.slot3Role }
    ].filter(function (s) { return s.pid; });
    if (!slots.length) return null;
    return slots.map(function (s) {
      var p = partsById[s.pid];
      var label = (p && p.displayName) || s.pid;
      return String(s.role || "").toLowerCase() === "ratchet" ? formatRatchetName(label) : label;
    }).join(" / ");
  }

  // The one sanctioned fallback when a build can't be resolved to a real
  // label (test data, a build removed from the Builds feed, etc.) - shows
  // "Unlisted Build" instead of ever printing a raw build_id/part_id, which
  // are internal tracking keys and should never appear on the public site.
  function buildLabelOrFallback(build, partsById, buildId) {
    return fullBuildLabel(build, partsById) || "Unlisted Build";
  }

  window.APP_RENDER = {
    loadingBlock: loadingBlock, errorBlock: errorBlock, emptyBlock: emptyBlock,
    playerLookup: playerLookup, playerLookupByName: playerLookupByName,
    playerCellHTML: playerCellHTML, playerCellWithLogoHTML: playerCellWithLogoHTML,
    playerLogoHTML: playerLogoHTML, resultBadge: resultBadge,
    statusBadge: statusBadge, buildLabel: buildLabel,
    FINISH_LABELS: FINISH_LABELS, FINISH_COLORS: FINISH_COLORS, FINISH_ORDER: FINISH_ORDER,
    finishBarHTML: finishBarHTML, topFinish: topFinish, netRatingColor: netRatingColor, bladeSlotOf: bladeSlotOf, fullBuildLabel: fullBuildLabel,
    formatRatchetName: formatRatchetName, buildLabelOrFallback: buildLabelOrFallback,
    pickCurrentStageId: pickCurrentStageId
  };
})();
