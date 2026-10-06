(function () {
  "use strict";
  var U = window.APP_UTILS, R = window.APP_RENDER;

  function pickCurrentStage(data) {
    // "Current stage" = whichever stage has the most recent match activity.
    // Falls back to the highest-order stage of an active season if there's
    // no match data yet (a season that's just starting).
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

  function renderUpcoming(data, lookup) {
    var el = document.getElementById("home-upcoming");
    if (!data.meta.schedule.ok) { el.innerHTML = R.errorBlock(data.meta.schedule.error, "feed_schedule"); return; }
    var upcoming = data.schedule.filter(function (m) { return String(m.status).toUpperCase() !== "COMPLETE" && String(m.status).toUpperCase() !== "CANCELLED"; })
      .sort(function (a, b) {
        var da = a.date ? new Date(a.date).getTime() : Infinity, db = b.date ? new Date(b.date).getTime() : Infinity;
        return da - db;
      })
      .slice(0, window.APP_CONFIG.HOME_SCHEDULE_COUNT);
    if (!upcoming.length) { el.innerHTML = R.emptyBlock("Nothing scheduled right now", "Check back once new matches are set up."); return; }
    el.innerHTML = upcoming.map(function (m) {
      var a = lookup(m.playerAId), b = lookup(m.playerBId);
      return '<div class="result-row"><span>' + U.esc(a.displayName) + ' <span style="color:var(--text-faint)">vs</span> ' + U.esc(b.displayName) + '</span>' +
        '<span class="badge">' + U.fmtDateShort(m.date) + '</span></div>';
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

  function renderLeaders(data) {
    var el = document.getElementById("home-leaders");
    if (!data.meta.standings.ok) { el.innerHTML = R.errorBlock(data.meta.standings.error, "feed_standings"); return; }
    if (!data.standings.length) { el.innerHTML = R.emptyBlock("No leaders yet"); return; }
    var top = data.standings.filter(function (s) { return s.matchesPlayed > 0; })
      .sort(function (a, b) { return b.gblRating - a.gblRating; }).slice(0, window.APP_CONFIG.HOME_LEADERS_COUNT);
    if (!top.length) { el.innerHTML = R.emptyBlock("No leaders yet", "Leaders appear once matches have been played."); return; }
    el.innerHTML = top.map(function (r, i) {
      return '<div class="result-row"><span class="rank-cell' + (i < 3 ? " top" : "") + '">' + (i + 1) + '.</span> <a href="player.html?id=' + encodeURIComponent(r.playerId) + '">' + U.esc(r.displayName) + '</a>' +
        '<span class="result-score">' + r.gblRating.toFixed(3) + '</span></div>';
    }).join("");
  }

  window.APP_DATA.loadAppData().then(function (data) {
    var lookup = R.playerLookup(data.players);
    var currentStageId = pickCurrentStage(data);
    renderHero(data, currentStageId);
    renderResults(data, lookup);
    renderUpcoming(data, lookup);
    renderStandingsSnapshot(data, currentStageId);
    renderLeaders(data);
  }).catch(function (err) {
    ["home-results", "home-upcoming", "home-standings", "home-leaders"].forEach(function (id) {
      document.getElementById(id).innerHTML = R.errorBlock(err && err.code, "a data feed");
    });
  });
})();
