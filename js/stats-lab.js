/* =========================================================
   GLOBAL BLADE LEAGUE
   stats-lab.js — exploratory filtering over the atomic Stats Lab
   Source feed (one row per valid battle). Every number here is
   derived straight from that feed plus season/stage config and
   the Players/Builds/Parts feeds - nothing here is a fabricated
   "branded" metric with no basis in the underlying battle data.

   Two modes, chosen automatically by whether a Player filter is
   set:
   - Player selected: the source rows are flattened into one
     record per side so stats read naturally from that player's
     perspective (their build, their result, their points).
   - No player selected: the raw per-battle rows are used directly
     (not flattened/doubled) so "battles" stays an honest count,
     and a build leaderboard is shown across both sides.
   ========================================================= */

(function () {
  "use strict";
  var U = window.APP_UTILS, R = window.APP_RENDER;
  var LOW_SAMPLE_THRESHOLD = 5;

  var filters = { player: "", opponent: "", season: "", stage: "", build: "", blade: "", finish: "" };
  var APP_DATA = null;

  // Resolves a build_id to its Blade part_id (shared shape with
  // builds.js/render.js's bladeSlotOf) so the Blade filter can match
  // battles/builds regardless of which Ratchet/Bit they were paired with.
  function bladeOfBuild(buildId, buildsById) {
    var slot = R.bladeSlotOf(buildsById[buildId]);
    return slot ? slot.pid : "";
  }

  function partsLookup(parts) {
    var byId = {};
    (parts || []).forEach(function (p) { byId[p.partId] = p; });
    return byId;
  }
  function buildsLookup(builds) {
    var byId = {};
    (builds || []).forEach(function (b) { byId[b.buildId] = b; });
    return byId;
  }

  // One flattened participant-record per side of every statsLabSource row.
  function flattenParticipants(data) {
    var out = [];
    data.statsLabSource.forEach(function (b) {
      out.push({
        matchId: b.matchId, seasonId: b.seasonId, stageId: b.stageId,
        playerId: b.playerAId, opponentId: b.playerBId, buildId: b.buildIdA, opponentBuildId: b.buildIdB,
        finishType: b.finishType, won: b.winnerPlayerId === b.playerAId,
        pointsFor: b.winnerPlayerId === b.playerAId ? b.pointsAwarded : 0
      });
      out.push({
        matchId: b.matchId, seasonId: b.seasonId, stageId: b.stageId,
        playerId: b.playerBId, opponentId: b.playerAId, buildId: b.buildIdB, opponentBuildId: b.buildIdA,
        finishType: b.finishType, won: b.winnerPlayerId === b.playerBId,
        pointsFor: b.winnerPlayerId === b.playerBId ? b.pointsAwarded : 0
      });
    });
    return out;
  }

  function populateSelect(selectEl, items, labelFn) {
    var sorted = items.slice().sort(function (a, b) { return labelFn(a).localeCompare(labelFn(b)); });
    sorted.forEach(function (item) {
      var opt = document.createElement("option");
      opt.value = item.value;
      opt.textContent = labelFn(item);
      selectEl.appendChild(opt);
    });
  }

  function setupFilters(data) {
    var partsById = partsLookup(data.parts);
    var buildsById = buildsLookup(data.builds);
    var playerLookup = R.playerLookup(data.players);

    var playerIdsSeen = {}, buildIdsSeen = {}, finishTypesSeen = {};
    data.statsLabSource.forEach(function (b) {
      playerIdsSeen[b.playerAId] = true; playerIdsSeen[b.playerBId] = true;
      if (b.buildIdA) buildIdsSeen[b.buildIdA] = true;
      if (b.buildIdB) buildIdsSeen[b.buildIdB] = true;
      if (b.finishType) finishTypesSeen[b.finishType] = true;
    });

    var playerItems = Object.keys(playerIdsSeen).map(function (id) { return { value: id, label: playerLookup(id).displayName }; });
    populateSelect(document.getElementById("sl-player"), playerItems, function (i) { return i.label; });
    populateSelect(document.getElementById("sl-opponent"), playerItems, function (i) { return i.label; });

    var seasonItems = Object.keys(data.seasons || {}).map(function (id) { return { value: id, label: data.seasons[id] || id }; });
    populateSelect(document.getElementById("sl-season"), seasonItems, function (i) { return i.label; });

    var stageItems = Object.keys(data.stages || {}).map(function (id) { return { value: id, label: (data.stages[id] && data.stages[id].name) || id }; });
    populateSelect(document.getElementById("sl-stage"), stageItems, function (i) { return i.label; });

    var buildItems = Object.keys(buildIdsSeen).map(function (id) {
      return { value: id, label: R.buildLabelOrFallback(buildsById[id], partsById, id) };
    });
    populateSelect(document.getElementById("sl-build"), buildItems, function (i) { return i.label; });

    var bladeIdsSeen = {};
    Object.keys(buildIdsSeen).forEach(function (id) {
      var pid = bladeOfBuild(id, buildsById);
      if (pid) bladeIdsSeen[pid] = true;
    });
    var bladeItems = Object.keys(bladeIdsSeen).map(function (pid) {
      return { value: pid, label: (partsById[pid] && partsById[pid].displayName) || pid };
    });
    populateSelect(document.getElementById("sl-blade"), bladeItems, function (i) { return i.label; });

    var finishItems = Object.keys(finishTypesSeen).map(function (k) { return { value: k, label: R.FINISH_LABELS[k] || k }; });
    populateSelect(document.getElementById("sl-finish"), finishItems, function (i) { return i.label; });

    ["player", "opponent", "season", "stage", "build", "blade", "finish"].forEach(function (key) {
      document.getElementById("sl-" + key).addEventListener("change", function (e) {
        filters[key] = e.target.value;
        renderResults(data);
      });
    });
  }

  function statCardsHTML(cards) {
    return '<div class="grid grid-4" style="margin-bottom:18px;">' + cards.map(function (c) {
      return '<div class="stat-card"><div class="label">' + U.esc(c.label) + '</div><div class="value">' + c.value + '</div>' +
        (c.sub ? '<div class="sub">' + U.esc(c.sub) + '</div>' : '') + '</div>';
    }).join("") + '</div>';
  }

  // Player-perspective mode: aggregate flattened participant records that
  // match every active filter, from the selected player's point of view.
  function renderPlayerMode(data, partsById, buildsById, playerLookup) {
    var participants = flattenParticipants(data).filter(function (p) {
      if (p.playerId !== filters.player) return false;
      if (filters.opponent && p.opponentId !== filters.opponent) return false;
      if (filters.season && p.seasonId !== filters.season) return false;
      if (filters.stage && p.stageId !== filters.stage) return false;
      if (filters.build && p.buildId !== filters.build) return false;
      if (filters.blade && bladeOfBuild(p.buildId, buildsById) !== filters.blade) return false;
      if (filters.finish && p.finishType !== filters.finish) return false;
      return true;
    });

    var player = playerLookup(filters.player);

    if (!participants.length) {
      return R.emptyBlock("No battles match these filters", "Try clearing the opponent, build, blade, or finish type filter.");
    }

    var battles = participants.length;
    var wins = participants.filter(function (p) { return p.won; }).length;
    var pts = participants.reduce(function (sum, p) { return sum + p.pointsFor; }, 0);
    var dist = {};
    participants.forEach(function (p) { if (p.finishType) dist[p.finishType] = (dist[p.finishType] || 0) + 1; });

    var lowSample = battles < LOW_SAMPLE_THRESHOLD;
    var cards = [
      { label: "Battles", value: battles + (lowSample ? ' <span class="badge" title="Small sample size">n&lt;' + LOW_SAMPLE_THRESHOLD + '</span>' : "") },
      { label: "Record", value: wins + "-" + (battles - wins) },
      { label: "Win Rate", value: U.pct(battles ? wins / battles : 0) },
      { label: "Pts/Battle", value: (battles ? pts / battles : 0).toFixed(2) }
    ];

    // Build breakdown within this filtered set (skipped if a build filter
    // is already pinned, since that would just repeat one row).
    var buildRows = "";
    if (!filters.build) {
      var byBuild = {};
      participants.forEach(function (p) {
        if (!p.buildId) return;
        byBuild[p.buildId] = byBuild[p.buildId] || { used: 0, won: 0 };
        byBuild[p.buildId].used++;
        if (p.won) byBuild[p.buildId].won++;
      });
      var buildList = Object.keys(byBuild).map(function (id) {
        var s = byBuild[id];
        return { id: id, label: R.buildLabelOrFallback(buildsById[id], partsById, id), used: s.used, won: s.won, winRate: s.used ? s.won / s.used : 0 };
      }).sort(function (a, b) { return b.used - a.used; });

      buildRows = '<h2 class="section-title">Builds used in this filter</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Build</th><th class="num">Used</th><th class="num">Won</th><th class="num">Win Rate</th></tr></thead><tbody>' +
        buildList.map(function (b) {
          return '<tr><td>' + U.esc(b.label) + '</td><td class="num"><span class="num-cell">' + b.used + '</span></td><td class="num"><span class="num-cell">' + b.won + '</span></td><td class="num"><span class="num-cell">' + U.pct(b.winRate) + '</span></td></tr>';
        }).join("") + '</tbody></table></div>';
    }

    var h2h = "";
    if (filters.opponent) {
      var opp = playerLookup(filters.opponent);
      var h2hRow = data.headToHead.filter(function (h) {
        return (h.playerX === filters.player && h.playerY === filters.opponent) || (h.playerX === filters.opponent && h.playerY === filters.player);
      })[0];
      if (h2hRow) {
        var xIsPlayer = h2hRow.playerX === filters.player;
        var playerWins = xIsPlayer ? h2hRow.xWins : h2hRow.yWins;
        var oppWins = xIsPlayer ? h2hRow.yWins : h2hRow.xWins;
        h2h = '<div class="panel" style="margin-bottom:18px;"><div class="eyebrow">Lifetime Head-to-Head</div>' +
          '<div style="font-family:var(--display);font-size:1.3rem;font-weight:700;">' + U.esc(player.displayName) + ' ' + playerWins + ' – ' + oppWins + ' ' + U.esc(opp.displayName) + '</div>' +
          '<div class="sub" style="color:var(--text-dim);font-size:0.82rem;margin-top:4px;">Across ' + h2hRow.matches + ' total match' + (h2hRow.matches === 1 ? "" : "es") + ' (not limited to the filters above)</div></div>';
      }
    }

    return '<h2 class="section-title">' + U.esc(player.displayName) + (filters.opponent ? " vs " + U.esc(playerLookup(filters.opponent).displayName) : "") + '</h2>' +
      statCardsHTML(cards) + h2h +
      '<div class="panel" style="margin-bottom:18px;"><div class="eyebrow">Finish Breakdown</div>' + R.finishBarHTML(dist) + '</div>' +
      buildRows;
  }

  // League-wide mode (no player selected): operate on real battles, not
  // flattened/doubled participant rows, so "Battles" stays an honest count.
  function renderLeagueMode(data, partsById, buildsById) {
    var battlesRows = data.statsLabSource.filter(function (b) {
      if (filters.season && b.seasonId !== filters.season) return false;
      if (filters.stage && b.stageId !== filters.stage) return false;
      if (filters.finish && b.finishType !== filters.finish) return false;
      if (filters.build && b.buildIdA !== filters.build && b.buildIdB !== filters.build) return false;
      if (filters.blade && bladeOfBuild(b.buildIdA, buildsById) !== filters.blade && bladeOfBuild(b.buildIdB, buildsById) !== filters.blade) return false;
      return true;
    });

    if (!battlesRows.length) {
      return R.emptyBlock("No battles match these filters", "Pick a player to see individual results, or clear a filter.");
    }

    var dist = {};
    battlesRows.forEach(function (b) { if (b.finishType) dist[b.finishType] = (dist[b.finishType] || 0) + 1; });

    var byBuild = {};
    battlesRows.forEach(function (b) {
      [{ id: b.buildIdA, won: b.winnerPlayerId === b.playerAId }, { id: b.buildIdB, won: b.winnerPlayerId === b.playerBId }].forEach(function (s) {
        if (!s.id) return;
        byBuild[s.id] = byBuild[s.id] || { used: 0, won: 0 };
        byBuild[s.id].used++;
        if (s.won) byBuild[s.id].won++;
      });
    });
    var buildList = Object.keys(byBuild).map(function (id) {
      var s = byBuild[id];
      return { label: R.buildLabelOrFallback(buildsById[id], partsById, id), used: s.used, won: s.won, winRate: s.used ? s.won / s.used : 0 };
    }).sort(function (a, b) { return b.used - a.used; }).slice(0, 15);

    return '<h2 class="section-title">League-wide</h2>' +
      statCardsHTML([{ label: "Battles", value: battlesRows.length }, { label: "Distinct Builds Seen", value: Object.keys(byBuild).length }]) +
      '<div class="panel" style="margin-bottom:18px;"><div class="eyebrow">Finish Breakdown</div>' + R.finishBarHTML(dist) + '</div>' +
      '<h2 class="section-title">Top builds in this filter</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Build</th><th class="num">Used</th><th class="num">Won</th><th class="num">Win Rate</th></tr></thead><tbody>' +
      buildList.map(function (b) {
        var low = b.used < LOW_SAMPLE_THRESHOLD ? '<span class="badge" title="Small sample size">n&lt;' + LOW_SAMPLE_THRESHOLD + '</span> ' : "";
        return '<tr><td>' + U.esc(b.label) + '</td><td class="num"><span class="num-cell">' + low + b.used + '</span></td><td class="num"><span class="num-cell">' + b.won + '</span></td><td class="num"><span class="num-cell">' + U.pct(b.winRate) + '</span></td></tr>';
      }).join("") + '</tbody></table></div><p class="section-sub" style="margin-top:14px;">Select a player above to see individual results, head-to-head, and per-battle detail.</p>';
  }

  // "Which Ratchet/Bit combo does this Blade perform best with" - answered
  // straight from the existing per-build league-wide stats (feed_build_stats),
  // not from battle-level filtering, since it's inherently a cross-match
  // question ("every build ever recorded with this blade") rather than
  // something scoped to the player/season/stage filters above. This is
  // deliberately NOT full deck/lineup analysis (which blade pairs with which
  // other blades across a player's 3-build deck) - that needs deck-level
  // data that isn't cleanly categorized yet, so it's left for later.
  function bladeBreakdownHTML(data, partsById, buildsById) {
    if (!filters.blade) return "";
    var rows = (data.buildStats || []).filter(function (r) {
      return bladeOfBuild(r.buildId, buildsById) === filters.blade;
    }).map(function (r) {
      return { label: R.buildLabelOrFallback(buildsById[r.buildId], partsById, r.buildId), used: r.timesUsed, winRate: r.winRate, netRating: r.netRating, pointsPerBattle: r.pointsPerBattle };
    }).sort(function (a, b) { return b.winRate - a.winRate || b.used - a.used; });
    if (!rows.length) return "";
    var bladeName = (partsById[filters.blade] && partsById[filters.blade].displayName) || filters.blade;
    return '<h2 class="section-title">Best builds for ' + U.esc(bladeName) + '</h2>' +
      '<p class="section-sub">Every Ratchet/Bit combo recorded with this blade, ranked by win rate — league-wide, across all seasons and stages (not limited to the filters above).</p>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Build</th><th class="num">Used</th><th class="num">Win Rate</th><th class="num">Net Rating</th><th class="num">Pts/Battle</th></tr></thead><tbody>' +
      rows.map(function (b) {
        var low = b.used < LOW_SAMPLE_THRESHOLD ? '<span class="badge" title="Small sample size">n&lt;' + LOW_SAMPLE_THRESHOLD + '</span> ' : "";
        return '<tr><td>' + U.esc(b.label) + '</td><td class="num"><span class="num-cell">' + low + b.used + '</span></td><td class="num"><span class="num-cell">' + U.pct(b.winRate) + '</span></td>' +
          '<td class="num"><span class="num-cell" style="color:' + R.netRatingColor(b.netRating) + ';">' + b.netRating.toFixed(2) + '</span></td>' +
          '<td class="num"><span class="num-cell">' + b.pointsPerBattle.toFixed(2) + '</span></td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function renderResults(data) {
    var partsById = partsLookup(data.parts);
    var buildsById = buildsLookup(data.builds);
    var playerLookup = R.playerLookup(data.players);
    var mainHTML = filters.player
      ? renderPlayerMode(data, partsById, buildsById, playerLookup)
      : renderLeagueMode(data, partsById, buildsById);
    var bladeHTML = bladeBreakdownHTML(data, partsById, buildsById);
    document.getElementById("sl-results").innerHTML = mainHTML + (bladeHTML ? '<div style="margin-top:28px;">' + bladeHTML + '</div>' : "");
  }

  window.APP_DATA.loadAppData().then(function (data) {
    APP_DATA = data;
    if (!data.meta.statsLabSource.ok) {
      document.getElementById("sl-results").innerHTML = R.errorBlock(data.meta.statsLabSource.error, "feed_stats_lab_source");
      return;
    }
    setupFilters(data);
    renderResults(data);
  }).catch(function (err) {
    document.getElementById("sl-results").innerHTML = R.errorBlock(err && err.code, "a data feed");
  });
})();
