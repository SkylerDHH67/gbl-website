(function () {
  "use strict";
  var U = window.APP_UTILS, R = window.APP_RENDER;
  var LOW_SAMPLE_THRESHOLD = 5; // fewer than this many uses gets a "small sample" flag rather than being presented as equivalent to a heavily-used build

  var ALL_ROWS = [];
  var filterText = "";
  var filterPlayerId = "";
  var filterBladePartId = "";
  var sortKey = "timesUsed";
  var sortDir = "desc"; // "asc" | "desc"
  var expandedBuildId = null; // only one build detail open at a time

  var COLUMNS = [
    { key: "build", label: "Build", sortable: true },
    { key: "player", label: "Player", sortable: true },
    { key: "timesUsed", label: "Used", num: true, sortable: true },
    { key: "timesWon", label: "Won", num: true, sortable: true },
    { key: "timesLost", label: "Lost", num: true, sortable: true },
    { key: "winRate", label: "Win Rate", num: true, sortable: true },
    { key: "pointsScored", label: "Pts Scored", num: true, sortable: true },
    { key: "pointsPerBattle", label: "Pts/Battle", num: true, sortable: true }
  ];


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

  // bladeSlot/fullBuildLabel live in render.js (shared with Stats Lab and
  // Player Profile) so build-label formatting - including the ratchet
  // "1-60" display convention and never falling back to a raw build_id -
  // can't drift between pages.
  var bladeSlot = R.bladeSlotOf;

  // Small inline thumbnail of just the Blade part. A same-size placeholder
  // renders when there's no image (rather than nothing at all) so every
  // row stays the same height - a missing image on some rows but not
  // others was making rows look unevenly spaced/misaligned.
  function bladeImageHTML(build, partsById) {
    var slot = bladeSlot(build);
    var part = slot && partsById[slot.pid];
    if (part && part.imageUrl) {
      return '<img class="blade-thumb" src="' + U.esc(part.imageUrl) + '" alt="" loading="lazy" onerror="this.outerHTML=\'<span class=&quot;blade-thumb-placeholder&quot;></span>\'">';
    }
    return '<span class="blade-thumb-placeholder"></span>';
  }

  function enrichRow(r, partsById, buildsById, playerLookup) {
    var build = buildsById[r.buildId];
    var slot = bladeSlot(build);
    var bladePart = slot && partsById[slot.pid];
    return {
      raw: r,
      build: build,
      label: R.buildLabelOrFallback(build, partsById, r.buildId),
      bladePartId: slot ? slot.pid : "",
      bladeName: bladePart ? bladePart.displayName : "",
      playerName: playerLookup(r.playerId).displayName,
      timesUsed: r.timesUsed, timesWon: r.timesWon, timesLost: Math.max(0, r.timesUsed - r.timesWon),
      winRate: r.winRate, pointsScored: r.pointsScored, pointsPerBattle: r.pointsPerBattle,
      finishDistribution: r.finishDistribution || {}
    };
  }

  function buildDetailHTML(e) {
    return '<div style="padding:14px 16px;">' +
      '<div class="eyebrow" style="margin-bottom:10px;">Finish Breakdown — ' + U.esc(e.label) + '</div>' +
      R.finishBarHTML(e.finishDistribution) +
      '<div style="display:flex;gap:22px;flex-wrap:wrap;margin-top:14px;font-size:0.85rem;color:var(--text-dim);">' +
      '<span><strong style="color:var(--text);">' + U.pct(e.winRate) + '</strong> win rate</span>' +
      '<span><strong style="color:var(--text);">' + e.pointsScored + '</strong> pts scored</span>' +
      '<span><strong style="color:var(--text);">' + e.pointsPerBattle.toFixed(2) + '</strong> pts/battle</span>' +
      '<span><strong style="color:var(--text);">' + e.timesWon + '-' + e.timesLost + '</strong> battle record</span>' +
      '</div></div>';
  }

  function sortRows(rows) {
    var dir = sortDir === "asc" ? 1 : -1;
    return rows.slice().sort(function (a, b) {
      var av, bv;
      if (sortKey === "build") { av = a.label.toLowerCase(); bv = b.label.toLowerCase(); }
      else if (sortKey === "player") { av = a.playerName.toLowerCase(); bv = b.playerName.toLowerCase(); }
      else { av = a[sortKey]; bv = b[sortKey]; }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }

  function renderHeaderRow() {
    return "<tr>" + COLUMNS.map(function (c) {
      var cls = (c.num ? "num " : "") + (c.sortable ? "sortable" : "");
      var arrow = sortKey === c.key ? '<span class="sort-arrow">' + (sortDir === "asc" ? "▲" : "▼") + "</span>" : "";
      return '<th class="' + cls.trim() + '" data-sort-key="' + c.key + '">' + c.label + arrow + "</th>";
    }).join("") + "</tr>";
  }

  function render(data) {
    var el = document.getElementById("builds-table");
    var playerLookup = R.playerLookup(data.players);
    var partsById = partsLookup(data.parts);
    var buildsById = buildsLookup(data.builds);

    var enriched = ALL_ROWS.map(function (r) { return enrichRow(r, partsById, buildsById, playerLookup); });

    var filtered = enriched.filter(function (e) {
      if (filterPlayerId && e.raw.playerId !== filterPlayerId) return false;
      if (filterBladePartId && e.bladePartId !== filterBladePartId) return false;
      if (filterText) {
        var hit = e.label.toLowerCase().indexOf(filterText) !== -1 || e.playerName.toLowerCase().indexOf(filterText) !== -1;
        if (!hit) return false;
      }
      return true;
    });

    if (!filtered.length) {
      el.innerHTML = enriched.length
        ? R.emptyBlock("No builds match your filters", "Try clearing the search, player, or blade filter.")
        : R.emptyBlock("No build data yet", "Build stats appear once battles have been logged.");
      return;
    }

    var rows = sortRows(filtered);
    var colCount = COLUMNS.length;

    el.innerHTML = '<div class="table-wrap"><table class="data-table"><thead>' + renderHeaderRow() + '</thead><tbody>' +
      rows.map(function (e) {
        var img = bladeImageHTML(e.build, partsById);
        var lowSample = e.timesUsed < LOW_SAMPLE_THRESHOLD;
        var sampleBadge = lowSample ? '<span class="badge" title="Small sample size">n&lt;' + LOW_SAMPLE_THRESHOLD + '</span>' : '';
        var isOpen = expandedBuildId === e.raw.buildId;
        var rowHTML = '<tr class="build-row" data-build-id="' + U.esc(e.raw.buildId) + '" style="cursor:pointer;">' +
          '<td><span class="build-cell"><span class="sort-arrow" style="opacity:0.5;">' + (isOpen ? "▾" : "▸") + '</span>' + img + '<span style="font-family:var(--data)">' + U.esc(e.label) + '</span></span></td>' +
          '<td>' + U.esc(e.playerName) + '</td>' +
          '<td class="num"><span class="num-cell">' + sampleBadge + e.timesUsed + '</span></td>' +
          '<td class="num"><span class="num-cell">' + e.timesWon + '</span></td>' +
          '<td class="num"><span class="num-cell">' + e.timesLost + '</span></td>' +
          '<td class="num"><span class="num-cell">' + U.pct(e.winRate) + '</span></td>' +
          '<td class="num"><span class="num-cell">' + e.pointsScored + '</span></td>' +
          '<td class="num"><span class="num-cell">' + e.pointsPerBattle.toFixed(2) + '</span></td></tr>';
        if (isOpen) {
          rowHTML += '<tr class="build-detail-row"><td colspan="' + colCount + '" style="padding:0;background:var(--bg-elevated);">' + buildDetailHTML(e) + '</td></tr>';
        }
        return rowHTML;
      }).join("") + "</tbody></table></div>";

    el.querySelectorAll("th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.getAttribute("data-sort-key");
        if (sortKey === key) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortKey = key;
          sortDir = "desc";
        }
        render(data);
      });
    });

    el.querySelectorAll("tr.build-row").forEach(function (tr) {
      tr.addEventListener("click", function () {
        var id = tr.getAttribute("data-build-id");
        expandedBuildId = expandedBuildId === id ? null : id;
        render(data);
      });
    });
  }

  window.APP_DATA.loadAppData().then(function (data) {
    if (!data.meta.buildStats.ok) { document.getElementById("builds-table").innerHTML = R.errorBlock(data.meta.buildStats.error, "feed_build_stats"); return; }

    ALL_ROWS = data.buildStats.slice();

    var playerLookup = R.playerLookup(data.players);
    var partsById = partsLookup(data.parts);
    var buildsById = buildsLookup(data.builds);

    var playerSelect = document.getElementById("build-player-filter");
    var bladeSelect = document.getElementById("build-blade-filter");
    var seenPlayers = {}, seenBlades = {};

    ALL_ROWS.forEach(function (r) {
      if (!seenPlayers[r.playerId]) {
        seenPlayers[r.playerId] = true;
        var pOpt = document.createElement("option");
        pOpt.value = r.playerId;
        pOpt.textContent = playerLookup(r.playerId).displayName;
        playerSelect.appendChild(pOpt);
      }
      var slot = bladeSlot(buildsById[r.buildId]);
      if (slot && !seenBlades[slot.pid]) {
        seenBlades[slot.pid] = true;
        var part = partsById[slot.pid];
        var bOpt = document.createElement("option");
        bOpt.value = slot.pid;
        bOpt.textContent = (part && part.displayName) || slot.pid;
        bladeSelect.appendChild(bOpt);
      }
    });

    // Sort each dropdown's options alphabetically (first/placeholder option stays put).
    [playerSelect, bladeSelect].forEach(function (sel) {
      var opts = Array.prototype.slice.call(sel.options, 1);
      opts.sort(function (a, b) { return a.textContent.localeCompare(b.textContent); });
      opts.forEach(function (o) { sel.appendChild(o); });
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
    bladeSelect.addEventListener("change", function (e) {
      filterBladePartId = e.target.value;
      render(data);
    });
  }).catch(function (err) {
    document.getElementById("builds-table").innerHTML = R.errorBlock(err && err.code, "a data feed");
  });
})();
