/* =========================================================
   GLOBAL BLADE LEAGUE
   data.js — fetches every feed_* Google Sheet tab as CSV (via
   APP_CONFIG.getFeedUrl) and normalizes it into plain JS
   objects/arrays. Nothing here touches the DOM.

   Each feed is fetched independently (Promise.allSettled-style via
   fetchFeedSafe) so a single missing/unreadable feed degrades
   gracefully instead of breaking every page - e.g. if feed_media
   is empty, the Builds/Standings/Match Center pages keep working
   fine regardless.
   ========================================================= */

(function () {
  "use strict";
  var U = window.APP_UTILS;

  // Every real field name used anywhere across every GBL feed, confirmed
  // directly against the live Master/Display sheets. Several source tabs
  // (Match Database, Battle Event Log, Schedule, Standings, Reshuffle Log)
  // have a header cell that's a single Sheets cell with embedded line
  // breaks - title, description, the real field name, and sometimes a
  // placeholder note, all stacked inside ONE cell - rather than the clean
  // single-line header the newer feed_* tabs use. Rather than requiring
  // every one of those cells to be hand-edited in the Sheet, each header
  // cell is searched against this whitelist for a known field name
  // anywhere inside it. Longest names first so "matches_played" is found
  // whole rather than a shorter name matching part of it first (word
  // boundaries already prevent that, but order is kept defensive).
  var KNOWN_FIELD_NAMES = [
    "player_a_new_order", "player_b_new_order", "paired_points_per_battle",
    "baseline_points_per_battle", "participation_progress", "deck_a_build_ids",
    "deck_b_build_ids", "position_in_rotation", "insufficient_sample",
    "wordmark_logo_url", "target_score_override", "teammate_build_id",
    "finish_distribution", "points_per_battle", "debut_season_id",
    "slot_1_part_id", "slot_1_role", "slot_2_part_id", "slot_2_role",
    "slot_3_part_id", "slot_3_role", "nickname",
    "badge_logo_url", "points_against", "duration_battles", "deck_build_ids",
    "deck_net_rating", "winner_player_id", "player_a_id", "player_b_id",
    "build_id_a", "build_id_b", "score_a_after", "score_b_after",
    "matches_played", "synergy_delta", "shared_battles", "final_score_a",
    "final_score_b", "reshuffle_id", "rotation_seq", "finish_type",
    "points_awarded", "flag_emoji", "short_code", "display_name",
    "points_scored", "win_rate", "win_pct", "points_for", "point_diff",
    "times_used", "times_won", "battle_seq", "stage_id", "season_id",
    "match_id", "event_id", "build_id", "player_id", "part_id", "item_id",
    "is_voided", "voided_at", "is_redo", "timestamp", "last_10", "notes",
    "image_url", "category", "country", "status", "active", "wins",
    "losses", "elo", "gbl_rating", "rank", "date", "seq", "key", "value",
    "type", "title", "url", "description", "system", "bio", "xWins",
    "yWins", "matches", "playerX", "playerY", "target_score"
  ];

  function cleanHeaderCell_(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return s;
    // Already a clean single token - nothing to extract.
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) return s;
    for (var i = 0; i < KNOWN_FIELD_NAMES.length; i++) {
      var name = KNOWN_FIELD_NAMES[i];
      var re = new RegExp("\\b" + name + "\\b");
      if (re.test(s)) return name;
    }
    return s; // unknown/forward-compatible column - leave as-is
  }

  // Detects which row is the real header row instead of assuming a fixed
  // offset. Script-built feed_* tabs have 3 rows before data (title,
  // description, headers - header row at index 2). Tabs imported straight
  // from a raw source tab (Match Database, Battle Event Log, Schedule,
  // Standings, Reshuffle Log, etc. via IMPORTRANGE) only ever had ONE
  // header row to begin with, so assuming index 2 silently skips the real
  // header AND the first data row, then treats the second data row as
  // headers - every raw.field_name lookup comes back undefined after that.
  // A header row is identified as the first row with at least 2 non-empty
  // cells where most of them look like clean field names OR contain a
  // known field name somewhere inside them (see cleanHeaderCell_ above).
  function looksLikeHeaderCell_(cell) {
    var s = String(cell == null ? "" : cell).trim();
    if (!s) return true; // blank cells never disqualify a header row
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) return true;
    return cleanHeaderCell_(s) !== s; // matched a known field name inside messy text
  }

  function findHeaderRowIndex_(rows) {
    var scanLimit = Math.min(rows.length, 6);
    for (var i = 0; i < scanLimit; i++) {
      var row = rows[i] || [];
      var nonEmpty = row.filter(function (c) { return String(c == null ? "" : c).trim(); });
      if (nonEmpty.length < 2) continue; // title/description rows are usually a single cell
      var cleanCount = nonEmpty.filter(looksLikeHeaderCell_).length;
      if (cleanCount / nonEmpty.length >= 0.6) return i;
    }
    return 2; // fallback: old fixed 3-row convention
  }

  function fetchCSV(url) {
    if (U.isBlank(url)) return Promise.reject(Object.assign(new Error("MISSING_FEED_URL"), { code: "MISSING_FEED_URL" }));
    var bust = url + (url.indexOf("?") !== -1 ? "&" : "?") + "_=" + Date.now();
    return fetch(bust, { credentials: "omit", cache: "no-store" }).then(function (res) {
      return res.text().then(function (text) {
        var looksLikeHTML = /^\s*</.test(text) && /<html/i.test(text);
        if (!res.ok || looksLikeHTML) {
          var err = new Error("FEED_NOT_PUBLIC");
          err.code = "FEED_NOT_PUBLIC";
          err.url = url;
          throw err;
        }
        var allRows = U.parseCSV(text);
        var headerIdx = findHeaderRowIndex_(allRows);
        var cleaned = allRows.slice(headerIdx);
        if (cleaned.length) cleaned[0] = cleaned[0].map(cleanHeaderCell_);
        return U.rowsToObjects(cleaned);
      });
    });
  }

  // Fetches one feed_* tab by its FEED_TABS key (e.g. "PLAYERS"), building
  // the URL from APP_CONFIG.getFeedUrl - callers never handle raw URLs.
  function fetchFeedByTab(tabKey) {
    var tabName = window.APP_CONFIG.FEED_TABS[tabKey];
    var url = window.APP_CONFIG.getFeedUrl(tabName);
    return fetchCSV(url);
  }

  // Fetches a feed and NEVER rejects - resolves to { ok, rows, error } so
  // Promise.all callers don't need try/catch gymnastics and one bad feed
  // can't take down the others.
  function fetchFeedSafe(tabKey) {
    return fetchFeedByTab(tabKey).then(
      function (rows) { return { ok: true, rows: rows, error: null }; },
      function (err) { return { ok: false, rows: [], error: err && err.code ? err.code : "UNKNOWN_ERROR" }; }
    );
  }

  function normalizePlayer(raw) {
    return {
      playerId: raw.player_id,
      displayName: raw.display_name || raw.player_id,
      shortCode: raw.short_code || "",
      country: raw.country || "",
      flagEmoji: raw.flag_emoji || "",
      badgeLogoUrl: raw.badge_logo_url || "",
      wordmarkLogoUrl: raw.wordmark_logo_url || "",
      bio: raw.bio || "",
      status: raw.status || "active",
      debutSeasonId: raw.debut_season_id || "",
      slug: U.slugify(raw.display_name || raw.player_id || "")
    };
  }

  function normalizePart(raw) {
    return {
      partId: raw.part_id, category: raw.category || "", system: raw.system || "",
      displayName: raw.display_name || raw.part_id, imageUrl: raw.image_url || "",
      active: U.truthy(raw.active)
    };
  }

  function buildConfigMaps(rows) {
    var seasons = {}, seasonStatus = {}, stages = {}, finishPoints = {}, finishIsRedo = {};
    rows.forEach(function (r) {
      var key = r.key || "", value = r.value;
      if (key.indexOf("season_status:") === 0) seasonStatus[key.slice(14)] = value;
      else if (key.indexOf("season:") === 0) seasons[key.slice(7)] = value;
      else if (key.indexOf("stage_season:") === 0) { stages[key.slice(13)] = stages[key.slice(13)] || {}; stages[key.slice(13)].seasonId = value; }
      else if (key.indexOf("stage_order:") === 0) { stages[key.slice(12)] = stages[key.slice(12)] || {}; stages[key.slice(12)].order = U.num(value); }
      else if (key.indexOf("stage_target_score:") === 0) { stages[key.slice(19)] = stages[key.slice(19)] || {}; stages[key.slice(19)].targetScore = U.num(value); }
      else if (key.indexOf("stage:") === 0) { stages[key.slice(6)] = stages[key.slice(6)] || {}; stages[key.slice(6)].name = value; }
      else if (key.indexOf("finish_points:") === 0) finishPoints[key.slice(14)] = U.num(value);
      else if (key.indexOf("finish_is_redo:") === 0) finishIsRedo[key.slice(15)] = U.truthy(value);
    });
    return { seasons: seasons, seasonStatus: seasonStatus, stages: stages, finishPoints: finishPoints, finishIsRedo: finishIsRedo };
  }

  function normalizeScheduleRow(raw) {
    return {
      matchId: raw.match_id, seasonId: raw.season_id, stageId: raw.stage_id,
      playerAId: raw.player_a_id, playerBId: raw.player_b_id, date: raw.date,
      status: raw.status || "SCHEDULED", targetScoreOverride: raw.target_score_override
    };
  }

  // The manual "Upcoming Matches" tab has no player_id/stage_id foreign
  // keys by design - it's hand-edited purely for public preview, so names
  // are plain text the admin typed in, not resolved against the Players
  // tab. upcoming_id is just a stable row key, not a real match_id.
  function normalizeUpcomingRow(raw) {
    return {
      upcomingId: raw.upcoming_id, date: raw.date || "", stageLabel: raw.stage_label || "",
      playerAName: raw.player_a_name || "", playerBName: raw.player_b_name || "", note: raw.note || ""
    };
  }

  function normalizeMatchRow(raw) {
    return {
      matchId: raw.match_id, seasonId: raw.season_id, stageId: raw.stage_id,
      playerAId: raw.player_a_id, playerBId: raw.player_b_id, date: raw.date,
      targetScore: U.num(raw.target_score), finalScoreA: U.num(raw.final_score_a), finalScoreB: U.num(raw.final_score_b),
      winnerPlayerId: raw.winner_player_id, status: raw.status || "", durationBattles: U.num(raw.duration_battles)
    };
  }

  function normalizeBattleRow(raw) {
    return {
      eventId: raw.event_id, matchId: raw.match_id, battleSeq: U.num(raw.battle_seq, null),
      rotationSeq: U.num(raw.rotation_seq), timestamp: raw.timestamp,
      buildIdA: raw.build_id_a, buildIdB: raw.build_id_b, finishType: raw.finish_type,
      winnerPlayerId: raw.winner_player_id, pointsAwarded: U.num(raw.points_awarded),
      scoreAAfter: U.num(raw.score_a_after), scoreBAfter: U.num(raw.score_b_after),
      isRedo: U.truthy(raw.is_redo), isVoided: U.truthy(raw.is_voided), seq: U.num(raw.seq)
    };
  }

  function normalizeReshuffleRow(raw) {
    return {
      reshuffleId: raw.reshuffle_id, matchId: raw.match_id, rotationSeq: U.num(raw.rotation_seq),
      playerANewOrder: (raw.player_a_new_order || "").split(",").filter(Boolean),
      playerBNewOrder: (raw.player_b_new_order || "").split(",").filter(Boolean),
      timestamp: raw.timestamp, isVoided: U.truthy(raw.is_voided), seq: U.num(raw.seq)
    };
  }

  function normalizeStandingsRow(raw) {
    return {
      rank: U.num(raw.rank), playerId: raw.player_id, displayName: raw.display_name,
      seasonId: raw.season_id, stageId: raw.stage_id, matchesPlayed: U.num(raw.matches_played),
      wins: U.num(raw.wins), losses: U.num(raw.losses), winPct: U.num(raw.win_pct),
      pointsFor: U.num(raw.points_for), pointsAgainst: U.num(raw.points_against), pointDiff: U.num(raw.point_diff),
      last10: raw.last_10 || "", elo: U.num(raw.elo), gblRating: U.num(raw.gbl_rating),
      participationProgress: U.num(raw.participation_progress)
    };
  }

  // The Builds tab links a build_id to its three actual parts (and which
  // slot/role each is - Blade/Ratchet/Bit) - this is what lets the site
  // show "Shatter Horus / 1-60 / Hexa" instead of a bare build_id. Not
  // filtered to active-only here: an older/inactive build's name should
  // still resolve correctly in historical stats rather than disappearing.
  function normalizeBuildRow(raw) {
    return {
      buildId: raw.build_id, playerId: raw.player_id, seasonId: raw.season_id,
      slot1PartId: raw.slot_1_part_id || "", slot1Role: raw.slot_1_role || "",
      slot2PartId: raw.slot_2_part_id || "", slot2Role: raw.slot_2_role || "",
      slot3PartId: raw.slot_3_part_id || "", slot3Role: raw.slot_3_role || "",
      nickname: raw.nickname || "", active: U.truthy(raw.active)
    };
  }

  function normalizeBuildStatsRow(raw) {
    var dist = {};
    (raw.finish_distribution || "").split(";").filter(Boolean).forEach(function (pair) {
      var idx = pair.lastIndexOf(":");
      if (idx === -1) return;
      dist[pair.slice(0, idx)] = U.num(pair.slice(idx + 1));
    });
    return {
      buildId: raw.build_id, playerId: raw.player_id, timesUsed: U.num(raw.times_used), timesWon: U.num(raw.times_won),
      pointsScored: U.num(raw.points_scored), pointsPerBattle: U.num(raw.points_per_battle), winRate: U.num(raw.win_rate),
      finishDistribution: dist
    };
  }

  // --- Phase 8 analytics + site content normalizers -----------------------

  function normalizeHeadToHeadRow(raw) {
    return {
      playerX: raw.playerX, playerY: raw.playerY,
      xWins: U.num(raw.xWins), yWins: U.num(raw.yWins), matches: U.num(raw.matches)
    };
  }

  function normalizeDeckRecordRow(raw) {
    return {
      playerId: raw.player_id,
      deckBuildIds: (raw.deck_build_ids || "").split(",").filter(Boolean),
      matchesPlayed: U.num(raw.matches_played), wins: U.num(raw.wins), losses: U.num(raw.losses),
      winRate: U.num(raw.win_rate), deckNetRating: U.num(raw.deck_net_rating),
      pointsFor: U.num(raw.points_for), pointsAgainst: U.num(raw.points_against),
      insufficientSample: U.truthy(raw.insufficient_sample)
    };
  }

  function normalizeBuildPairSynergyRow(raw) {
    return {
      buildId: raw.build_id, teammateBuildId: raw.teammate_build_id,
      sharedBattles: U.num(raw.shared_battles), pairedPointsPerBattle: U.num(raw.paired_points_per_battle),
      baselinePointsPerBattle: U.num(raw.baseline_points_per_battle), synergyDelta: U.num(raw.synergy_delta),
      insufficientSample: U.truthy(raw.insufficient_sample)
    };
  }

  function normalizeStatsLabSourceRow(raw) {
    return {
      matchId: raw.match_id, seasonId: raw.season_id, stageId: raw.stage_id,
      playerAId: raw.player_a_id, playerBId: raw.player_b_id,
      buildIdA: raw.build_id_a, buildIdB: raw.build_id_b, finishType: raw.finish_type,
      winnerPlayerId: raw.winner_player_id, pointsAwarded: U.num(raw.points_awarded),
      rotationSeq: U.num(raw.rotation_seq), positionInRotation: U.num(raw.position_in_rotation), seq: U.num(raw.seq)
    };
  }

  function normalizeMediaRow(raw) {
    return {
      itemId: raw.item_id, type: raw.type || "", title: raw.title || "",
      url: raw.url || "", description: raw.description || ""
    };
  }

  function loadAppData() {
    return Promise.all([
      fetchFeedSafe("PLAYERS"), fetchFeedSafe("PARTS_CATALOG"), fetchFeedSafe("CONFIG"),
      fetchFeedSafe("SCHEDULE"), fetchFeedSafe("UPCOMING"), fetchFeedSafe("MATCHES"), fetchFeedSafe("BATTLE_LOG"),
      fetchFeedSafe("RESHUFFLE_LOG"), fetchFeedSafe("STANDINGS"), fetchFeedSafe("BUILDS"), fetchFeedSafe("BUILD_STATS"),
      fetchFeedSafe("HEAD_TO_HEAD"), fetchFeedSafe("DECK_RECORDS"), fetchFeedSafe("BUILD_PAIR_SYNERGY"),
      fetchFeedSafe("STATS_LAB_SOURCE"), fetchFeedSafe("MEDIA")
    ]).then(function (results) {
      var r = {
        players: results[0], parts: results[1], config: results[2], schedule: results[3], upcoming: results[4], matches: results[5],
        battleLog: results[6], reshuffleLog: results[7], standings: results[8], builds: results[9], buildStats: results[10],
        headToHead: results[11], deckRecords: results[12], buildPairSynergy: results[13],
        statsLabSource: results[14], media: results[15]
      };
      var configMaps = buildConfigMaps(r.config.rows);
      return {
        meta: {
          players: { ok: r.players.ok, error: r.players.error },
          parts: { ok: r.parts.ok, error: r.parts.error },
          config: { ok: r.config.ok, error: r.config.error },
          schedule: { ok: r.schedule.ok, error: r.schedule.error },
          upcoming: { ok: r.upcoming.ok, error: r.upcoming.error },
          matches: { ok: r.matches.ok, error: r.matches.error },
          battleLog: { ok: r.battleLog.ok, error: r.battleLog.error },
          reshuffleLog: { ok: r.reshuffleLog.ok, error: r.reshuffleLog.error },
          standings: { ok: r.standings.ok, error: r.standings.error },
          builds: { ok: r.builds.ok, error: r.builds.error },
          buildStats: { ok: r.buildStats.ok, error: r.buildStats.error },
          headToHead: { ok: r.headToHead.ok, error: r.headToHead.error },
          deckRecords: { ok: r.deckRecords.ok, error: r.deckRecords.error },
          buildPairSynergy: { ok: r.buildPairSynergy.ok, error: r.buildPairSynergy.error },
          statsLabSource: { ok: r.statsLabSource.ok, error: r.statsLabSource.error },
          media: { ok: r.media.ok, error: r.media.error }
        },
        players: r.players.rows.filter(function (p) { return p.player_id; }).map(normalizePlayer),
        parts: r.parts.rows.filter(function (p) { return p.part_id; }).map(normalizePart),
        seasons: configMaps.seasons, seasonStatus: configMaps.seasonStatus, stages: configMaps.stages,
        finishPoints: configMaps.finishPoints, finishIsRedo: configMaps.finishIsRedo,
        schedule: r.schedule.rows.filter(function (m) { return m.match_id; }).map(normalizeScheduleRow),
        upcoming: r.upcoming.rows.filter(function (u) { return u.player_a_name && u.player_b_name; }).map(normalizeUpcomingRow),
        matches: r.matches.rows.filter(function (m) { return m.match_id; }).map(normalizeMatchRow),
        battleLog: r.battleLog.rows.filter(function (e) { return e.event_id; }).map(normalizeBattleRow),
        reshuffleLog: r.reshuffleLog.rows.filter(function (e) { return e.reshuffle_id; }).map(normalizeReshuffleRow),
        standings: r.standings.rows.filter(function (s) { return s.player_id; }).map(normalizeStandingsRow),
        builds: r.builds.rows.filter(function (b) { return b.build_id; }).map(normalizeBuildRow),
        buildStats: r.buildStats.rows.filter(function (b) { return b.build_id; }).map(normalizeBuildStatsRow),
        headToHead: r.headToHead.rows.filter(function (h) { return h.playerX && h.playerY; }).map(normalizeHeadToHeadRow),
        deckRecords: r.deckRecords.rows.filter(function (d) { return d.player_id; }).map(normalizeDeckRecordRow),
        buildPairSynergy: r.buildPairSynergy.rows.filter(function (b) { return b.build_id; }).map(normalizeBuildPairSynergyRow),
        statsLabSource: r.statsLabSource.rows.filter(function (s) { return s.match_id; }).map(normalizeStatsLabSourceRow),
        media: r.media.rows.filter(function (m) { return m.item_id; }).map(normalizeMediaRow)
      };
    });
  }

  window.APP_DATA = { loadAppData: loadAppData, fetchFeedSafe: fetchFeedSafe };
})();
