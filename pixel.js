// -----------------------------------------
    // OSMO - Elements Reveal on Scroll
    // -----------------------------------------

    function initContentRevealScroll() {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const ctx = gsap.context(() => {

        document.querySelectorAll('[data-reveal-group]').forEach(groupEl => {
          // Config from attributes or defaults (group-level)
          const groupStaggerSec = (parseFloat(groupEl.getAttribute('data-stagger')) || 100) / 1000; // ms → sec
          const groupDistance = groupEl.getAttribute('data-distance') || '2em';
          const triggerStart = groupEl.getAttribute('data-start') || 'top 80%';

          const animDuration = 0.8;
          const animEase = "power4.inOut";

          // Reduced motion: show immediately
          if (prefersReduced) {
            gsap.set(groupEl, { clearProps: 'all', y: 0, autoAlpha: 1 });
            return;
          }

          // If no direct children, animate the group element itself
          const directChildren = Array.from(groupEl.children).filter(el => el.nodeType === 1);
          if (!directChildren.length) {
            gsap.set(groupEl, { y: groupDistance, autoAlpha: 0 });
            ScrollTrigger.create({
              trigger: groupEl,
              start: triggerStart,
              once: true,
              onEnter: () => gsap.to(groupEl, {
                y: 0,
                autoAlpha: 1,
                duration: animDuration,
                ease: animEase,
                onComplete: () => gsap.set(groupEl, { clearProps: 'all' })
              })
            });
            return;
          }

          // Build animation slots: item or nested (deep layers allowed)
          const slots = [];
          directChildren.forEach(child => {
            const nestedGroup = child.matches('[data-reveal-group-nested]')
              ? child
              : child.querySelector(':scope [data-reveal-group-nested]');

            if (nestedGroup) {
              const includeParent =
                child.getAttribute('data-ignore') !== 'true' &&
                (
                  child.getAttribute('data-ignore') === 'false' ||
                  nestedGroup.getAttribute('data-ignore') === 'false'
                );

              const nestedChildren = Array.from(nestedGroup.children).filter(
                el => el.nodeType === 1 && el.getAttribute('data-ignore') !== 'true'
              );

              slots.push({
                type: 'nested',
                parentEl: child,
                nestedEl: nestedGroup,
                includeParent,
                nestedChildren
              });
            } else {
              if (child.getAttribute('data-ignore') === 'true') return;
              slots.push({ type: 'item', el: child });
            }
          });

          // Initial hidden state
          slots.forEach(slot => {
            if (slot.type === 'item') {
              // If the element itself is a nested group, force group distance (prevents it from using its own data-distance)
              const isNestedSelf = slot.el.matches('[data-reveal-group-nested]');
              const d = isNestedSelf ? groupDistance : (slot.el.getAttribute('data-distance') || groupDistance);
              gsap.set(slot.el, { y: d, autoAlpha: 0 });
            } else {
              // Parent follows the group's distance when included, regardless of nested's data-distance
              if (slot.includeParent) gsap.set(slot.parentEl, { y: groupDistance, autoAlpha: 0 });
              // Children use nested group's own distance (fallback to group distance)
              const nestedD = slot.nestedEl.getAttribute('data-distance') || groupDistance;
              slot.nestedChildren.forEach(target => gsap.set(target, { y: nestedD, autoAlpha: 0 }));
            }
          });

          // Extra safety: if a nested parent is included, re-assert its distance to the group's value
          slots.forEach(slot => {
            if (slot.type === 'nested' && slot.includeParent) {
              gsap.set(slot.parentEl, { y: groupDistance });
            }
          });

          // Reveal sequence
          ScrollTrigger.create({
            trigger: groupEl,
            start: triggerStart,
            once: true,
            onEnter: () => {
              const tl = gsap.timeline();

              slots.forEach((slot, slotIndex) => {
                const slotTime = slotIndex * groupStaggerSec;

                if (slot.type === 'item') {
                  tl.to(slot.el, {
                    y: 0,
                    autoAlpha: 1,
                    duration: animDuration,
                    ease: animEase,
                    onComplete: () => gsap.set(slot.el, { clearProps: 'all' })
                  }, slotTime);
                } else {
                  // Optionally include the parent at the same slot time (parent uses group distance)
                  if (slot.includeParent) {
                    tl.to(slot.parentEl, {
                      y: 0,
                      autoAlpha: 1,
                      duration: animDuration,
                      ease: animEase,
                      onComplete: () => gsap.set(slot.parentEl, { clearProps: 'all' })
                    }, slotTime);
                  }
                  // Nested children use nested stagger (ms → sec); fallback to group stagger
                  const nestedMs = parseFloat(slot.nestedEl.getAttribute('data-stagger'));
                  const nestedStaggerSec = isNaN(nestedMs) ? groupStaggerSec : nestedMs / 1000;
                  slot.nestedChildren.forEach((nestedChild, nestedIndex) => {
                    tl.to(nestedChild, {
                      y: 0,
                      autoAlpha: 1,
                      duration: animDuration,
                      ease: animEase,
                      onComplete: () => gsap.set(nestedChild, { clearProps: 'all' })
                    }, slotTime + nestedIndex * nestedStaggerSec);
                  });
                }
              });
            }
          });
        });

      });

      return () => ctx.revert();
    }

    // Initialize Elements Reveal on Scroll
    document.addEventListener("DOMContentLoaded", () => {
      initContentRevealScroll();

      // -----------------------------------------
      // Current Year
      // -----------------------------------------
      var year = new Date().getFullYear();
      $("[current-year]").text(year);

      // -----------------------------------------
      // Swiper JS
      // -----------------------------------------
      document.querySelectorAll(".swiper").forEach((element) => {
        const prev = element.querySelector(".is-prev");
        const next = element.querySelector(".is-next");
        const nav = element.querySelector(".swiper-bullet-list");

        // Check if there's no div with class w-dyn-empty inside the current swiper-CMS element
        if (!element.querySelector("div.w-dyn-empty")) {
          const loop = element.dataset.loop === "true";
          const centered = element.dataset.centered === "true";
          const axis = element.dataset.axis;
          const autoplay = element.dataset.autoplay === "true";
          const speed = Number(element.dataset.speed) || 600; // Default speed
          const delay = Number(element.dataset.delay) || 5000; // Default delay
          const reverseDirection = element.dataset.reverse === "true";

          new Swiper(element.querySelector(".swiper-container"), {
            grabCursor: true,
            speed: speed,
            loop: loop,
            autoplay: autoplay
              ? {
                delay: delay,
                reverseDirection: reverseDirection === true ? true : undefined,
              }
              : false,
            centeredSlides: centered,
            slidesPerView: "auto",
            slidesPerGroup: 1,
            navigation: {
              nextEl: next,
              prevEl: prev,
            },
            mousewheel: {
              forceToAxis: axis === "false" ? false : true,
              invert: false,
              sensitivity: 1.5,
            },
            pagination: {
              el: nav,
              bulletActiveClass: "is-active",
              bulletClass: "swiper-bullet",
              clickable: true,
            },
          });
        }
      });

      // -----------------------------------------
      // Scroll to Section
      // -----------------------------------------

      const SCROLL_OFFSET = 0; // adjust if you have a sticky nav

      // Helper: extract the scrollTo value from a URL string
      function getScrollToId(url) {
        try {
          const parsed = new URL(url, window.location.origin);
          return parsed.searchParams.get("scrollTo");
        } catch (e) {
          return null;
        }
      }

      // Helper: scroll to a section by ID
      function scrollToSection(id) {
        const target = document.getElementById(id);
        if (!target) return false;
        gsap.to(window, {
          duration: 1,
          scrollTo: { y: target, offsetY: SCROLL_OFFSET },
          ease: "power2.inOut"
        });
        return true;
      }

      // 1. Intercept clicks on links with a scrollTo param
      document.querySelectorAll('a[href*="scrollTo="]').forEach((link) => {
        link.addEventListener("click", (e) => {
          const href = link.getAttribute("href");
          const scrollId = getScrollToId(href);
          if (!scrollId) return;

          const exists = document.getElementById(scrollId);
          if (exists) {
            e.preventDefault();
            scrollToSection(scrollId);
            history.pushState(null, "", `?scrollTo=${scrollId}`);
          }
        });
      });

      // 2. On page load, check if URL already has a scrollTo param
      const currentScrollId = getScrollToId(window.location.href);
      if (currentScrollId) {
        setTimeout(() => {
          scrollToSection(currentScrollId);
        }, 100);
      }

      // 3. Toggle .w--current on the matching link while its section is in view
      const sectionIds = new Set();
      document.querySelectorAll('a[href*="scrollTo="]').forEach((link) => {
        const id = getScrollToId(link.getAttribute("href"));
        if (id && document.getElementById(id)) sectionIds.add(id);
      });

      sectionIds.forEach((id) => {
        const section = document.getElementById(id);
        const matchingLinks = document.querySelectorAll(`a[href*="scrollTo=${id}"]`);
        if (!section || !matchingLinks.length) return;

        ScrollTrigger.create({
          trigger: section,
          start: "top center",
          end: "bottom center",
          toggleClass: {
            targets: matchingLinks,
            className: "w--current"
          }
          // markers: true, // uncomment while testing
        });
      });
      // -----------------------------------------
    });


