(function () {
  "use strict";
  var U = window.APP_UTILS, R = window.APP_RENDER;
  var LOW_SAMPLE_THRESHOLD = 5; // fewer than this many uses gets a "small sample" flag rather than being presented as equivalent to a heavily-used build

  window.APP_DATA.loadAppData().then(function (data) {
    var el = document.getElementById("builds-table");
    if (!data.meta.buildStats.ok) { el.innerHTML = R.errorBlock(data.meta.buildStats.error, "feed_build_stats"); return; }
    var lookup = R.playerLookup(data.players);
    var rows = data.buildStats.slice().sort(function (a, b) { return b.timesUsed - a.timesUsed; });
    if (!rows.length) { el.innerHTML = R.emptyBlock("No build data yet", "Build stats appear once battles have been logged."); return; }

    el.innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr><th>Build</th><th>Player</th><th class="num">Used</th><th class="num">Won</th><th class="num">Win Rate</th><th class="num">Pts/Battle</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var p = lookup(r.playerId);
        var lowSample = r.timesUsed < LOW_SAMPLE_THRESHOLD;
        return '<tr><td style="font-family:var(--data)">' + U.esc(r.buildId) + '</td><td>' + U.esc(p.displayName) + '</td>' +
          '<td class="num">' + r.timesUsed + (lowSample ? ' <span class="badge" title="Small sample size">n&lt;' + LOW_SAMPLE_THRESHOLD + '</span>' : '') + '</td>' +
          '<td class="num">' + r.timesWon + '</td><td class="num">' + U.pct(r.winRate) + '</td><td class="num">' + r.pointsPerBattle.toFixed(2) + '</td></tr>';
      }).join("") + "</tbody></table></div>";
  }).catch(function (err) {
    document.getElementById("builds-table").innerHTML = R.errorBlock(err && err.code, "a data feed");
  });
})();
