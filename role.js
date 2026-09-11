/* ===========================================================================
   2iresourcing — Key Roles in IT Infrastructure

   Scroll driver for the sticky console reel. Everything it touches is inside
   #roles; it queries nothing outside that subtree and registers no global
   state, so it cannot disturb the rest of the page.

   What it does:
     1. splits the section heading into words for the staggered rise
     2. reveals the head block and each role as it enters the viewport
     3. keeps the laptop screen in step with whichever role is nearest the
        reading line, and drives the rail (dots, prev/next, progress hairline)

   Pairs with photo.css. Until this runs, #roles has no .ir-ready class and
   the stylesheet renders the whole section complete and legible.
   =========================================================================== */

(function () {
  "use strict";

  /* Window chrome caption per role — the small detail that sells the idea
     that you are looking at six different consoles, not one. */
  var TITLES = [
    "core-01 — systemctl",
    "edge-rtr-01 — topology",
    "pg-primary — psql",
    "servicedesk — queue",
    "soc-01 — sentinel",
    "dc-floor — rack ops"
  ];

  var reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  var stackMQ = window.matchMedia("(max-width: 960px)");

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function all(root, sel) {
    return Array.prototype.slice.call(root.querySelectorAll(sel));
  }

  /* ---------------------------------------------------------------------
     1. Word split
     Wraps each word of a [data-split] heading in <span class="w"> and hands
     the stylesheet an index to stagger from. Whitespace is preserved so the
     heading still wraps naturally.
     --------------------------------------------------------------------- */
  function splitHeadings(root) {
    all(root, "[data-split]").forEach(function (el) {
      if (el.dataset.splitDone) return;
      var words = el.textContent.trim().split(/\s+/);
      var frag = document.createDocumentFragment();
      words.forEach(function (word, i) {
        var span = document.createElement("span");
        span.className = "w";
        span.style.setProperty("--w", i);
        span.textContent = word;
        frag.appendChild(span);
        if (i < words.length - 1) {
          frag.appendChild(document.createTextNode(" "));
        }
      });
      el.textContent = "";
      el.appendChild(frag);
      el.dataset.splitDone = "1";
    });
  }

  /* ---------------------------------------------------------------------
     2. Reveal on enter
     One observer for both the head block and the six roles. Each element is
     unobserved once it has been seen, so a role that has scrolled past never
     fades back out — all six stay at full contrast.
     --------------------------------------------------------------------- */
  function setupReveal(root) {
    var targets = all(root, ".reveal").map(function (el) {
      return { el: el, cls: "in" };
    });
    targets = targets.concat(
      all(root, ".ir-step").map(function (el) {
        return { el: el, cls: "seen" };
      })
    );

    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (t) {
        t.el.classList.add(t.cls);
      });
      return;
    }

    var lookup = new WeakMap();
    targets.forEach(function (t) {
      lookup.set(t.el, t.cls);
    });

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add(lookup.get(entry.target) || "in");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );

    targets.forEach(function (t) {
      io.observe(t.el);
    });
  }

  /* ---------------------------------------------------------------------
     3. The reel
     --------------------------------------------------------------------- */
  function setupReel(root) {
    var machine = root.querySelector(".ir-machine");
    var laptop = root.querySelector("#laptop");
    var chromeTitle = root.querySelector("#chrome-title");
    var views = all(root, ".ir-view");
    var steps = all(root, ".ir-step");
    var dotList = root.querySelector("#rail-dots");
    var prevBtn = root.querySelector("#rail-prev");
    var nextBtn = root.querySelector("#rail-next");

    if (!machine || !views.length || !steps.length) return;

    var dots = [];
    var current = -1;
    var titleTimer = null;

    /* --- rail dots, built from the roles themselves so the two can never
           drift out of sync --- */
    if (dotList) {
      dotList.innerHTML = "";
      steps.forEach(function (step, i) {
        var heading = step.querySelector("h3");
        var name = heading ? heading.textContent.trim() : "Role " + (i + 1);
        var li = document.createElement("li");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("aria-current", "false");
        btn.setAttribute("aria-label", name);
        btn.title = name;
        btn.addEventListener("click", function () {
          goTo(i);
        });
        li.appendChild(btn);
        dotList.appendChild(li);
        dots.push(btn);
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        goTo(current - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        goTo(current + 1);
      });
    }

    var sticky = root.querySelector(".ir-reel-sticky");

    /* --- the reading line.

       On the split layout the machine is centred in the viewport, so the
       line is the middle of the screen. On the stacked layout the machine is
       pinned as a band across the top and the roles read in the strip left
       underneath it, so the line is the middle of that strip — measured from
       the band rather than guessed, since the band's height moves with the
       viewport width. --- */
    function probe() {
      var h = window.innerHeight || document.documentElement.clientHeight;
      if (!stackMQ.matches) return h * 0.5;
      var band = sticky ? sticky.getBoundingClientRect() : null;
      var clearTop = band ? Math.max(0, Math.min(band.bottom, h)) : h * 0.4;
      return clearTop + (h - clearTop) / 2;
    }

    function nearest() {
      var line = probe();
      var best = 0;
      var bestDist = Infinity;
      for (var i = 0; i < steps.length; i++) {
        var r = steps[i].getBoundingClientRect();
        var d = Math.abs(r.top + r.height / 2 - line);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    }

    function setTitle(i) {
      if (!chromeTitle || !TITLES[i]) return;
      if (reduceMQ.matches) {
        chromeTitle.textContent = TITLES[i];
        return;
      }
      /* Fade the caption out, swap it, fade it back — the screen behind it is
         mid-transition, so a hard cut reads as a glitch. */
      chromeTitle.classList.add("swap");
      window.clearTimeout(titleTimer);
      titleTimer = window.setTimeout(function () {
        chromeTitle.textContent = TITLES[i];
        chromeTitle.classList.remove("swap");
      }, 190);
    }

    function activate(i) {
      if (i === current) return;
      var back = i < current;
      var prev = current;
      current = i;

      views.forEach(function (view, n) {
        var on = n === i;
        view.classList.toggle("on", on);
        /* The screen that is leaving exits the way you came from, so a
           backwards scroll reads as backwards. */
        view.classList.toggle("out", !on && n === prev && back);
        view.setAttribute("aria-hidden", on ? "false" : "true");
      });

      steps.forEach(function (step, n) {
        step.classList.toggle("active", n === i);
        step.classList.toggle("past", n < i);
      });

      dots.forEach(function (dot, n) {
        dot.setAttribute("aria-current", n === i ? "true" : "false");
      });

      if (laptop) laptop.setAttribute("data-view", String(i + 1));
      if (prevBtn) prevBtn.disabled = i <= 0;
      if (nextBtn) nextBtn.disabled = i >= steps.length - 1;
      setTitle(i);
    }

    /* Scroll progress across the whole run of roles, drawn as the hairline
       under the window chrome. */
    function setProgress() {
      var first = steps[0].getBoundingClientRect();
      var last = steps[steps.length - 1].getBoundingClientRect();
      var span = last.top + last.height - first.top;
      if (span <= 0) return;
      var p = (probe() - first.top) / span;
      p = Math.max(0, Math.min(1, p));
      machine.style.setProperty("--p", (p * 100).toFixed(2) + "%");
    }

    function update() {
      activate(nearest());
      setProgress();
    }

    /* Align a role's centre with the reading line — the same point nearest()
       measures against, so a click lands exactly where a scroll would. */
    function goTo(i) {
      if (i < 0 || i >= steps.length) return;
      var r = steps[i].getBoundingClientRect();
      var delta = r.top + r.height / 2 - probe();
      if (Math.abs(delta) < 1) return;
      try {
        window.scrollBy({
          top: delta,
          behavior: reduceMQ.matches ? "auto" : "smooth"
        });
      } catch (e) {
        window.scrollBy(0, delta);
      }
    }

    /* --- scheduling: one rAF-coalesced pass per frame, and only while the
           section is anywhere near the viewport --- */
    var ticking = false;
    var live = true;

    function onScroll() {
      if (!live || ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        update();
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    window.addEventListener("orientationchange", onScroll);

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        function (entries) {
          live = entries[0].isIntersecting;
          if (live) onScroll();
        },
        { rootMargin: "60% 0px 60% 0px" }
      ).observe(root);
    }

    /* Late layout shifts — web fonts landing, images above the section
       settling — move the roles under the reading line. Re-measure. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(update).catch(function () {});
    }
    window.addEventListener("load", update);

    update();
  }

  ready(function () {
    var root = document.getElementById("roles");
    if (!root) return;

    splitHeadings(root);
    /* Hand the stylesheet the wheel before the first paint of the animated
       states, so nothing flashes from complete to hidden. */
    root.classList.add("ir-ready");
    setupReveal(root);
    setupReel(root);
  });
})();
