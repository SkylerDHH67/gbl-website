(function () {
  "use strict";
  var U = window.APP_UTILS, R = window.APP_RENDER;
  var CACHE = null;
  var activeStageId = null;

  function stageLabel(data, stageId) {
    var st = data.stages[stageId];
    if (!st) return stageId;
    var seasonLabel = data.seasons[st.seasonId] || "";
    return (seasonLabel ? seasonLabel + " — " : "") + (st.name || stageId);
  }

  function renderFilters(data) {
    var el = document.getElementById("stage-filters");
    var stageIds = Object.keys(data.stages).filter(function (id) { return data.standings.some(function (s) { return s.stageId === id; }); });
    stageIds.sort(function (a, b) { return (data.stages[a].order || 0) - (data.stages[b].order || 0); });
    if (!stageIds.length) { el.innerHTML = ""; return; }
    if (!activeStageId) activeStageId = stageIds[stageIds.length - 1];
    el.innerHTML = stageIds.map(function (id) {
      return '<button class="chip' + (id === activeStageId ? " active" : "") + '" data-stage="' + U.esc(id) + '">' + U.esc(stageLabel(data, id)) + "</button>";
    }).join("");
    el.querySelectorAll(".chip").forEach(function (btn) {
      btn.addEventListener("click", function () { activeStageId = btn.getAttribute("data-stage"); renderFilters(data); renderTable(data); });
    });
  }

  function renderTable(data) {
    var el = document.getElementById("standings-table");
    var rows = data.standings.filter(function (s) { return s.stageId === activeStageId; }).sort(function (a, b) { return a.rank - b.rank; });
    if (!rows.length) { el.innerHTML = R.emptyBlock("No standings for this stage yet", "Standings appear once players have completed matches here."); return; }
    el.innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th>#</th><th>Player</th><th class="num">MP</th><th class="num">W-L</th><th class="num">Win%</th><th class="num">PF</th><th class="num">PA</th><th class="num">Diff</th><th>Last 10</th><th class="num">Elo</th><th class="num">GBL Rating</th>' +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr><td class="rank-cell' + (r.rank <= 3 ? " top" : "") + '">' + r.rank + '</td>' +
          '<td><a href="player.html?id=' + encodeURIComponent(r.playerId) + '">' + U.esc(r.displayName) + '</a></td>' +
          '<td class="num">' + r.matchesPlayed + '</td><td class="num">' + r.wins + '-' + r.losses + '</td><td class="num">' + U.pct(r.winPct) + '</td>' +
          '<td class="num">' + r.pointsFor + '</td><td class="num">' + r.pointsAgainst + '</td><td class="num">' + (r.pointDiff > 0 ? "+" : "") + r.pointDiff + '</td>' +
          '<td style="font-family:var(--data)">' + U.esc(r.last10 || "—") + '</td><td class="num">' + Math.round(r.elo) + '</td><td class="num">' + r.gblRating.toFixed(3) + '</td></tr>';
      }).join("") + "</tbody></table></div>";
  }

  window.APP_DATA.loadAppData().then(function (data) {
    CACHE = data;
    if (!data.meta.standings.ok) {
      document.getElementById("stage-filters").innerHTML = "";
      document.getElementById("standings-table").innerHTML = R.errorBlock(data.meta.standings.error, "feed_standings");
      return;
    }
    renderFilters(data);
    renderTable(data);
  }).catch(function (err) {
    document.getElementById("standings-table").innerHTML = R.errorBlock(err && err.code, "a data feed");
  });
})();
