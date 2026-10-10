(function () {
  "use strict";
  var U = window.APP_UTILS, R = window.APP_RENDER;
  var LOW_SAMPLE_THRESHOLD = 5; // fewer than this many uses gets a "small sample" flag rather than being presented as equivalent to a heavily-used build

  var ALL_ROWS = [];
  var filterText = "";
  var filterPlayerId = "";

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

  // Composes "Shatter Horus / 1-60 / Hexa" from a build's three slots, in
  // slot order (Blade/Ratchet/Bit by convention). Falls back to the raw
  // part_id for any slot whose part can't be found in the Parts Catalog
  // feed, and returns null entirely if the build itself isn't in the
  // Builds feed (older/removed build, or test data) - callers fall back
  // to the bare build_id in that case.
  function fullBuildLabel(build, partsById) {
    if (!build) return null;
    var slots = [build.slot1PartId, build.slot2PartId, build.slot3PartId].filter(Boolean);
    if (!slots.length) return null;
    return slots.map(function (pid) {
      var p = partsById[pid];
      return (p && p.displayName) || pid;
    }).join(" / ");
  }

  // Small inline thumbnail of just the Blade part (identified by its
  // slot's role being "Blade", not by position, so this stays correct
  // even if a build's slots were ever entered out of order). Degrades to
  // nothing if the build or its blade's image_url isn't available.
  function bladeImageHTML(build, partsById) {
    if (!build) return "";
    var slots = [
      { pid: build.slot1PartId, role: build.slot1Role },
      { pid: build.slot2PartId, role: build.slot2Role },
      { pid: build.slot3PartId, role: build.slot3Role }
    ];
    var bladeSlot = slots.filter(function (s) { return String(s.role || "").toLowerCase() === "blade"; })[0];
    var part = bladeSlot && partsById[bladeSlot.pid];
    if (!part || !part.imageUrl) return "";
    return '<img class="blade-thumb" src="' + U.esc(part.imageUrl) + '" alt="" loading="lazy" onerror="this.remove()">';
  }

  function render(data) {
    var el = document.getElementById("builds-table");
    var playerLookup = R.playerLookup(data.players);
    var partsById = partsLookup(data.parts);
    var buildsById = buildsLookup(data.builds);

    var rows = ALL_ROWS.filter(function (r) {
      if (filterPlayerId && r.playerId !== filterPlayerId) return false;
      if (!filterText) return true;
      var build = buildsById[r.buildId];
      var label = (fullBuildLabel(build, partsById) || r.buildId).toLowerCase();
      var pName = playerLookup(r.playerId).displayName.toLowerCase();
      return label.indexOf(filterText) !== -1 || pName.indexOf(filterText) !== -1;
    });

    if (!rows.length) {
      el.innerHTML = ALL_ROWS.length
        ? R.emptyBlock("No builds match your filters", "Try clearing the search or player filter.")
        : R.emptyBlock("No build data yet", "Build stats appear once battles have been logged.");
      return;
    }

    el.innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr><th>Build</th><th>Player</th><th class="num">Used</th><th class="num">Won</th><th class="num">Win Rate</th><th class="num">Pts/Battle</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var p = playerLookup(r.playerId);
        var build = buildsById[r.buildId];
        var label = fullBuildLabel(build, partsById) || r.buildId;
        var img = bladeImageHTML(build, partsById);
        var lowSample = r.timesUsed < LOW_SAMPLE_THRESHOLD;
        // Sample-size badge goes BEFORE the number, not after - so the
        // number itself is always the rightmost thing in this right-
        // aligned cell and lines up vertically down the column whether or
        // not a given row happens to show the badge. (Badge-after-number
        // was why Used looked misaligned: it pushed the rightmost edge
        // out depending on whether a row sum qualified for a badge.)
        var sampleBadge = lowSample ? '<span class="badge" title="Small sample size">n&lt;' + LOW_SAMPLE_THRESHOLD + '</span> ' : '';
        return '<tr><td><span class="build-cell">' + img + '<span style="font-family:var(--data)">' + U.esc(label) + '</span></span></td>' +
          '<td>' + U.esc(p.displayName) + '</td>' +
          '<td class="num">' + sampleBadge + r.timesUsed + '</td>' +
          '<td class="num">' + r.timesWon + '</td>' +
          '<td class="num">' + U.pct(r.winRate) + '</td>' +
          '<td class="num">' + r.pointsPerBattle.toFixed(2) + '</td></tr>';
      }).join("") + "</tbody></table></div>";
  }

  window.APP_DATA.loadAppData().then(function (data) {
    if (!data.meta.buildStats.ok) { document.getElementById("builds-table").innerHTML = R.errorBlock(data.meta.buildStats.error, "feed_build_stats"); return; }

    ALL_ROWS = data.buildStats.slice().sort(function (a, b) { return b.timesUsed - a.timesUsed; });

    var playerSelect = document.getElementById("build-player-filter");
    var lookup = R.playerLookup(data.players);
    var seen = {};
    ALL_ROWS.forEach(function (r) {
      if (seen[r.playerId]) return;
      seen[r.playerId] = true;
      var opt = document.createElement("option");
      opt.value = r.playerId;
      opt.textContent = lookup(r.playerId).displayName;
      playerSelect.appendChild(opt);
    });

    render(data);

    document.getElementById("build-search").addEventListener("input", function (e) {
      filterText = e.target.value.trim().toLowerCase();
      render(data);
    });
    playerSelect.addEventListener("change", function (e) {
      filterPlayerId = e.target.value;
      render(data);
    });
  }).catch(function (err) {
    document.getElementById("builds-table").innerHTML = R.errorBlock(err && err.code, "a data feed");
  });
})();
