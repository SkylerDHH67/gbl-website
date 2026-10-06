/* =========================================================
   GLOBAL BLADE LEAGUE
   footer-social.js — renders social links (YouTube, Discord,
   Twitter/X, whatever you add later) into every page's footer,
   sourced from the "Site Content" tab (type = "social_link") via
   feed_media. Add a row there and it shows up everywhere with no
   code change. Fails silently if feed_media is empty/unreachable -
   the footer just shows its existing text with no links, same
   graceful-degradation posture as every other feed on this site.

   Only depends on config.js + utils.js (NOT data.js), so it works
   even on pages like stats-lab.html that don't load the full data
   layer yet.
   ========================================================= */

(function () {
  "use strict";

  function fetchFeedMediaRows() {
    var U = window.APP_UTILS;
    var url = window.APP_CONFIG.getFeedUrl(window.APP_CONFIG.FEED_TABS.MEDIA);
    if (U.isBlank(url)) return Promise.resolve([]);
    var bust = url + (url.indexOf("?") !== -1 ? "&" : "?") + "_=" + Date.now();
    return fetch(bust, { credentials: "omit", cache: "no-store" })
      .then(function (res) { return res.text(); })
      .then(function (text) {
        var looksLikeHTML = /^\s*</.test(text) && /<html/i.test(text);
        if (looksLikeHTML) return [];
        // Same 3-header-row skip as data.js's fetchCSV (title/description/headers).
        return U.rowsToObjects(U.parseCSV(text).slice(2));
      })
      .catch(function () { return []; });
  }

  function renderSocialLinks(rows) {
    var U = window.APP_UTILS;
    var socialRows = rows.filter(function (r) {
      return String(r.type || "").trim().toLowerCase() === "social_link" && !U.isBlank(r.url);
    });
    if (!socialRows.length) return;

    var links = socialRows.map(function (r) {
      var label = U.esc(r.title || r.type || "Link");
      return '<a href="' + U.esc(r.url) + '" target="_blank" rel="noopener">' + label + "</a>";
    }).join(" &middot; ");

    document.querySelectorAll("footer.site-footer .wrap").forEach(function (wrap) {
      var el = document.createElement("div");
      el.className = "footer-social-links";
      el.style.marginTop = "8px";
      el.innerHTML = links;
      wrap.appendChild(el);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.APP_CONFIG || !window.APP_UTILS) return;
    fetchFeedMediaRows().then(renderSocialLinks);
  });
})();
