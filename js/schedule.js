(function () {
  "use strict";
  var U = window.APP_UTILS, R = window.APP_RENDER;
  var filter = "all";

  function combinedRows(data) {
    // Completed matches come from feed_matches (the source of truth for
    // finished games); anything not yet finished comes from feed_schedule.
    // A match_id present in both is shown once, preferring the completed
    // Match Database version.
    var completedIds = {};
    var rows = data.matches.map(function (m) {
      completedIds[m.matchId] = true;
      return { matchId: m.matchId, seasonId: m.seasonId, stageId: m.stageId, playerAId: m.playerAId, playerBId: m.playerBId, date: m.date, status: m.status, scoreA: m.finalScoreA, scoreB: m.finalScoreB, winnerPlayerId: m.winnerPlayerId };
    });
    data.schedule.forEach(function (m) {
      if (completedIds[m.matchId]) return;
      rows.push({ matchId: m.matchId, seasonId: m.seasonId, stageId: m.stageId, playerAId: m.playerAId, playerBId: m.playerBId, date: m.date, status: m.status, scoreA: null, scoreB: null, winnerPlayerId: null });
    });
    return rows;
  }

  function render(data, lookup) {
    var el = document.getElementById("matches-table");
    var rows = combinedRows(data);
    if (filter === "completed") rows = rows.filter(function (r) { return r.status === "COMPLETE"; });
    if (filter === "upcoming") rows = rows.filter(function (r) { return r.status !== "COMPLETE"; });
    rows.sort(function (a, b) {
      var da = a.date ? new Date(a.date).getTime() : Infinity, db = b.date ? new Date(b.date).getTime() : Infinity;
      return db - da; // most recent/soonest-unknown first isn't ideal for a mixed list, but recency-first reads naturally for a combined feed
    });
    if (!rows.length) { el.innerHTML = R.emptyBlock("No matches to show", "Try a different filter, or check back once matches are scheduled."); return; }
    el.innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Matchup</th><th class="num">Score</th><th>Status</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var a = lookup(r.playerAId), b = lookup(r.playerBId);
        var score = (r.scoreA === null || r.scoreA === undefined) ? "—" : (r.scoreA + "–" + r.scoreB);
        var matchup = U.esc(a.displayName) + ' <span style="color:var(--text-faint)">vs</span> ' + U.esc(b.displayName);
        var link = r.status === "COMPLETE" ? '<a href="match.html?id=' + encodeURIComponent(r.matchId) + '">' + matchup + "</a>" : matchup;
        return "<tr><td>" + U.fmtDate(r.date) + "</td><td>" + link + '</td><td class="num">' + score + "</td><td>" + R.statusBadge(r.status) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  window.APP_DATA.loadAppData().then(function (data) {
    var lookup = R.playerLookup(data.players);
    if (!data.meta.matches.ok && !data.meta.schedule.ok) {
      document.getElementById("matches-table").innerHTML = R.errorBlock(data.meta.matches.error, "feed_matches / feed_schedule");
      return;
    }
    render(data, lookup);
    document.querySelectorAll(".filter-bar .chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".filter-bar .chip").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        filter = btn.getAttribute("data-filter");
        render(data, lookup);
      });
    });
  }).catch(function (err) {
    document.getElementById("matches-table").innerHTML = R.errorBlock(err && err.code, "a data feed");
  });
})();
