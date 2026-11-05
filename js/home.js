(function () {
  "use strict";
  var U = window.APP_UTILS, R = window.APP_RENDER;

  function pickCurrentStage(data) {
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

  // Lightweight "this site is alive" indicator: current season label (data-
  // driven, never hardcoded) plus today's real-world date from the
  // visitor's own clock - not from a feed, so it's always accurate without
  // anyone having to update it.
  function renderHeroMeta(data, currentStageId) {
    var el = document.getElementById("hero-meta");
    if (!el) return;
    var stage = currentStageId ? data.stages[currentStageId] : null;
    var seasonLabel = stage ? (data.seasons[stage.seasonId] || stage.seasonId) : null;
    var today = new Date();
    var dateStr = today.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    var parts = [];
    if (seasonLabel) parts.push("<strong>" + U.esc(seasonLabel) + "</strong> season");
    parts.push("Today — " + U.esc(dateStr));
    el.innerHTML = parts.join(' <span class="dot-sep">•</span> ');
  }

  // Sourced from feed_media (Site Content tab): a row with type "youtube"
  // (preferred) or a social_link row whose title mentions YouTube. Only the
  // URL comes from the Sheet - the headline/subtext are fixed marketing
  // copy here, not pulled from the row's own title/description fields
  // (those are meant for the footer's social-link list, which is why a
  // placeholder like "TBD" in the description column was leaking into this
  // card before). Hidden entirely if no such row exists yet, rather than
  // showing a dead link.
  function renderYoutubeCallout(data) {
    var el = document.getElementById("hero-youtube");
    if (!el || !data.meta.media.ok) return;
    var row = data.media.filter(function (m) { return String(m.type).toLowerCase() === "youtube"; })[0] ||
      data.media.filter(function (m) { return String(m.type).toLowerCase() === "social_link" && /youtube/i.test(m.title); })[0];
    if (!row || !row.url) return;
    el.href = row.url;
    el.style.display = "flex";
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

  // Sourced from the manual "Upcoming Matches" tab (feed_upcoming), not
  // the live-match-engine Schedule tab - purely a hand-edited preview, so
  // names are plain text and there's no real date to sort by. Sheet row
  // order is treated as the admin's intended display order.
  function renderUpcoming(data) {
    var el = document.getElementById("home-upcoming");
    if (!data.meta.upcoming.ok) { el.innerHTML = R.errorBlock(data.meta.upcoming.error, "feed_upcoming"); return; }
    var upcoming = data.upcoming.slice(0, window.APP_CONFIG.HOME_SCHEDULE_COUNT);
    if (!upcoming.length) { el.innerHTML = R.emptyBlock("Nothing scheduled right now", "Check back once new matches are added to the Upcoming Matches tab."); return; }
    var byName = R.playerLookupByName(data.players);
    el.innerHTML = upcoming.map(function (m) {
      var a = byName(m.playerAName), b = byName(m.playerBName);
      return '<div class="result-row"><span class="matchup-faces">' + R.playerLogoHTML(a) +
        '<span>' + U.esc(m.playerAName) + ' <span style="color:var(--text-faint)">vs</span> ' + U.esc(m.playerBName) + '</span>' +
        R.playerLogoHTML(b) + '</span>' +
        '<span class="badge">' + U.esc(m.date || "TBD") + '</span></div>';
    }).join("");
  }

  function renderStandingsSnapshot(data, currentStageId) {
    var el = document.getElementById("home-standings");
    if (!data.meta.standings.ok) { el.innerHTML = R.errorBlock(data.meta.standings.error, "feed_standings"); return; }
    var rows = data.standings.filter(function (s) { return s.stageId === currentStageId; }).sort(function (a, b) { return a.rank - b.rank; }).slice(0, 5);
    if (!rows.length) { el.innerHTML = R.emptyBlock("No standings yet", "Standings appear once players have completed matches in this stage."); return; }
    var sequences = R.playerSequences(data);
    el.innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Player</th><th class="num">W-L</th><th class="center">Trend</th><th class="num">Rating</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td class="rank-cell">' + (r.rank <= 3 ? '<span class="rank-badge">' + r.rank + '</span>' : r.rank) + '</td><td><a href="player.html?id=' + encodeURIComponent(r.playerId) + '">' + U.esc(r.displayName) + '</a></td>' +
          '<td class="num">' + r.wins + '-' + r.losses + '</td><td class="center">' + R.trendBadgeHTML(sequences[r.playerId], 7) + '</td><td class="num">' + R.gblRatingDisplay(r.gblRating) + '</td></tr>';
      }).join("") + "</tbody></table></div>";
  }

  // League leaders is build-centric, not player-centric: ranks by win rate
  // among builds with enough battles to mean something (MIN_SAMPLE), same
  // statistical-integrity principle used everywhere else on this site -
  // a 1-0 build never outranks a proven one just because 100% > 90%.
  var BUILD_LEADER_MIN_SAMPLE = 3;

  // "Net blade rating" = pointsPerBattle (points scored per battle, across
  // all finish types) - the closest existing field to a single per-build
  // scoring-power number. Sorted on this first, since it's the headline
  // stat; win% and times-used ride along as context. Flagged to Skyler in
  // chat in case "net blade rating" was meant to be a different metric.
  function renderLeaders(data) {
    var el = document.getElementById("home-leaders");
    if (!data.meta.buildStats.ok) { el.innerHTML = R.errorBlock(data.meta.buildStats.error, "feed_build_stats"); return; }
    var qualified = data.buildStats.filter(function (b) { return b.timesUsed >= BUILD_LEADER_MIN_SAMPLE; });
    if (!qualified.length) {
      el.innerHTML = R.emptyBlock("No qualified builds yet", "A build needs at least " + BUILD_LEADER_MIN_SAMPLE + " battles before it shows up here.");
      return;
    }
    var top = qualified.sort(function (a, b) { return b.pointsPerBattle - a.pointsPerBattle || b.winRate - a.winRate; })
      .slice(0, window.APP_CONFIG.HOME_LEADERS_COUNT);
    var lookup = R.playerLookup(data.players);
    var partsById = {}; (data.parts || []).forEach(function (p) { partsById[p.partId] = p; });
    var buildsById = {}; (data.builds || []).forEach(function (b) { buildsById[b.buildId] = b; });
    var headerRow = '<div class="result-row" style="border-bottom:1px solid var(--line);padding-bottom:7px;">' +
      '<span style="font-family:var(--data);font-size:0.68rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-faint);">Build</span>' +
      '<span style="font-family:var(--data);font-size:0.68rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-faint);">Rtg · Win% · Used</span>' +
      '</div>';
    // Exactly two flex children per row (the rank+build group, and the
    // score) - a THIRD top-level child here used to make space-between
    // center the build text in the middle of the row instead of pinning
    // it next to the rank number, which is what was reading as "funky"
    // spacing. The rank+build group also truncates with an ellipsis
    // (min-width:0 + overflow:hidden) instead of wrapping or squeezing
    // the score column when a build/pilot name runs long.
    el.innerHTML = headerRow + top.map(function (r, i) {
      var pilot = lookup(r.playerId);
      var label = R.buildLabelOrFallback(buildsById[r.buildId], partsById, r.buildId);
      var rankHTML = i < 3 ? '<span class="rank-badge">' + (i + 1) + '</span>' : '<span class="rank-cell">' + (i + 1) + '.</span>';
      return '<div class="result-row">' +
        '<span style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">' + rankHTML +
          '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">' +
            '<span style="font-family:var(--data);font-weight:700;">' + U.esc(label) + '</span> ' +
            '<span style="color:var(--text-faint);font-size:0.82rem;">— ' + U.esc(pilot.displayName) + '</span>' +
          '</span>' +
        '</span>' +
        '<span class="result-score" style="flex-shrink:0;padding-left:10px;">' + r.pointsPerBattle.toFixed(2) + ' <span style="color:var(--text-faint);font-weight:400;font-size:0.78rem;">rtg</span>' +
        '<span style="color:var(--text-faint);font-weight:400;font-size:0.78rem;"> · ' + U.pct(r.winRate) + ' · ' + r.timesUsed + 'x</span></span></div>';
    }).join("");
  }

  // Local-calendar-day key, same "session = one day of play" convention
  // ticker.js uses for the score ticker - keeps the two features reading
  // as the same underlying concept rather than two different definitions
  // of "recent."
  function dayKey_(dateVal) {
    var d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;
    return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
  }

  // A build needs this many battles within the 2-session window before it's
  // eligible to be called "hot" or "cold" - otherwise a build that was tried
  // once and happened to win would misleadingly headline the home page.
  var SPOTLIGHT_MIN_BATTLES = 10;

  function spotlightCardHTML_(title, b, color) {
    return '<div style="flex:1;min-width:170px;">' +
      '<div class="eyebrow" style="margin-bottom:4px;">' + U.esc(title) + '</div>' +
      '<div style="font-family:var(--data);font-weight:700;color:' + color + ';">' + U.esc(b.label) + '</div>' +
      '<div style="color:var(--text-faint);font-size:0.82rem;margin-top:2px;">' + U.pct(b.winRate) + ' win rate · ' + b.won + '-' + (b.used - b.won) + ' (' + b.used + ')</div>' +
      '</div>';
  }

  // "Hot"/"Cold" is always relative to the two most recent sessions (days
  // with completed matches) - not an all-time or fixed-count window - so
  // the spotlight is always about what just happened, and automatically
  // moves on once newer sessions are played, same as the score ticker.
  function renderSpotlight(data) {
    var el = document.getElementById("home-spotlight");
    if (!data.meta.matches.ok || !data.meta.statsLabSource.ok) { el.innerHTML = R.errorBlock((data.meta.matches.error || data.meta.statsLabSource.error), "feed_matches / feed_stats_lab_source"); return; }

    var completed = data.matches.filter(function (m) { return m.status === "COMPLETE" && m.date; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    if (!completed.length) { el.innerHTML = R.emptyBlock("No sessions played yet", "Spotlight appears once matches have been completed."); return; }

    var seenDays = {}, recentDays = [];
    completed.forEach(function (m) {
      var k = dayKey_(m.date);
      if (k && !seenDays[k]) { seenDays[k] = true; recentDays.push(k); }
    });
    recentDays = recentDays.slice(0, 2);
    var recentDaySet = {}; recentDays.forEach(function (k) { recentDaySet[k] = true; });

    var matchesById = {}; data.matches.forEach(function (m) { matchesById[m.matchId] = m; });
    var partsById = {}; (data.parts || []).forEach(function (p) { partsById[p.partId] = p; });
    var buildsById = {}; (data.builds || []).forEach(function (b) { buildsById[b.buildId] = b; });

    var tally = {};
    data.statsLabSource.forEach(function (b) {
      var m = matchesById[b.matchId];
      if (!m || !recentDaySet[dayKey_(m.date)]) return;
      [{ id: b.buildIdA, won: b.winnerPlayerId === b.playerAId }, { id: b.buildIdB, won: b.winnerPlayerId === b.playerBId }].forEach(function (s) {
        if (!s.id) return;
        tally[s.id] = tally[s.id] || { used: 0, won: 0 };
        tally[s.id].used++;
        if (s.won) tally[s.id].won++;
      });
    });

    var qualified = Object.keys(tally).filter(function (id) { return tally[id].used >= SPOTLIGHT_MIN_BATTLES; })
      .map(function (id) {
        var t = tally[id];
        return { id: id, used: t.used, won: t.won, winRate: t.used ? t.won / t.used : 0, label: R.buildLabelOrFallback(buildsById[id], partsById, id) };
      });

    if (!qualified.length) {
      el.innerHTML = R.emptyBlock("Not enough recent battles yet", "A build needs at least " + SPOTLIGHT_MIN_BATTLES + " battles across the last " + recentDays.length + " session" + (recentDays.length === 1 ? "" : "s") + " to show up here.");
      return;
    }

    qualified.sort(function (a, b) { return b.winRate - a.winRate || b.used - a.used; });
    var hot = qualified[0];
    var cold = qualified[qualified.length - 1];
    var showCold = qualified.length > 1 && cold.id !== hot.id;

    el.innerHTML = '<div style="display:flex;gap:18px;flex-wrap:wrap;">' +
      spotlightCardHTML_("Hot Build", hot, "var(--xtreme)") +
      (showCold ? spotlightCardHTML_("Cold Build", cold, "var(--spin)") : "") +
      '</div>' +
      '<p class="section-sub" style="margin-top:10px;">Based on the last ' + recentDays.length + ' session' + (recentDays.length === 1 ? "" : "s") + ' of play (minimum ' + SPOTLIGHT_MIN_BATTLES + ' battles).</p>';
  }

  // Simply the pairing with the most total meetings, all-time - not scoped
  // to recent sessions like Spotlight above, since a rivalry is about
  // accumulated history, not a given week's play.
  function renderRivalry(data) {
    var el = document.getElementById("home-rivalry");
    if (!data.meta.headToHead.ok) { el.innerHTML = R.errorBlock(data.meta.headToHead.error, "feed_head_to_head"); return; }
    var candidates = data.headToHead.filter(function (h) { return h.matches > 0; });
    if (!candidates.length) { el.innerHTML = R.emptyBlock("No rivalries yet", "This fills in once two players have met more than once."); return; }
    var top = candidates.slice().sort(function (a, b) { return b.matches - a.matches; })[0];
    var lookup = R.playerLookup(data.players);
    var x = lookup(top.playerX), y = lookup(top.playerY);
    el.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;gap:16px;">' +
        '<a href="player.html?id=' + encodeURIComponent(x.playerId) + '" style="display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;">' + R.playerLogoHTML(x) + '<span style="font-weight:700;">' + U.esc(x.displayName) + '</span></a>' +
        '<div style="font-family:var(--data);font-size:1.4rem;font-weight:700;">' + top.xWins + ' – ' + top.yWins + '</div>' +
        '<a href="player.html?id=' + encodeURIComponent(y.playerId) + '" style="display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;">' + R.playerLogoHTML(y) + '<span style="font-weight:700;">' + U.esc(y.displayName) + '</span></a>' +
      '</div>' +
      '<p class="section-sub" style="text-align:center;margin-top:10px;">' + top.matches + ' total meeting' + (top.matches === 1 ? "" : "s") + ' — the league’s most-played rivalry.</p>';
  }

  window.APP_DATA.loadAppData().then(function (data) {
    var lookup = R.playerLookup(data.players);
    var currentStageId = pickCurrentStage(data);
    renderHero(data, currentStageId);
    renderHeroMeta(data, currentStageId);
    renderYoutubeCallout(data);
    renderResults(data, lookup);
    renderUpcoming(data);
    renderStandingsSnapshot(data, currentStageId);
    renderLeaders(data);
    renderSpotlight(data);
    renderRivalry(data);
  }).catch(function (err) {
    ["home-results", "home-upcoming", "home-standings", "home-leaders", "home-spotlight", "home-rivalry"].forEach(function (id) {
      document.getElementById(id).innerHTML = R.errorBlock(err && err.code, "a data feed");
    });
  });
})();
