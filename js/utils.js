/* =========================================================
   GLOBAL BLADE LEAGUE
   utils.js — pure helper functions, no DOM, no fetch.
   parseCSV/rowsToObjects/esc/isBlank/truthy are adapted directly
   from the proven Dark Horse Series implementation (stress-tested
   against commas, quotes, embedded newlines, and emoji in Phase 5
   of this build) rather than reinventing CSV parsing.
   ========================================================= */

(function () {
  "use strict";

  function isBlank(v) {
    return v === undefined || v === null || String(v).trim() === "";
  }

  function truthy(v) {
    if (isBlank(v)) return false;
    var s = String(v).trim().toLowerCase();
    return s === "true" || s === "yes" || s === "1";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function num(v, fallback) {
    var n = parseFloat(v);
    return isNaN(n) ? (fallback === undefined ? 0 : fallback) : n;
  }

  function slugify(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function pct(v, digits) {
    if (isBlank(v)) return "—";
    var n = num(v) * 100;
    return n.toFixed(digits === undefined ? 0 : digits) + "%";
  }

  function fmtDate(v) {
    if (isBlank(v)) return "TBD";
    var d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function fmtDateShort(v) {
    if (isBlank(v)) return "TBD";
    var d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function ordinal(n) {
    n = parseInt(n, 10);
    if (isNaN(n)) return "—";
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // RFC4180-ish CSV parser: handles quoted fields, embedded commas,
  // doubled quotes, and newlines inside quoted fields. Stress-tested
  // against GBL-specific nasty values in Phase 5 (see stress_test.js).
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
        else field += c;
      }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (f) { return String(f).trim() !== ""; }); });
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    var headers = rows[0].map(function (h) { return String(h).trim(); });
    return rows.slice(1).map(function (r) {
      var obj = {};
      headers.forEach(function (h, idx) { obj[h] = (r[idx] !== undefined ? String(r[idx]).trim() : ""); });
      return obj;
    });
  }

  window.APP_UTILS = { isBlank: isBlank, truthy: truthy, esc: esc, num: num, slugify: slugify, pct: pct, fmtDate: fmtDate, fmtDateShort: fmtDateShort, ordinal: ordinal, parseCSV: parseCSV, rowsToObjects: rowsToObjects };
})();
