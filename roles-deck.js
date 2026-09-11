/* ===========================================================================
   2iresourcing — Key Roles in IT Infrastructure  ·  THE DECK

   Scroll driver for the pinned photographic card deck. Everything it touches
   is inside #roles-deck; it shares no state with role.js and the two sections
   run side by side without knowing about each other.

   The difference from the reel is in how position is used. role.js asks
   "which role is nearest the reading line?" and switches to it — six discrete
   states. This one keeps a continuous progress value p across the pinned run
   and derives every card's depth, lift, tilt and fade from p directly, so the
   deck moves with the wheel instead of snapping between steps. Only the copy
   reveal is discrete, because a wipe has to start somewhere.

   Pairs with roles-deck.css. Until this runs, #roles-deck has no .rd-ready
   class and the stylesheet lays the six cards out as a plain readable stack.
   =========================================================================== */

(function () {
  "use strict";

  /* --- deck geometry. Percentages are of the card's own height; z is px
         against the perspective set on the deck in roles-deck.css.

     The front card leaves by being dealt off the top rather than by fading
     out. A card that fades is see-through for the whole middle of the move,
     and you get the next card's photograph ghosting through it — so the lift
     is big enough to clear the frame (the pin clips it) and the opacity only
     drops at the very end, as insurance, once it is essentially gone. --- */
  var LIFT = 128; /* how far the front card rises as it leaves        */
  var LIFT_Z = 54; /* and how far it comes toward you doing it        */
  var TILT = -6; /* degrees; negative tips its face toward you       */
  var FADE_AT = 0.86; /* how late in the move the fade starts             */
  var DROP = 6; /* how far each waiting card sits below the front   */
  var DEPTH = 88; /* and how far behind it, per place in the queue    */
  var VEIL = 0.3; /* paper veil per place back, capped at MAX_BACK    */
  var MAX_BACK = 3; /* cards deeper than this are parked and hidden     */
  var ZOOM = 0.14; /* total scroll-linked push-in on each photograph   */

  var reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");

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

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function clamp01(v) {
    return clamp(v, 0, 1);
  }

  /* ---------------------------------------------------------------------
     Word split — same idea as the reel's heading, kept local so the two
     sections can be lifted apart cleanly.
     --------------------------------------------------------------------- */
  function splitHeadings(root) {
    all(root, "[data-rd-split]").forEach(function (el) {
      if (el.dataset.rdSplitDone) return;
      var words = el.textContent.trim().split(/\s+/);
      var frag = document.createDocumentFragment();
      words.forEach(function (word, i) {
        var span = document.createElement("span");
        span.className = "w";
        span.style.setProperty("--w", i);
        span.textContent = word;
        frag.appendChild(span);
        if (i < words.length - 1) frag.appendChild(document.createTextNode(" "));
      });
      el.textContent = "";
      el.appendChild(frag);
      el.dataset.rdSplitDone = "1";
    });
  }

  function setupReveal(root) {
    var targets = all(root, ".rd-reveal");
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (el) {
        el.classList.add("in");
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );
    targets.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ---------------------------------------------------------------------
     The deck
     --------------------------------------------------------------------- */
  function setupDeck(root) {
    var stage = root.querySelector(".rd-stage");
    var pin = root.querySelector(".rd-pin");
    var cards = all(root, ".rd-card");
    var segList = root.querySelector(".rd-seg");
    var now = root.querySelector(".rd-now");
    var nowNo = root.querySelector(".rd-now b");
    var nowName = root.querySelector(".rd-now span");

    if (!stage || !pin || cards.length < 2) return;

    var N = cards.length;
    var last = N - 1;

    /* Cache the per-card parts once. Reading them back out of the DOM on
       every frame is the easiest way to make a scrubbed effect stutter. */
    var parts = cards.map(function (card, i) {
      var veil = document.createElement("div");
      veil.className = "rd-veil";
      card.appendChild(veil);
      /* Earlier cards sit in front, so they can fade away and uncover the
         next one without any z-index churn while scrolling. */
      card.style.zIndex = String(N - i);
      var title = card.querySelector(".rd-title");
      return {
        card: card,
        veil: veil,
        img: card.querySelector(".rd-media img"),
        name: title ? title.textContent.trim() : "Role " + (i + 1),
        no: String(i + 1).padStart(2, "0")
      };
    });

    /* --- rail --- */
    var segs = [];
    if (segList) {
      segList.innerHTML = "";
      parts.forEach(function (part, i) {
        var li = document.createElement("li");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("aria-label", part.no + " — " + part.name);
        btn.title = part.name;
        btn.addEventListener("click", function () {
          goTo(i);
        });
        li.appendChild(btn);
        segList.appendChild(li);
        segs.push(btn);
      });
    }

    var live = -1;
    var nameShown = -1;
    var nameTimer = null;

    function setLive(i) {
      if (i === live) return;
      live = i;
      for (var n = 0; n < N; n++) {
        parts[n].card.classList.toggle("is-live", n === i);
        parts[n].card.setAttribute("aria-hidden", n === i ? "false" : "true");
      }
      setName(i);
    }

    /* The rail caption cross-fades rather than cutting, so it does not snap
       while the card behind it is still moving. */
    function setName(i) {
      if (!now || !nowNo || !nowName || i === nameShown) return;
      nameShown = i;
      if (reduceMQ.matches) {
        nowNo.textContent = parts[i].no;
        nowName.textContent = parts[i].name;
        return;
      }
      now.classList.add("swap");
      window.clearTimeout(nameTimer);
      nameTimer = window.setTimeout(function () {
        nowNo.textContent = parts[i].no;
        nowName.textContent = parts[i].name;
        now.classList.remove("swap");
      }, 180);
    }

    /* --- the scrub ---

       p runs 0 → N-1 across the pinned stretch. The stage is a viewport
       taller than that stretch plus one spare step, which is what gives the
       final card somewhere to sit before the pin releases. */
    function step() {
      return (stage.offsetHeight - pin.offsetHeight) / N;
    }

    function progress() {
      var s = step();
      if (s <= 0) return 0;
      return clamp(-stage.getBoundingClientRect().top / s, 0, last);
    }

    function render(p) {
      for (var i = 0; i < N; i++) {
        var part = parts[i];
        var d = p - i;
        var y;
        var z;
        var rx;
        var op;
        var veil;

        if (d >= 0) {
          /* Front card, on its way out: lifted off the top of the deck,
             toward the viewer and tipping as it goes. Linear, so the card
             tracks the wheel one-to-one instead of easing away from it. */
          var t = clamp01(d);
          y = -t * LIFT;
          z = t * LIFT_Z;
          rx = t * TILT;
          op = 1 - clamp01((t - FADE_AT) / (1 - FADE_AT));
          veil = 0;
        } else {
          /* Waiting its turn, k places back. */
          var k = Math.min(-d, MAX_BACK);
          y = k * DROP;
          z = -k * DEPTH;
          rx = 0;
          op = k >= MAX_BACK ? 0 : 1;
          veil = Math.min(k * VEIL, 0.78);
        }

        part.card.style.transform =
          "translate3d(0," + y.toFixed(3) + "%," + z.toFixed(2) + "px) rotateX(" +
          rx.toFixed(3) + "deg)";
        part.card.style.opacity = op.toFixed(3);
        part.veil.style.opacity = veil.toFixed(3);

        /* The copy is dealt in half a step before the card reaches the front
           and stays on it for the whole exit. Tying it to .is-live instead
           would wipe the text off a card that is still in shot, and you would
           watch an empty white panel fly off the top. */
        part.card.classList.toggle("is-shown", d >= -0.5);

        if (part.img) {
          /* One slow, continuous push-in across the whole life of the card,
             tied to scroll rather than to a timer — so it holds still when
             the reader does. */
          var life = clamp01((d + 1.7) / 2.4);
          part.img.style.transform = "scale(" + (1 + ZOOM * life).toFixed(4) + ")";
        }
      }

      for (var s = 0; s < segs.length; s++) {
        segs[s].style.setProperty(
          "--fill",
          (clamp01(p - s + 1) * 100).toFixed(2) + "%"
        );
        segs[s].setAttribute(
          "aria-current",
          Math.round(p) === s ? "true" : "false"
        );
      }

      setLive(Math.round(p));
    }

    /* Reduced motion: the deck is still how you get from role to role, but
       it becomes a cross-fade with no depth and no push-in. */
    function renderFlat(p) {
      var active = Math.round(p);
      for (var i = 0; i < N; i++) {
        parts[i].card.style.transform = "none";
        parts[i].card.style.opacity = i === active ? "1" : "0";
        parts[i].veil.style.opacity = "0";
        parts[i].card.classList.toggle("is-shown", i === active);
        if (parts[i].img) parts[i].img.style.transform = "none";
      }
      for (var s = 0; s < segs.length; s++) {
        segs[s].style.setProperty("--fill", s <= active ? "100%" : "0%");
        segs[s].setAttribute("aria-current", active === s ? "true" : "false");
      }
      setLive(active);
    }

    function update() {
      var p = progress();
      if (reduceMQ.matches) renderFlat(p);
      else render(p);
    }

    /* Land on the scroll offset where card i is exactly at the front — the
       same arithmetic progress() runs, in reverse. */
    function goTo(i) {
      var top = stage.getBoundingClientRect().top + window.pageYOffset;
      var target = top + clamp(i, 0, last) * step();
      try {
        window.scrollTo({
          top: target,
          behavior: reduceMQ.matches ? "auto" : "smooth"
        });
      } catch (e) {
        window.scrollTo(0, target);
      }
    }

    /* --- scheduling: one rAF-coalesced pass per frame, and only while the
           stage is anywhere near the viewport --- */
    var ticking = false;
    var near = true;

    function onScroll() {
      if (!near || ticking) return;
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
          near = entries[0].isIntersecting;
          if (near) onScroll();
        },
        { rootMargin: "50% 0px 50% 0px" }
      ).observe(stage);
    }

    if (reduceMQ.addEventListener) {
      reduceMQ.addEventListener("change", update);
    }

    /* Late layout shifts — web fonts landing, the six photographs decoding —
       change where the stage starts. Re-measure when they settle. */
    parts.forEach(function (part) {
      if (part.img && !part.img.complete) {
        part.img.addEventListener("load", onScroll, { once: true });
      }
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(update).catch(function () {});
    }
    window.addEventListener("load", update);

    update();
  }

  ready(function () {
    var root = document.getElementById("roles-deck");
    if (!root) return;

    splitHeadings(root);
    /* Take the wheel before the first paint of the animated states, so the
       cards never flash from stacked-and-static to pinned. */
    root.classList.add("rd-ready");
    setupReveal(root);
    setupDeck(root);
  });
})();
