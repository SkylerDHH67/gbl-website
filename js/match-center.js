/* =========================================================
   GLOBAL BLADE LEAGUE — Match Center
   Reconstructs a single completed match from feed_matches +
   feed_battle_log + feed_reshuffle_log, exactly the way the
   Sheet's own replay logic does: non-voided events only, ordered
   by the global monotonic `seq` column (not timestamp - same fix
   Phase 3 made for the live scorekeeper, reused here so the
   public site can never show a same-millisecond-scrambled log).

   KNOWN LIMITATION (documented rather than hidden): a player's full
   3-build deck is reconstructed from whichever builds actually
   appeared in the battle/reshuffle logs for this match. If a match
   ended very early (e.g. completed during rotation 1 before a 3rd
   build was ever reached, with no reshuffle to reveal it), that
   unused 3rd build won't be knowable from the feeds as they exist
   today. This only affects the "Builds" tab's completeness for a
   small number of very short matches, never the score/log/stats,
   which come from what was actually played. See handoff notes for
   the schema change (storing deck_a/b_build_ids on Match Database)
   that would close this gap properly.
   ========================================================= */

(function () {
  "use strict";
  var U = window.APP_UTILS, R = window.APP_RENDER;

  function getMatchId() { return new URLSearchParams(window.location.search).get("id"); }

  function buildTimeline(matchId, data) {
    var battles = data.battleLog.filter(function (e) { return e.matchId === matchId && !e.isVoided; });
    var reshuffles = data.reshuffleLog.filter(function (e) { return e.matchId === matchId && !e.isVoided; });
    var timeline = battles.map(function (e) { return Object.assign({ kind: "battle" }, e); })
      .concat(reshuffles.map(function (e) { return Object.assign({ kind: "reshuffle" }, e); }));
    timeline.sort(function (a, b) { return a.seq - b.seq; });
    return timeline;
  }

  function computeDecksAndBoxScore(matchId, match, timeline) {
    var deckA = {}, deckB = {}; // buildId -> true, in first-seen order
    var box = {}; // buildId -> stats
    function ensureBox(buildId, side) {
      if (!box[buildId]) box[buildId] = { buildId: buildId, side: side, battles: 0, wins: 0, losses: 0, pointsWon: 0, pointsAllowed: 0, finishCounts: {} };
      return box[buildId];
    }
    timeline.filter(function (e) { return e.kind === "battle" && !e.isRedo; }).forEach(function (e) {
      deckA[e.buildIdA] = true; deckB[e.buildIdB] = true;
      var ba = ensureBox(e.buildIdA, "A"), bb = ensureBox(e.buildIdB, "B");
      ba.battles++; bb.battles++;
      var aWon = e.winnerPlayerId === match.playerAId;
      if (aWon) { ba.wins++; bb.losses++; ba.pointsWon += e.pointsAwarded; bb.pointsAllowed += e.pointsAwarded; ba.finishCounts[e.finishType] = (ba.finishCounts[e.finishType] || 0) + 1; }
      else { bb.wins++; ba.losses++; bb.pointsWon += e.pointsAwarded; ba.pointsAllowed += e.pointsAwarded; bb.finishCounts[e.finishType] = (bb.finishCounts[e.finishType] || 0) + 1; }
    });
    timeline.filter(function (e) { return e.kind === "reshuffle"; }).forEach(function (e) {
      e.playerANewOrder.forEach(function (b) { deckA[b] = true; });
      e.playerBNewOrder.forEach(function (b) { deckB[b] = true; });
    });
    return { deckA: Object.keys(deckA), deckB: Object.keys(deckB), box: box };
  }

  function partThumb(part) {
    if (part && part.imageUrl) return '<img class="thumb" src="' + U.esc(part.imageUrl) + '" alt="" onerror="this.outerHTML=\'<div class=&quot;thumb&quot;></div>\'">';
    return '<div class="thumb"></div>';
  }

  // Resolves a build_id to its Blade part (for the deck card thumbnail)
  // using the same role-based lookup the Builds page uses.
  function bladePartOf(buildId, buildsById, partsById) {
    var slot = R.bladeSlotOf(buildsById[buildId]);
    return slot ? partsById[slot.pid] : null;
  }

  // Internal tracking keys (build_id, the engine's uppercase finish_type)
  // should never reach page text - these two helpers are the only place
  // Match Center converts either one for display.
  function buildLabel(buildId, buildsById, partsById) {
    return R.buildLabelOrFallback(buildsById[buildId], partsById, buildId);
  }
  function finishLabel(finishType) {
    return R.FINISH_LABELS[finishType] || finishType || "—";
  }

  // Module-level handoff from scoreLineSVG to wireScoreLineTooltips: keyed
  // "A0"/"B0"/"A1"/"B1"/... (side + point index), since the HTML string
  // scoreLineSVG returns has nowhere else to carry rich tooltip content
  // out to the code that wires up hover/tap behavior after insertion.
  var scoreLineTooltipData = null;

  // Picks a readable gridline step for the Y (score) axis. Match scores are
  // small (first-to-7, first-to-10, rarely higher), so every integer is
  // normally fine; this only widens the step if a target score is ever
  // configured unusually high, to avoid a wall of overlapping labels.
  function niceAxisStep(maxValue) {
    if (maxValue <= 12) return 1;
    return Math.ceil(maxValue / 10);
  }

  // A lightweight inline SVG line chart of cumulative score after every
  // real battle (battle 0 = 0-0) - no charting library dependency, just
  // two polylines plotted against the match's target score. This is the
  // "how did the score actually move" view; the flow-bar elsewhere stays
  // the "who won each individual battle, sized by points" view - the two
  // are complementary, not duplicates. Both axes carry a real numeric
  // scale (battle number along X, score along Y) so the shape of the line
  // is actually readable, not just decorative, and every point is a
  // hoverable/tappable hit target that pops up what happened there.
  function scoreLineSVG(realBattles, match, lookup, buildsById, partsById) {
    var a = lookup(match.playerAId), b = lookup(match.playerBId);
    var n = realBattles.length;
    var maxScore = match.targetScore;
    realBattles.forEach(function (e) { maxScore = Math.max(maxScore, e.scoreAAfter, e.scoreBAfter); });
    var W = 660, H = 260, padL = 42, padR = 16, padT = 18, padB = 46;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    function x(i) { return padL + (n === 0 ? 0 : (i / n) * plotW); }
    function y(v) { return padT + plotH - (v / maxScore) * plotH; }
    var ptsA = [[0, 0]], ptsB = [[0, 0]];
    var tooltips = {};
    var startEntry = { title: "Match Start", lines: ["0–0"] };
    tooltips.A0 = startEntry; tooltips.B0 = startEntry;
    realBattles.forEach(function (e, i) {
      var idx = i + 1;
      ptsA.push([idx, e.scoreAAfter]); ptsB.push([idx, e.scoreBAfter]);
      var entry = {
        title: "Battle " + idx,
        lines: [battleSentenceHTML(e, match, lookup, buildsById, partsById), '<strong>' + e.scoreAAfter + '–' + e.scoreBAfter + '</strong>']
      };
      tooltips["A" + idx] = entry; tooltips["B" + idx] = entry;
    });
    scoreLineTooltipData = tooltips;
    function toPath(pts) {
      return pts.map(function (p, idx) { return (idx === 0 ? "M" : "L") + x(p[0]).toFixed(1) + "," + y(p[1]).toFixed(1); }).join(" ");
    }
    // Each dot carries a <title> (native hover/focus tooltip - works even
    // if the JS wiring below fails to attach for any reason) plus a
    // data-key the JS tooltip reads from scoreLineTooltipData, and a
    // transparent oversized hit-circle so it's easy to trigger on both
    // desktop hover and mobile tap, not just the tiny 3.5px dot.
    function toDots(pts, color, side, plainTitles) {
      return pts.map(function (p, idx) {
        var key = side + p[0];
        var title = '<title>' + U.esc(plainTitles[idx]) + '</title>';
        var cx = x(p[0]).toFixed(1), cy = y(p[1]).toFixed(1);
        return '<circle class="score-dot-hit" data-key="' + key + '" tabindex="0" cx="' + cx + '" cy="' + cy + '" r="11" fill="transparent" style="cursor:pointer;">' + title + '</circle>' +
          '<circle cx="' + cx + '" cy="' + cy + '" r="3.5" fill="' + color + '" style="pointer-events:none;"></circle>';
      }).join("");
    }
    var plainA = ["Match start — 0–0"], plainB = ["Match start — 0–0"];
    realBattles.forEach(function (e, i) {
      var t = "Battle " + (i + 1) + ": " + battleSentenceText(e, match, lookup, buildsById, partsById) + " (" + e.scoreAAfter + "–" + e.scoreBAfter + ")";
      plainA.push(t); plainB.push(t);
    });
    var targetY = y(match.targetScore).toFixed(1);

    // Y-axis (score) gridlines + numeric labels, 0 up through maxScore.
    var yStep = niceAxisStep(maxScore);
    var yTicks = [];
    for (var v = 0; v <= maxScore; v += yStep) yTicks.push(v);
    if (yTicks[yTicks.length - 1] !== maxScore) yTicks.push(maxScore);
    var yGrid = yTicks.map(function (v) {
      var ty = y(v).toFixed(1);
      return '<line x1="' + padL + '" y1="' + ty + '" x2="' + (W - padR) + '" y2="' + ty + '" stroke="var(--line)" stroke-opacity="0.35"/>' +
        '<text x="' + (padL - 8) + '" y="' + (parseFloat(ty) + 3).toFixed(1) + '" text-anchor="end" font-size="10" fill="var(--text-faint)">' + v + '</text>';
    }).join("");

    // X-axis (battle number) tick marks + labels, one per real battle plus
    // the "Start" point at 0 - not just the two end labels as before, so
    // every point on the line can be read off the axis, not just guessed at.
    var xTicks = [];
    for (var i = 0; i <= n; i++) xTicks.push(i);
    var xAxisY = H - padB;
    var xGrid = xTicks.map(function (i) {
      var tx = x(i).toFixed(1);
      var label = i === 0 ? "Start" : String(i);
      return '<line x1="' + tx + '" y1="' + xAxisY + '" x2="' + tx + '" y2="' + (xAxisY + 4) + '" stroke="var(--line)"/>' +
        '<text x="' + tx + '" y="' + (xAxisY + 16) + '" text-anchor="middle" font-size="10" fill="var(--text-faint)">' + label + '</text>';
    }).join("");

    return '<div class="score-line-wrap" style="position:relative;">' +
      '<div style="display:flex;gap:16px;align-items:center;margin-bottom:8px;font-size:0.82rem;color:var(--text-dim);">' +
      '<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--arc);margin-right:5px;"></span>' + U.esc(a.displayName) + '</span>' +
      '<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--spin);margin-right:5px;"></span>' + U.esc(b.displayName) + '</span>' +
      '</div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;">' +
      yGrid +
      '<line x1="' + padL + '" y1="' + targetY + '" x2="' + (W - padR) + '" y2="' + targetY + '" stroke="var(--gold)" stroke-dasharray="4 4"/>' +
      '<text x="' + (W - padR) + '" y="' + (parseFloat(targetY) - 6).toFixed(1) + '" text-anchor="end" font-size="10" fill="var(--gold)">Target ' + match.targetScore + '</text>' +
      '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + xAxisY + '" stroke="var(--line)"/>' +
      '<line x1="' + padL + '" y1="' + xAxisY + '" x2="' + (W - padR) + '" y2="' + xAxisY + '" stroke="var(--line)"/>' +
      xGrid +
      '<text x="' + ((padL + (W - padR)) / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" fill="var(--text-faint)" letter-spacing="0.04em">BATTLE #</text>' +
      '<text x="12" y="' + ((padT + xAxisY) / 2).toFixed(1) + '" text-anchor="middle" font-size="10" fill="var(--text-faint)" letter-spacing="0.04em" transform="rotate(-90 12 ' + ((padT + xAxisY) / 2).toFixed(1) + ')">SCORE</text>' +
      '<path d="' + toPath(ptsA) + '" fill="none" stroke="var(--arc)" stroke-width="2.5"/>' +
      '<path d="' + toPath(ptsB) + '" fill="none" stroke="var(--spin)" stroke-width="2.5"/>' +
      toDots(ptsA, "var(--arc)", "A", plainA) + toDots(ptsB, "var(--spin)", "B", plainB) +
      '</svg>' +
      '</div>';
  }

  // Wires the hover/tap popup for the score-line chart's dots. Pure
  // progressive enhancement: every dot already carries a native <title>
  // tooltip baked into the SVG above, so if this never runs (or the
  // browser doesn't fire these events for some reason) the chart is still
  // fully informative, just via the browser's own tooltip instead of this
  // styled one.
  function wireScoreLineTooltips(container) {
    if (!scoreLineTooltipData) return;
    var wrap = container.querySelector(".score-line-wrap");
    if (!wrap) return;
    var tip = document.createElement("div");
    tip.className = "score-line-tip";
    tip.style.cssText = "position:absolute;display:none;pointer-events:none;background:var(--bg-elevated);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:0.78rem;line-height:1.45;color:var(--text);max-width:240px;box-shadow:0 6px 18px rgba(0,0,0,0.4);z-index:5;";
    wrap.appendChild(tip);
    var data = scoreLineTooltipData;
    function show(el) {
      var entry = data[el.getAttribute("data-key")];
      if (!entry) return;
      tip.innerHTML = '<div style="font-weight:700;margin-bottom:3px;color:var(--text-faint);text-transform:uppercase;font-size:0.66rem;letter-spacing:0.05em;">' + entry.title + '</div>' + entry.lines.join("<br>");
      tip.style.display = "block";
      var wrapRect = wrap.getBoundingClientRect(), elRect = el.getBoundingClientRect();
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var left = elRect.left - wrapRect.left + elRect.width / 2 - tw / 2;
      left = Math.max(0, Math.min(left, wrap.clientWidth - tw));
      var top = elRect.top - wrapRect.top - th - 10;
      if (top < 0) top = elRect.bottom - wrapRect.top + 8;
      tip.style.left = left + "px";
      tip.style.top = top + "px";
    }
    function hide() { tip.style.display = "none"; }
    wrap.querySelectorAll(".score-dot-hit").forEach(function (el) {
      el.addEventListener("mouseenter", function () { show(el); });
      el.addEventListener("mouseleave", hide);
      el.addEventListener("focus", function () { show(el); });
      el.addEventListener("blur", hide);
      el.addEventListener("click", function (ev) { ev.stopPropagation(); show(el); });
    });
    document.addEventListener("click", hide);
  }

  function renderHeader(match, lookup) {
    var a = lookup(match.playerAId), b = lookup(match.playerBId);
    var aWon = match.winnerPlayerId === match.playerAId;
    var el = document.getElementById("mc-header");
    el.innerHTML =
      '<div class="mc-meta">' + R.statusBadge(match.status) + '<span class="badge">' + U.fmtDate(match.date) + '</span><span class="badge">First to ' + match.targetScore + '</span></div>' +
      '<div class="mc-header">' +
        '<div class="mc-side">' + (a.badgeLogoUrl ? '<img class="player-avatar" style="width:48px;height:48px;" src="' + U.esc(a.badgeLogoUrl) + '" onerror="this.style.display=\'none\'">' : '') + '<div><div class="name">' + (a.flagEmoji ? U.esc(a.flagEmoji) + " " : "") + U.esc(a.displayName) + '</div>' + (match.status === "COMPLETE" ? R.resultBadge(aWon, "A") : "") + '</div></div>' +
        '<div class="mc-score"><span>' + match.finalScoreA + '</span><span class="vs">–</span><span>' + match.finalScoreB + '</span></div>' +
        '<div class="mc-side">' + '<div style="text-align:right"><div class="name">' + U.esc(b.displayName) + (b.flagEmoji ? " " + U.esc(b.flagEmoji) : "") + '</div>' + (match.status === "COMPLETE" ? R.resultBadge(aWon, "B") : "") + '</div>' + (b.badgeLogoUrl ? '<img class="player-avatar" style="width:48px;height:48px;" src="' + U.esc(b.badgeLogoUrl) + '" onerror="this.style.display=\'none\'">' : '') + '</div>' +
      '</div>';
  }

  function renderSummary(match, lookup, timeline, buildsById, partsById) {
    var a = lookup(match.playerAId), b = lookup(match.playerBId);
    var realBattles = timeline.filter(function (e) { return e.kind === "battle" && !e.isRedo; });
    var reshuffleCount = timeline.filter(function (e) { return e.kind === "reshuffle"; }).length;
    var redoCount = timeline.filter(function (e) { return e.kind === "battle" && e.isRedo; }).length;
    var html = '<div class="panel">';
    if (match.status === "COMPLETE") {
      var winner = match.winnerPlayerId === match.playerAId ? a : b;
      html += '<p style="font-size:1.05rem;">' + U.esc(winner.displayName) + ' won ' + match.finalScoreA + '–' + match.finalScoreB + ' over ' + realBattles.length + ' battle' + (realBattles.length === 1 ? "" : "s") + (reshuffleCount ? " across " + (reshuffleCount + 1) + " rotations" : "") + '.</p>';
    } else {
      html += '<p style="font-size:1.05rem;">Match in progress — ' + match.finalScoreA + '–' + match.finalScoreB + '.</p>';
    }
    if (redoCount) html += '<p style="color:var(--text-faint);font-size:0.85rem;">' + redoCount + ' redo' + (redoCount === 1 ? "" : "s") + ' occurred during this match (Air Contact / No Contact) — these don\'t affect score and are shown in the Battle Log tab.</p>';
    if (realBattles.length) html += scoreLineSVG(realBattles, match, lookup, buildsById, partsById);
    html += '</div>';
    var summaryEl = document.getElementById("mc-summary");
    summaryEl.innerHTML = html;
    if (realBattles.length) wireScoreLineTooltips(summaryEl);
  }

  function renderFlowBarHTML(realBattles, match) {
    if (!realBattles.length) return R.emptyBlock("No battles recorded yet");
    var segs = realBattles.map(function (e) {
      var aWon = e.winnerPlayerId === match.playerAId;
      return '<div class="' + (aWon ? "a" : "b") + '" style="flex:' + Math.max(e.pointsAwarded, 1) + ';" title="' + U.esc(finishLabel(e.finishType)) + '"></div>';
    }).join("");
    return '<div class="flow-bar" style="margin-top:14px;">' + segs + '</div>';
  }

  // "Spin Finish for Technicolor Sky with Shelter Drake / 7-60 / Rush" -
  // reads as a sentence rather than making someone cross-reference which
  // side's build won. Falls back gracefully if winnerPlayerId doesn't
  // match either side (shouldn't happen, but never crash the log over it).
  // Shared plain-text version of the same sentence, used for SVG <title>
  // tooltips (SVG titles are plain text, not HTML) and anywhere else that
  // can't render markup. "Spin Finish — Technicolor Sky with Shelter
  // Drake / 7-60 / Rush vs Dran Buster / 2-60 / Low Flat"
  function battleSentenceText(e, match, lookup, buildsById, partsById) {
    var aWon = e.winnerPlayerId === match.playerAId;
    var winner = lookup(e.winnerPlayerId);
    var winnerBuildId = aWon ? e.buildIdA : e.buildIdB;
    var loserBuildId = aWon ? e.buildIdB : e.buildIdA;
    return finishLabel(e.finishType) + " — " + winner.displayName + " with " + buildLabel(winnerBuildId, buildsById, partsById) +
      " vs " + buildLabel(loserBuildId, buildsById, partsById);
  }

  function battleSentenceHTML(e, match, lookup, buildsById, partsById) {
    var aWon = e.winnerPlayerId === match.playerAId;
    var winner = lookup(e.winnerPlayerId);
    var winnerBuildId = aWon ? e.buildIdA : e.buildIdB;
    var loserBuildId = aWon ? e.buildIdB : e.buildIdA;
    return '<span style="flex:1;min-width:0;">' +
      '<span>' + U.esc(finishLabel(e.finishType)) + ' for <strong>' + U.esc(winner.displayName) + '</strong> with ' + U.esc(buildLabel(winnerBuildId, buildsById, partsById)) + '</span>' +
      '<span style="display:block;color:var(--text-faint);font-size:0.78rem;margin-top:1px;">vs ' + U.esc(buildLabel(loserBuildId, buildsById, partsById)) + '</span>' +
      '</span>';
  }

  function renderBattleLog(timeline, match, lookup, buildsById, partsById) {
    var el = document.getElementById("mc-battle-log");
    if (!timeline.length) { el.innerHTML = R.emptyBlock("No battle events recorded for this match"); return; }
    var html = '<div class="panel" style="padding:0;">';
    var lastRotation = null;
    timeline.forEach(function (e) {
      if (e.kind === "reshuffle") {
        html += '<div class="reshuffle-marker">Reshuffle — rotation ' + (e.rotationSeq + 1) + '</div>';
        lastRotation = e.rotationSeq + 1;
        return;
      }
      if (e.isRedo) {
        html += '<div class="battle-row redo"><span class="seq">–</span><span>Redo — ' + U.esc(finishLabel(e.finishType)) + '</span></div>';
        return;
      }
      html += '<div class="battle-row">' +
        '<span class="seq">' + (e.battleSeq !== null ? e.battleSeq : "") + '</span>' +
        battleSentenceHTML(e, match, lookup, buildsById, partsById) +
        '<span style="font-family:var(--data);font-weight:700;">' + e.scoreAAfter + '–' + e.scoreBAfter + '</span></div>';
    });
    html += "</div>";
    el.innerHTML = html;
  }

  function renderBuilds(decks, box, match, buildsById, partsById) {
    var el = document.getElementById("mc-builds");
    function deckHTML(deckBuildIds, label) {
      if (!deckBuildIds.length) return '<div>' + R.emptyBlock("No builds recorded", "This match may have ended before every build was used.") + '</div>';
      return '<div><div class="eyebrow">' + label + '</div>' + deckBuildIds.map(function (buildId) {
        var stats = box[buildId];
        var winPct = stats && stats.battles > 0 ? stats.wins / stats.battles : null;
        return '<div class="deck-card" style="margin-bottom:8px;">' + partThumb(bladePartOf(buildId, buildsById, partsById)) +
          '<div style="flex:1;min-width:0;"><div style="font-weight:600;">' + U.esc(buildLabel(buildId, buildsById, partsById)) + '</div>' +
          (stats ? '<div style="font-size:0.8rem;color:var(--text-dim);">' + stats.battles + ' battles · ' + stats.wins + 'W-' + stats.losses + 'L</div>' : '<div style="font-size:0.8rem;color:var(--text-faint);">Not piloted this match</div>') +
          '</div>' +
          (winPct !== null ? '<div style="width:46px;flex-shrink:0;text-align:right;font-family:var(--data);font-weight:700;color:' + (winPct >= 0.5 ? "var(--arc-bright)" : "var(--text-faint)") + ';">' + U.pct(winPct) + '</div>' : '') +
          '</div>';
      }).join("") + "</div>";
    }
    el.innerHTML = '<div class="grid grid-2">' + deckHTML(decks.deckA, "Player A deck") + deckHTML(decks.deckB, "Player B deck") + '</div>' +
      '<p style="color:var(--text-faint);font-size:0.8rem;margin-top:14px;">Part imagery appears automatically once image URLs are set in the Parts Catalog — builds shown above without art simply don\'t have one yet.</p>';
  }

  function renderStats(box, buildsById, partsById) {
    var el = document.getElementById("mc-stats");
    var rows = Object.keys(box).map(function (id) { return box[id]; });
    if (!rows.length) { el.innerHTML = R.emptyBlock("No battles recorded yet"); return; }
    el.innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr><th>Build</th><th class="num">Battles</th><th class="num">W</th><th class="num">L</th><th class="num">Win%</th><th class="num">Pts Won</th><th class="num">Pts Allowed</th><th>Finishes</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var winPct = r.battles > 0 ? r.wins / r.battles : 0;
        var finishes = Object.keys(r.finishCounts).map(function (f) { return finishLabel(f) + " ×" + r.finishCounts[f]; }).join(", ") || "—";
        return '<tr><td>' + U.esc(buildLabel(r.buildId, buildsById, partsById)) + '</td><td class="num">' + r.battles + '</td><td class="num">' + r.wins + '</td><td class="num">' + r.losses + '</td><td class="num">' + U.pct(winPct) + '</td><td class="num">' + r.pointsWon + '</td><td class="num">' + r.pointsAllowed + '</td><td>' + U.esc(finishes) + '</td></tr>';
      }).join("") + "</tbody></table></div>";
  }

  function renderFlow(timeline, match, lookup, buildsById, partsById) {
    var el = document.getElementById("mc-flow");
    var realBattles = timeline.filter(function (e) { return e.kind === "battle" && !e.isRedo; });
    if (!realBattles.length) { el.innerHTML = R.emptyBlock("No battles recorded yet"); return; }
    var rows = realBattles.map(function (e, i) {
      return '<div class="result-row"><span style="display:flex;gap:8px;align-items:baseline;"><span style="color:var(--text-faint);">Battle ' + (i + 1) + '</span>' + battleSentenceHTML(e, match, lookup, buildsById, partsById) + '</span><span class="result-score">' + e.scoreAAfter + '–' + e.scoreBAfter + '</span></div>';
    }).join("");
    el.innerHTML = '<div class="panel">' + renderFlowBarHTML(realBattles, match) +
      '<p style="color:var(--text-dim);font-size:0.85rem;margin:14px 0 6px;">Each segment above is one battle, sized by points awarded and colored by winner — read left to right for how the match unfolded.</p>' +
      '<div style="margin-top:10px;">' + rows + '</div></div>';
  }

  function wireTabs() {
    document.querySelectorAll('#mc-tabs button').forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll('#mc-tabs button').forEach(function (b) { b.classList.remove("active"); });
        document.querySelectorAll('.mc-panel').forEach(function (p) { p.classList.add("hidden"); });
        btn.classList.add("active");
        document.getElementById("mc-" + btn.getAttribute("data-tab")).classList.remove("hidden");
      });
    });
  }

  window.APP_DATA.loadAppData().then(function (data) {
    var matchId = getMatchId();
    var match = data.matches.filter(function (m) { return m.matchId === matchId; })[0];
    var lookup = R.playerLookup(data.players);
    if (!matchId) { document.getElementById("mc-header").innerHTML = R.emptyBlock("No match specified", "This page needs a ?id= link from the Schedule or Home page."); return; }
    if (!match) {
      if (!data.meta.matches.ok) document.getElementById("mc-header").innerHTML = R.errorBlock(data.meta.matches.error, "feed_matches");
      else document.getElementById("mc-header").innerHTML = R.emptyBlock("Match not found", "This match may not be completed yet, or the link may be out of date.");
      return;
    }
    var timeline = buildTimeline(matchId, data);
    var decksAndBox = computeDecksAndBoxScore(matchId, match, timeline);
    var buildsById = {}; data.builds.forEach(function (b) { buildsById[b.buildId] = b; });
    var partsById = {}; data.parts.forEach(function (p) { partsById[p.partId] = p; });

    renderHeader(match, lookup);
    renderSummary(match, lookup, timeline, buildsById, partsById);
    renderBattleLog(timeline, match, lookup, buildsById, partsById);
    renderBuilds(decksAndBox, decksAndBox.box, match, buildsById, partsById);
    renderStats(decksAndBox.box, buildsById, partsById);
    renderFlow(timeline, match, lookup, buildsById, partsById);
    wireTabs();
  }).catch(function (err) {
    document.getElementById("mc-header").innerHTML = R.errorBlock(err && err.code, "a data feed");
  });
})();
