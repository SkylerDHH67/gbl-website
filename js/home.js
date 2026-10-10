(function () {
  "use strict";
  var U = window.APP_UTILS, R = window.APP_RENDER;

  function pickCurrentStage(data) {
    var lastDateByStage = {};
    data.matches.forEach(function (m) {
      var t = new Date(m.date).getTime();
      if (!isNaN(t) && (!lastDateByStage[m.stageId] || t > lastDateByStage[m.stageId])) lastDateByStage[m.stageId] = t;
    });
    var stageIds = Object.keys(lastDateByStage);
    if (stageIds.length) {
      stageIds.sort(function (a, b) { return lastDateByStage[b] - lastDateByStage[a]; });
      return stageIds[0];
    }
    var activeStageIds = Object.keys(data.stages).filter(function (id) {
      var st = data.stages[id];
      return st.seasonId && data.seasonStatus[st.seasonId] && String(data.seasonStatus[st.seasonId]).toLowerCase() === "active";
    });
    activeStageIds.sort(function (a, b) { return (data.stages[b].order || 0) - (data.stages[a].order || 0); });
    return activeStageIds[0] || null;
  }

  function renderHero(data, currentStageId) {
    var el = document.getElementById("hero-stage-label");
    if (!currentStageId || !data.stages[currentStageId]) { el.textContent = "Season hub"; return; }
    var stage = data.stages[currentStageId];
    var seasonLabel = data.seasons[stage.seasonId] || stage.seasonId || "";
    el.textContent = (seasonLabel ? seasonLabel + " — " : "") + (stage.name || currentStageId) + " in progress";
  }

  function renderResults(data, lookup) {
    var el = document.getElementById("home-results");
    if (!data.meta.matches.ok) { el.innerHTML = R.errorBlock(data.meta.matches.error, "feed_matches"); return; }
    var completed = data.matches.filter(function (m) { return m.status === "COMPLETE"; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
      .slice(0, window.APP_CONFIG.HOME_RESULTS_COUNT);
    if (!completed.length) { el.innerHTML = R.emptyBlock("No completed matches yet", "Results will appear here once matches are played."); return; }
    el.innerHTML = completed.map(function (m) {
      var a = lookup(m.playerAId), b = lookup(m.playerBId);
      return '<a class="result-row" href="match.html?id=' + encodeURIComponent(m.matchId) + '">' +
        '<span>' + U.esc(a.displayName) + ' <span class="result-score">' + m.finalScoreA + '–' + m.finalScoreB + '</span> ' + U.esc(b.displayName) + '</span>' +
        '<span class="badge">' + U.fmtDateShort(m.date) + '</span></a>';
    }).join("");
  }

  // Sourced from the manual "Upcoming Matches" tab (feed_upcoming), not
  // the live-match-engine Schedule tab - purely a hand-edited preview, so
  // names are plain text and there's no real date to sort by. Sheet row
  // order is treated as the admin's intended display order.
  function renderUpcoming(data) {
    var el = document.getElementById("home-upcoming");
    if (!data.meta.upcoming.ok) { el.innerHTML = R.errorBlock(data.meta.upcoming.error, "feed_upcoming"); return; }
    var upcoming = data.upcoming.slice(0, window.APP_CONFIG.HOME_SCHEDULE_COUNT);
    if (!upcoming.length) { el.innerHTML = R.emptyBlock("Nothing scheduled right now", "Check back once new matches are added to the Upcoming Matches tab."); return; }
    el.innerHTML = upcoming.map(function (m) {
      return '<div class="result-row"><span>' + U.esc(m.playerAName) + ' <span style="color:var(--text-faint)">vs</span> ' + U.esc(m.playerBName) + '</span>' +
        '<span class="badge">' + U.esc(m.date || "TBD") + '</span></div>';
    }).join("");
  }

  function renderStandingsSnapshot(data, currentStageId) {
    var el = document.getElementById("home-standings");
    if (!data.meta.standings.ok) { el.innerHTML = R.errorBlock(data.meta.standings.error, "feed_standings"); return; }
    var rows = data.standings.filter(function (s) { return s.stageId === currentStageId; }).sort(function (a, b) { return a.rank - b.rank; }).slice(0, 5);
    if (!rows.length) { el.innerHTML = R.emptyBlock("No standings yet", "Standings appear once players have completed matches in this stage."); return; }
    el.innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Player</th><th class="num">W-L</th><th class="num">Rating</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td class="rank-cell' + (r.rank <= 3 ? " top" : "") + '">' + r.rank + '</td><td><a href="player.html?id=' + encodeURIComponent(r.playerId) + '">' + U.esc(r.displayName) + '</a></td>' +
          '<td class="num">' + r.wins + '-' + r.losses + '</td><td class="num">' + r.gblRating.toFixed(3) + '</td></tr>';
      }).join("") + "</tbody></table></div>";
  }

  // League leaders is build-centric, not player-centric: ranks by win rate
  // among builds with enough battles to mean something (MIN_SAMPLE), same
  // statistical-integrity principle used everywhere else on this site -
  // a 1-0 build never outranks a proven one just because 100% > 90%.
  var BUILD_LEADER_MIN_SAMPLE = 3;

  function renderLeaders(data) {
    var el = document.getElementById("home-leaders");
    if (!data.meta.buildStats.ok) { el.innerHTML = R.errorBlock(data.meta.buildStats.error, "feed_build_stats"); return; }
    var qualified = data.buildStats.filter(function (b) { return b.timesUsed >= BUILD_LEADER_MIN_SAMPLE; });
    if (!qualified.length) {
      el.innerHTML = R.emptyBlock("No qualified builds yet", "A build needs at least " + BUILD_LEADER_MIN_SAMPLE + " battles before it shows up here.");
      return;
    }
    var top = qualified.sort(function (a, b) { return b.winRate - a.winRate || b.timesUsed - a.timesUsed; })
      .slice(0, window.APP_CONFIG.HOME_LEADERS_COUNT);
    var lookup = R.playerLookup(data.players);
    el.innerHTML = top.map(function (r, i) {
      var pilot = lookup(r.playerId);
      return '<div class="result-row"><span class="rank-cell' + (i < 3 ? " top" : "") + '">' + (i + 1) + '.</span> ' +
        '<span><span style="font-family:var(--data);font-weight:700;">' + U.esc(r.buildId) + '</span> <span style="color:var(--text-faint);font-size:0.82rem;">— ' + U.esc(pilot.displayName) + '</span></span>' +
        '<span class="result-score">' + U.pct(r.winRate) + '<span style="color:var(--text-faint);font-weight:400;font-size:0.78rem;"> (' + r.timesUsed + ')</span></span></div>';
    }).join("");
  }

  window.APP_DATA.loadAppData().then(function (data) {
    var lookup = R.playerLookup(data.players);
    var currentStageId = pickCurrentStage(data);
    renderHero(data, currentStageId);
    renderResults(data, lookup);
    renderUpcoming(data);
    renderStandingsSnapshot(data, currentStageId);
    renderLeaders(data);
  }).catch(function (err) {
    ["home-results", "home-upcoming", "home-standings", "home-leaders"].forEach(function (id) {
      document.getElementById(id).innerHTML = R.errorBlock(err && err.code, "a data feed");
    });
  });
})();
