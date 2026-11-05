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

  // Trend methodology (whole season): a heat-mapped sparkline of rolling win
  // rate - the line's COLOR is read directly off the win percentage at each
  // point as it moves through the season, not off a separate "trending up/
  // down" calculation. A hot streak glows turquoise, a cold one glows red,
  // and you can watch the color itself shift battle to battle - that's the
  // heatmap the sheet owner asked for, in place of the earlier half-season-
  // swing-based single color.
  //
  // Color bands (by rolling win rate):
  //   < 42%        solid red       - below break-even by a real margin
  //   42% – 57%    yellow -> green - the "around even" zone, trending green
  //                                  as it climbs toward a real winning edge
  //   57% – 74%    solid green     - a genuinely strong win rate
  //   74% – 100%   green -> teal   - elite, saturating into neon turquoise
  // Between the named bands the color is linearly interpolated, so the line
  // reads as a true continuous heatmap rather than hard color jumps.
  //
  // The minimum sample before a trend line shows at all is passed in per
  // call site rather than fixed here, because "enough history to trust a
  // trend" means something different on different pages: a player's
  // standings row (every match they've ever played) reaches a meaningful
  // sample sooner than a single build's usage count, so standings/home use
  // a lower bar (7) while the Builds page keeps the stricter one (10) it
  // already uses for Volatility, so a build's Trend and Volatility columns
  // agree on what counts as "enough data."
  var TREND_MIN_TOTAL_SAMPLE_DEFAULT = 10;
  var TREND_ROLLING_WINDOW = 5;     // visual smoothing only (see rollingSeries_)
  var TREND_SPARKLINE_MAX_POINTS = 24;

  // Color stops the heatmap interpolates between. Below the first stop's
  // percentage, the color is flat (no further reddening toward 0%) - "below
  // 42%" is just "red," not a gradient down to some darker red.
  var TREND_COLOR_STOPS = [
    { pct: 0.00, rgb: [239, 62, 74] },   // red (var(--spin)) - flat through 42%
    { pct: 0.42, rgb: [239, 62, 74] },
    { pct: 0.42, rgb: [255, 197, 61] },  // yellow (var(--gold)) - hard step into the 42-57 band
    { pct: 0.57, rgb: [57, 255, 106] },  // green (var(--xtreme))
    { pct: 0.74, rgb: [57, 255, 106] },  // still green - flat "really green" plateau 57-74
    { pct: 1.00, rgb: [38, 232, 220] }   // neon turquoise - saturates as it approaches 100%
  ];

  function lerp_(a, b, t) { return a + (b - a) * t; }

  // Linearly interpolates a win-rate (0-1) to an "rgb(r,g,b)" string across
  // TREND_COLOR_STOPS. Duplicate pct entries (e.g. the 0.42/0.42 pair above)
  // create an intentional hard step rather than a gradient at that point.
  function winPctColor_(pct) {
    pct = Math.max(0, Math.min(1, pct));
    var stops = TREND_COLOR_STOPS;
    for (var i = 0; i < stops.length - 1; i++) {
      var a = stops[i], b = stops[i + 1];
      if (pct >= a.pct && pct <= b.pct) {
        var span = b.pct - a.pct;
        var t = span > 0 ? (pct - a.pct) / span : 1;
        var r = Math.round(lerp_(a.rgb[0], b.rgb[0], t));
        var g = Math.round(lerp_(a.rgb[1], b.rgb[1], t));
        var bch = Math.round(lerp_(a.rgb[2], b.rgb[2], t));
        return "rgb(" + r + "," + g + "," + bch + ")";
      }
    }
    var last = stops[stops.length - 1].rgb;
    return "rgb(" + last[0] + "," + last[1] + "," + last[2] + ")";
  }

  function winPct_(str) {
    if (!str.length) return 0;
    var w = 0;
    for (var i = 0; i < str.length; i++) if (str[i] === "W") w++;
    return w / str.length;
  }

  // fullSequence: chronological "WWLWL..." string (oldest first) across the
  // entity's ENTIRE known history this season - builds.js already tracks
  // this per build; standings/home build the player equivalent from
  // data.matches (see APP_RENDER.playerSequences). minSample: how many
  // total games/battles are required before a trend read is shown at all;
  // defaults to TREND_MIN_TOTAL_SAMPLE_DEFAULT when omitted.
  function trendInfo(fullSequence, minSample) {
    var s = String(fullSequence || "").replace(/[^WL]/gi, "").toUpperCase();
    var n = s.length;
    var threshold = (minSample === undefined || minSample === null) ? TREND_MIN_TOTAL_SAMPLE_DEFAULT : minSample;
    if (n < threshold) return null;

    var overallPct = winPct_(s);
    var ys = [];
    for (var i = 0; i < n; i++) ys.push(s[i] === "W" ? 1 : 0);

    var recentWindow = Math.min(TREND_ROLLING_WINDOW, n);
    var recentSum = 0;
    for (var j = n - recentWindow; j < n; j++) recentSum += ys[j];
    var recentPct = recentSum / recentWindow;

    return { series: ys, overallPct: overallPct, recentPct: recentPct, n: n };
  }

  // Trailing rolling average (window TREND_ROLLING_WINDOW, shrinking at the
  // very start so the line is defined from game 1) - this is what actually
  // gets drawn AND what drives each segment's heatmap color. A plain
  // cumulative average flattens out and stops moving the more games are
  // added, which looks dead for a long season even when recent form has
  // genuinely shifted; a short rolling window keeps the line (and its
  // color) visually alive across the whole season.
  function rollingSeries_(ys, window) {
    var out = [];
    for (var i = 0; i < ys.length; i++) {
      var start = Math.max(0, i - window + 1);
      var sum = 0, count = 0;
      for (var j = start; j <= i; j++) { sum += ys[j]; count++; }
      out.push(sum / count);
    }
    return out;
  }

  // Evenly samples down to at most maxPoints (always keeping the first and
  // last), so a long season still renders as a legible line instead of an
  // illegibly dense squiggle in a small table cell.
  function decimate_(arr, maxPoints) {
    if (arr.length <= maxPoints) return arr;
    var out = [];
    for (var i = 0; i < maxPoints; i++) {
      out.push(arr[Math.round((i / (maxPoints - 1)) * (arr.length - 1))]);
    }
    return out;
  }

  // Tiny inline sparkline of the whole season's rolling win rate, drawn as a
  // series of short segments rather than one polyline so EACH segment can be
  // colored by the rolling win rate at that point in the season - a real
  // heatmap trend line, not a single color for the whole thing. A segment's
  // color comes from the average of its two endpoint values so the color
  // transition lines up visually with the line's own slope.
  function sparklineSVG_(points) {
    var n = points.length;
    if (n < 2) return "";
    var w = 56, h = 16, pad = 2;
    var coords = points.map(function (v, i) {
      var x = pad + (i / (n - 1)) * (w - pad * 2);
      var y = h - pad - v * (h - pad * 2);
      return { x: x, y: y };
    });
    var segments = "";
    for (var i = 0; i < coords.length - 1; i++) {
      var segPct = (points[i] + points[i + 1]) / 2;
      var color = winPctColor_(segPct);
      segments += '<line x1="' + coords[i].x.toFixed(1) + '" y1="' + coords[i].y.toFixed(1) +
        '" x2="' + coords[i + 1].x.toFixed(1) + '" y2="' + coords[i + 1].y.toFixed(1) +
        '" stroke="' + color + '" stroke-width="1.6" stroke-linecap="round"/>';
    }
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="display:block;overflow:visible;">' +
      segments + '</svg>';
  }

  function trendBadgeHTML(fullSequence, minSample) {
    var t = trendInfo(fullSequence, minSample);
    if (!t) return '<span style="color:var(--text-faint);">—</span>';
    var rolling = decimate_(rollingSeries_(t.series, TREND_ROLLING_WINDOW), TREND_SPARKLINE_MAX_POINTS);
    var title = Math.round(t.recentPct * 100) + "% last " + Math.min(TREND_ROLLING_WINDOW, t.n) +
      " · " + Math.round(t.overallPct * 100) + "% season · " + t.n + " battles";
    return '<span title="' + U.esc(title) + '">' + sparklineSVG_(rolling) + '</span>';
  }

  // Builds a map of playerId -> full chronological "WWLWL..." match history
  // (oldest first, every COMPLETE match regardless of stage/season) for the
  // Trend sparkline - the standings feed only carries a precomputed last-10
  // string, which isn't enough history to compare against an all-time rate.
  function playerSequences(data) {
    var map = {};
    (data.matches || [])
      .filter(function (m) { return m.status === "COMPLETE" && m.winnerPlayerId; })
      .slice()
      .sort(function (a, b) {
        var at = a.date ? new Date(a.date).getTime() : 0, bt = b.date ? new Date(b.date).getTime() : 0;
        if (at !== bt) return at - bt;
        return String(a.matchId).localeCompare(String(b.matchId));
      })
      .forEach(function (m) {
        if (m.playerAId) (map[m.playerAId] = map[m.playerAId] || []).push(m.winnerPlayerId === m.playerAId ? "W" : "L");
        if (m.playerBId) (map[m.playerBId] = map[m.playerBId] || []).push(m.winnerPlayerId === m.playerBId ? "W" : "L");
      });
    Object.keys(map).forEach(function (id) { map[id] = map[id].join(""); });
    return map;
  }

  // GBL Rating is stored and ranked on its native 0-1 Wilson lower-bound
  // scale (see RatingEngine.gs) - that's what the Sheet, CSV feed, and sort
  // logic all use, and changing that scale would mean touching the rating
  // engine itself. For DISPLAY only, a flat x10 multiplier turns "0.481"
  // into "4.81," which reads more like a familiar "rating out of 10" than
  // a raw probability - purely cosmetic, every page should go through this
  // one function so the display scale can never drift between pages.
  function gblRatingDisplay(rating) {
    return (Number(rating) * 10).toFixed(2);
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
    pickCurrentStageId: pickCurrentStageId, trendInfo: trendInfo, trendBadgeHTML: trendBadgeHTML,
    playerSequences: playerSequences, gblRatingDisplay: gblRatingDisplay
  };
})();
