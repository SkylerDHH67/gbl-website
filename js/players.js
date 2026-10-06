(function () {
  "use strict";
  var U = window.APP_UTILS, R = window.APP_RENDER;
  var ALL_PLAYERS = [];

  function card(p, ratingByPlayer) {
    var rating = ratingByPlayer[p.playerId];
    var avatar = p.badgeLogoUrl
      ? '<img class="player-avatar" style="width:44px;height:44px;" src="' + U.esc(p.badgeLogoUrl) + '" alt="" onerror="this.style.display=\'none\'">'
      : '<div class="player-avatar" style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-weight:700;">' + U.esc((p.displayName || "?").slice(0,1).toUpperCase()) + '</div>';
    return '<a class="panel" style="display:flex;gap:12px;align-items:center;" href="player.html?id=' + encodeURIComponent(p.playerId) + '">' +
      avatar +
      '<div><div style="font-weight:700;">' + (p.flagEmoji ? U.esc(p.flagEmoji) + " " : "") + U.esc(p.displayName) + '</div>' +
      '<div style="font-size:0.8rem;color:var(--text-dim);">' + U.esc(p.country || "") + (rating !== undefined ? ' · Rating ' + rating.toFixed(3) : "") + '</div></div></a>';
  }

  function render(players, ratingByPlayer) {
    var el = document.getElementById("players-grid");
    if (!players.length) { el.innerHTML = R.emptyBlock("No players found"); return; }
    el.innerHTML = players.map(function (p) { return card(p, ratingByPlayer); }).join("");
  }

  window.APP_DATA.loadAppData().then(function (data) {
    if (!data.meta.players.ok) { document.getElementById("players-grid").innerHTML = R.errorBlock(data.meta.players.error, "feed_players"); return; }
    ALL_PLAYERS = data.players.filter(function (p) { return String(p.status).toLowerCase() === "active"; });
    var ratingByPlayer = {};
    data.standings.forEach(function (s) { ratingByPlayer[s.playerId] = s.gblRating; }); // last write wins - fine for a rough directory-card hint
    render(ALL_PLAYERS, ratingByPlayer);
    document.getElementById("player-search").addEventListener("input", function (e) {
      var q = e.target.value.trim().toLowerCase();
      var filtered = !q ? ALL_PLAYERS : ALL_PLAYERS.filter(function (p) { return p.displayName.toLowerCase().indexOf(q) !== -1; });
      render(filtered, ratingByPlayer);
    });
  }).catch(function (err) {
    document.getElementById("players-grid").innerHTML = R.errorBlock(err && err.code, "a data feed");
  });
})();
