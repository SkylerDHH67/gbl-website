/* =========================================================
   GLOBAL BLADE LEAGUE — kinetic.js
   Purely cosmetic, purely additive: ambient background energy +
   click/tap impact feedback. Touches no data, no fetch logic, no
   existing page behavior - safe to drop onto any page. Honors
   prefers-reduced-motion automatically via styles.css's universal
   animation-duration override, so nothing here needs its own check.
   ========================================================= */

(function () {
  "use strict";

  function addAmbientLayer() {
    if (document.querySelector(".kinetic-ambient")) return;
    var layer = document.createElement("div");
    layer.className = "kinetic-ambient";
    document.body.appendChild(layer);

    // Occasional subtle "energy surge" - a brief brightness pulse, not a
    // constant effect, so the background still reads as calm most of the time.
    function scheduleSurge() {
      var delay = 9000 + Math.random() * 9000; // every ~9-18s
      setTimeout(function () {
        layer.classList.add("surge");
        setTimeout(function () { layer.classList.remove("surge"); }, 900);
        scheduleSurge();
      }, delay);
    }
    scheduleSurge();
  }

  // Expanding ring + brief press animation on interactive elements. Cycles
  // through the three brand accents so clicks don't always look identical.
  var RIPPLE_COLORS = ["", "gold", "red"];
  var rippleIndex = 0;

  function spawnRipple(x, y) {
    var ripple = document.createElement("span");
    var colorClass = RIPPLE_COLORS[rippleIndex % RIPPLE_COLORS.length];
    rippleIndex++;
    ripple.className = "kinetic-ripple" + (colorClass ? " " + colorClass : "");
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    document.body.appendChild(ripple);
    ripple.addEventListener("animationend", function () { ripple.remove(); });
    // Safety net in case animationend doesn't fire (e.g. element removed mid-animation elsewhere).
    setTimeout(function () { if (ripple.parentNode) ripple.remove(); }, 800);
  }

  function pressImpact(el) {
    el.classList.add("is-impacted");
    el.addEventListener("animationend", function handler() {
      el.classList.remove("is-impacted");
      el.removeEventListener("animationend", handler);
    });
    setTimeout(function () { el.classList.remove("is-impacted"); }, 400);
  }

  function wireImpactFeedback() {
    var SELECTOR = ".btn, .chip, a.panel, .tabs button, nav.main-nav a, .see-all";
    document.addEventListener("click", function (e) {
      var target = e.target.closest ? e.target.closest(SELECTOR) : null;
      if (!target) return;
      var x = (typeof e.clientX === "number" && e.clientX !== 0) ? e.clientX : target.getBoundingClientRect().left + target.offsetWidth / 2;
      var y = (typeof e.clientY === "number" && e.clientY !== 0) ? e.clientY : target.getBoundingClientRect().top + target.offsetHeight / 2;
      spawnRipple(x, y);
      pressImpact(target);
    }, { passive: true });
  }

  function init() {
    addAmbientLayer();
    wireImpactFeedback();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
