(function () {
  "use strict";
  var U = window.APP_UTILS, R = window.APP_RENDER;
  var filter = "all";
  var playerFilterId = "";

  // Completed matches come from feed_matches - the Battle Event Log /
  // Match Database pipeline, fully automated from the scorekeeper tool.
  // Upcoming matches come from feed_upcoming - a separate, fully manual
  // tab the league admin hand-edits purely for public preview. These are
  // deliberately decoupled: feed_upcoming has no player_id/match_id
  // foreign keys and isn't read by the Live Match Engine at all, so
  // editing tomorrow's hype list can never affect a live match setup.
  // Dates on manual rows are free text ("TBD" is fine) rather than a
  // real timestamp, so manual rows can't be reliably date-sorted against
  // completed ones - they're always shown above completed matches instead.
  function combinedRows(data, byName) {
    var completed = data.matches.map(function (m) {
      return {
        isManual: false, matchId: m.matchId, date: m.date, status: m.status,
        scoreA: m.finalScoreA, scoreB: m.finalScoreB,
        playerAId: m.playerAId, playerBId: m.playerBId
      };
    });
    // Manual "Upcoming Matches" rows are hand-typed names with no
    // player_id by design (see note above) - resolved against the real
    // Players list here ONLY so the player filter below can match them too;
    // nothing else about how these rows render depends on the match.
    var upcoming = data.upcoming.map(function (u) {
      var manA = byName(u.playerAName), manB = byName(u.playerBName);
      return {
        isManual: true, matchId: null, date: u.date, status: "SCHEDULED",
        scoreA: null, scoreB: null,
        playerAName: u.playerAName, playerBName: u.playerBName, note: u.note,
        playerAId: manA ? manA.playerId : null, playerBId: manB ? manB.playerId : null
      };
    });
    return { completed: completed, upcoming: upcoming };
  }

  function render(data, lookup) {
    var el = document.getElementById("matches-table");
    var byName = R.playerLookupByName(data.players);
    var rows = combinedRows(data, byName);
    var all = [];
    if (filter !== "completed") all = all.concat(rows.upcoming);
    if (filter !== "upcoming") all = all.concat(rows.completed.sort(function (a, b) { return new Date(b.date) - new Date(a.date); }));

    if (playerFilterId) {
      all = all.filter(function (r) { return r.playerAId === playerFilterId || r.playerBId === playerFilterId; });
    }

    if (!all.length) { el.innerHTML = R.emptyBlock("No matches to show", playerFilterId ? "This player has no matches under the current filter." : "Try a different filter, or check back once matches are scheduled."); return; }
    el.innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Matchup</th><th class="num">Score</th><th>Status</th></tr></thead><tbody>' +
      all.map(function (r) {
        var matchup, score = (r.scoreA === null || r.scoreA === undefined) ? "—" : (r.scoreA + "–" + r.scoreB);
        if (r.isManual) {
          var manA = byName(r.playerAName), manB = byName(r.playerBName);
          matchup = '<div class="matchup-faces">' + R.playerLogoHTML(manA) +
            '<span>' + U.esc(r.playerAName) + ' <span style="color:var(--text-faint)">vs</span> ' + U.esc(r.playerBName) + '</span>' +
            R.playerLogoHTML(manB) + '</div>' +
            (r.note ? '<div style="font-size:0.78rem;color:var(--text-faint);font-style:italic;margin-top:2px;">' + U.esc(r.note) + "</div>" : "");
        } else {
          var a = lookup(r.playerAId), b = lookup(r.playerBId);
          var plain = U.esc(a.displayName) + ' <span style="color:var(--text-faint)">vs</span> ' + U.esc(b.displayName);
          matchup = r.status === "COMPLETE" ? '<a href="match.html?id=' + encodeURIComponent(r.matchId) + '">' + plain + "</a>" : plain;
        }
        return "<tr><td>" + (r.isManual ? U.esc(r.date || "TBD") : U.fmtDate(r.date)) + "</td><td>" + matchup + '</td><td class="num">' + score + "</td><td>" + R.statusBadge(r.status) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  window.APP_DATA.loadAppData().then(function (data) {
    var lookup = R.playerLookup(data.players);
    if (!data.meta.matches.ok && !data.meta.upcoming.ok) {
      document.getElementById("matches-table").innerHTML = R.errorBlock(data.meta.matches.error, "feed_matches / feed_upcoming");
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

    var playerSelect = document.getElementById("sched-player-filter");
    data.players.slice().sort(function (a, b) { return a.displayName.localeCompare(b.displayName); }).forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.playerId;
      opt.textContent = p.displayName;
      playerSelect.appendChild(opt);
    });
    playerSelect.addEventListener("change", function (e) {
      playerFilterId = e.target.value;
      render(data, lookup);
    });
  }).catch(function (err) {
    document.getElementById("matches-table").innerHTML = R.errorBlock(err && err.code, "a data feed");
  });
})();
