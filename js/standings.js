(function () {
  "use strict";
  var U = window.APP_UTILS, R = window.APP_RENDER;
  var CACHE = null;
  var activeStageId = null;
  var sortKey = "gblRating";
  var sortDir = "desc";

  var COLUMNS = [
    { key: "rank", label: "#", sortable: false },
    { key: "player", label: "Player", sortable: true },
    { key: "matchesPlayed", label: "MP", num: true, sortable: true },
    { key: "wins", label: "W-L", num: true, sortable: true },
    { key: "winPct", label: "Win%", num: true, sortable: true },
    { key: "pointsFor", label: "PF", num: true, sortable: true },
    { key: "pointsAgainst", label: "PA", num: true, sortable: true },
    { key: "pointDiff", label: "Diff", num: true, sortable: true },
    { key: "last10", label: "Last 10", sortable: false },
    { key: "elo", label: "Elo", num: true, sortable: true },
    { key: "gblRating", label: "GBL Rating", num: true, sortable: true }
  ];

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
      btn.addEventListener("click", function () { activeStageId = btn.getAttribute("data-stage"); renderFilters(data); renderTable(data, R.playerLookup(data.players)); });
    });
  }

  function renderHeaderRow() {
    return "<tr>" + COLUMNS.map(function (c) {
      var cls = (c.num ? "num " : "") + (c.sortable ? "sortable" : "");
      var arrow = sortKey === c.key ? '<span class="sort-arrow">' + (sortDir === "asc" ? "▲" : "▼") + "</span>" : "";
      return '<th class="' + cls.trim() + '"' + (c.sortable ? ' data-sort-key="' + c.key + '"' : "") + '>' + U.esc(c.label) + arrow + "</th>";
    }).join("") + "</tr>";
  }

  function sortRows(rows, lookup) {
    var dir = sortDir === "asc" ? 1 : -1;
    return rows.slice().sort(function (a, b) {
      var av, bv;
      if (sortKey === "player") { av = lookup(a.playerId).displayName.toLowerCase(); bv = lookup(b.playerId).displayName.toLowerCase(); }
      else if (sortKey === "wins") { av = a.winPct; bv = b.winPct; } // W-L header sorts by win% since wins alone ignores losses
      else { av = a[sortKey]; bv = b[sortKey]; }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.rank - b.rank; // stable tiebreaker: fall back to official rank
    });
  }

  function renderTable(data, lookup) {
    var el = document.getElementById("standings-table");
    var baseRows = data.standings.filter(function (s) { return s.stageId === activeStageId; });
    if (!baseRows.length) { el.innerHTML = R.emptyBlock("No standings for this stage yet", "Standings appear once players have completed matches here."); return; }
    var rows = sortRows(baseRows, lookup);
    el.innerHTML = '<div class="table-wrap"><table class="data-table"><thead>' + renderHeaderRow() + '</thead><tbody>' + rows.map(function (r) {
        return '<tr><td class="rank-cell' + (r.rank <= 3 ? " top" : "") + '">' + r.rank + '</td>' +
          '<td>' + R.playerCellWithLogoHTML(lookup(r.playerId)) + '</td>' +
          '<td class="num">' + r.matchesPlayed + '</td><td class="num">' + r.wins + '-' + r.losses + '</td><td class="num">' + U.pct(r.winPct) + '</td>' +
          '<td class="num">' + r.pointsFor + '</td><td class="num">' + r.pointsAgainst + '</td><td class="num">' + (r.pointDiff > 0 ? "+" : "") + r.pointDiff + '</td>' +
          '<td style="font-family:var(--data)">' + U.esc(r.last10 || "—") + '</td><td class="num">' + Math.round(r.elo) + '</td><td class="num">' + r.gblRating.toFixed(3) + '</td></tr>';
      }).join("") + "</tbody></table></div>";

    el.querySelectorAll("th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.getAttribute("data-sort-key");
        if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
        else { sortKey = key; sortDir = "desc"; }
        renderTable(data, lookup);
      });
    });
  }

  window.APP_DATA.loadAppData().then(function (data) {
    CACHE = data;
    if (!data.meta.standings.ok) {
      document.getElementById("stage-filters").innerHTML = "";
      document.getElementById("standings-table").innerHTML = R.errorBlock(data.meta.standings.error, "feed_standings");
      return;
    }
    renderFilters(data);
    renderTable(data, R.playerLookup(data.players));
  }).catch(function (err) {
    document.getElementById("standings-table").innerHTML = R.errorBlock(err && err.code, "a data feed");
  });
})();
