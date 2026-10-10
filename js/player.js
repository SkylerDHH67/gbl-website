(function () {
  "use strict";
  var U = window.APP_UTILS, R = window.APP_RENDER;

  function getParam(name) { return new URLSearchParams(window.location.search).get(name); }

  function render(data) {
    var el = document.getElementById("player-content");
    var playerId = getParam("id");
    var player = data.players.filter(function (p) { return p.playerId === playerId; })[0];
    if (!player) { el.innerHTML = R.emptyBlock("Player not found", "This player may be inactive or the link may be out of date."); return; }

    var rows = data.standings.filter(function (s) { return s.playerId === playerId; });

    // "Current" stage = whichever stage row has the most recent match date
    // for this player; falls back to stage order when no dated matches
    // exist yet. Record/GBL Rating below reflect only this stage - not a
    // sum across every stage the player has ever appeared in - per
    // Skyler's request that the profile reflect "now", not career totals.
    var lastDateByStage = {};
    data.matches.filter(function (m) { return m.playerAId === playerId || m.playerBId === playerId; }).forEach(function (m) {
      var t = new Date(m.date).getTime();
      if (!isNaN(t) && (!lastDateByStage[m.stageId] || t > lastDateByStage[m.stageId])) lastDateByStage[m.stageId] = t;
    });
    var sortedRows = rows.slice().sort(function (a, b) {
      var ta = lastDateByStage[a.stageId], tb = lastDateByStage[b.stageId];
      if (ta !== undefined || tb !== undefined) return (tb || 0) - (ta || 0);
      var sa = data.stages[a.stageId], sb = data.stages[b.stageId];
      return ((sb && sb.order) || 0) - ((sa && sa.order) || 0);
    });
    var currentRow = sortedRows.length ? sortedRows[0] : null;
    var currentStage = currentRow ? data.stages[currentRow.stageId] : null;
    var stageIsActive = !!(currentStage && currentStage.seasonId && data.seasonStatus[currentStage.seasonId] &&
      String(data.seasonStatus[currentStage.seasonId]).toLowerCase() === "active");
    var stageLabel = currentStage ? ((data.seasons[currentStage.seasonId] || "") + " — " + (currentStage.name || currentRow.stageId)) : (currentRow ? currentRow.stageId : "—");

    var latestElo = rows.length ? rows[0].elo : null; // Elo is season-wide, identical across every stage row for this player
    var currentRating = currentRow ? currentRow.gblRating : null;

    var avatar = player.badgeLogoUrl
      ? '<img src="' + U.esc(player.badgeLogoUrl) + '" style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:2px solid var(--line);box-shadow:0 0 0 4px rgba(95,216,236,0.08);" onerror="this.style.display=\'none\'">'
      : '<div style="width:120px;height:120px;border-radius:50%;background:var(--bg-card);border:2px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:2.6rem;font-weight:700;">' + U.esc((player.displayName || "?").slice(0,1).toUpperCase()) + '</div>';

    var countryLine = (player.flagEmoji || player.country)
      ? '<div class="subtle-country">' + (player.flagEmoji ? '<span class="flag">' + U.esc(player.flagEmoji) + '</span>' : '') + U.esc(player.country || "") + '</div>'
      : '';

    var html = '<div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap;">' + avatar +
      '<div><h1 class="page-title">' + U.esc(player.displayName) + '</h1>' + countryLine +
      (player.bio ? '<p class="section-sub" style="margin-top:8px;">' + U.esc(player.bio) + '</p>' : '') + '</div></div>';

    html += '<div class="grid grid-4" style="margin-top:20px;">' +
      '<div class="stat-card"><div class="label">Record' + (currentRow && !stageIsActive ? ' <span style="color:var(--text-faint);font-weight:400;">(stage inactive)</span>' : '') + '</div><div class="value">' + (currentRow ? currentRow.wins + '-' + currentRow.losses : "—") + '</div></div>' +
      '<div class="stat-card"><div class="label">Elo</div><div class="value">' + (latestElo !== null ? Math.round(latestElo) : "—") + '</div></div>' +
      '<div class="stat-card"><div class="label">GBL Win Rating</div><div class="value">' + (currentRating !== null ? currentRating.toFixed(3) : "—") + '</div></div>' +
      '<div class="stat-card"><div class="label">Last Stage</div><div class="value" style="font-size:1rem;">' + U.esc(stageLabel) + '</div>' +
      (currentRow ? '<div style="margin-top:4px;"><span class="badge' + (stageIsActive ? " live" : "") + '">' + (stageIsActive ? '<span class="dot"></span>ACTIVE' : "NOT ACTIVE") + '</span></div>' : '') + '</div>' +
      '</div>';

    if (rows.length) {
      html += '<section class="panel" style="margin-top:20px;"><h2 class="section-title">Season History</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Stage</th><th class="num">Rank</th><th class="num">W-L</th><th class="num">Last 10</th><th class="num">GBL Rating</th></tr></thead><tbody>' +
        rows.map(function (r) {
          var st = data.stages[r.stageId];
          var label = st ? ((data.seasons[st.seasonId] || "") + " — " + (st.name || r.stageId)) : r.stageId;
          return '<tr><td>' + U.esc(label) + '</td><td class="num">' + U.ordinal(r.rank) + '</td><td class="num">' + r.wins + '-' + r.losses + '</td><td class="num" style="font-family:var(--data)">' + U.esc(r.last10 || "—") + '</td><td class="num">' + r.gblRating.toFixed(3) + '</td></tr>';
        }).join("") + '</tbody></table></div></section>';
    } else {
      html += '<div class="panel" style="margin-top:20px;">' + R.emptyBlock("No completed matches yet") + '</div>';
    }

    html += '<div class="panel" style="margin-top:16px; color:var(--text-faint); font-size:0.85rem;">Build usage, matchup history, and deeper analytics for this player are part of the Stats Lab, coming in a later update.</div>';

    el.innerHTML = html;
  }

  window.APP_DATA.loadAppData().then(function (data) {
    if (!data.meta.players.ok) { document.getElementById("player-content").innerHTML = R.errorBlock(data.meta.players.error, "feed_players"); return; }
    render(data);
  }).catch(function (err) {
    document.getElementById("player-content").innerHTML = R.errorBlock(err && err.code, "a data feed");
  });
})();
