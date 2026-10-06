/* Shared nav wiring: mobile menu toggle + active-link highlighting.
   Runs on every page. No dependency on data.js/config.js. */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var page = document.body.getAttribute("data-page");
    if (page) {
      document.querySelectorAll("nav.main-nav a[data-page]").forEach(function (a) {
        if (a.getAttribute("data-page") === page) a.classList.add("active");
      });
    }
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector("nav.main-nav");
    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", nav.classList.contains("open") ? "true" : "false");
      });
      nav.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () { nav.classList.remove("open"); });
      });
    }
  });
})();
