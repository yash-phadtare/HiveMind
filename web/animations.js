/* Hive Mind — motion layer
   Boots the page fade, drives the [data-reveal] scroll system, and
   animates stat counters. Everything degrades gracefully: if scripting,
   IntersectionObserver, or animations are unavailable, content is simply
   shown as-is (the hidden CSS states are gated on html.cssanim). */
(function () {
  "use strict";

  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canRun =
    !reduceMotion &&
    "IntersectionObserver" in window &&
    "requestAnimationFrame" in window;

  if (!canRun) {
    document
      .querySelectorAll("[data-reveal]")
      .forEach((el) => el.classList.add("is-revealed"));
    return;
  }

  document.documentElement.classList.add("cssanim");

  /* --- Page boot: fade the body in once fonts/layout settle --- */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => document.body.classList.add("booted"));
  });

  /* --- Scroll reveal --- */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add("is-revealed");
        revealObserver.unobserve(el);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -7% 0px" },
  );

  const stagger = (el) => {
    const delay = el.dataset.revealDelay;
    if (delay && /^\d+$/.test(delay)) {
      el.style.transitionDelay = `${delay}ms`;
    }
  };

  const trackReveal = (el) => {
    if (el.dataset.revealTracked === "1") return;
    el.dataset.revealTracked = "1";
    stagger(el);
    revealObserver.observe(el);
  };

  /* --- Count up: [data-count] elements animate on first sight --- */
  const state = new WeakMap();

  const parseValue = (el) => {
    const text = el.textContent.trim();
    const match = text.match(/^(-?\d[\d,]*\.?\d*)/);
    if (!match) return null;
    const number = parseFloat(match[1].replace(/,/g, ""));
    if (!Number.isFinite(number)) return null;
    return {
      number,
      decimals: (match[1].split(".")[1] || "").length,
      suffix: text.slice(match[1].length),
      text,
    };
  };

  const countObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) ensureCount(entry.target);
      });
    },
    { threshold: 0.3 },
  );

  const inViewport = (el) => {
    const rect = el.getBoundingClientRect();
    return (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  };

  const runCount = (el, info) => {
    let slot = state.get(el);
    if (!slot) {
      slot = { raf: 0, busy: false, animated: null };
      state.set(el, slot);
    }
    if (slot.busy || slot.animated === info.text) return;
    if (slot.raf) cancelAnimationFrame(slot.raf);

    countObserver.unobserve(el);
    slot.busy = true;
    const start = performance.now();
    const duration = 1250;

    const frame = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const value = info.number * eased;
      el.textContent = value.toFixed(info.decimals) + info.suffix;
      if (progress < 1) {
        slot.raf = requestAnimationFrame(frame);
      } else {
        el.textContent = info.text;
        slot.raf = 0;
        slot.busy = false;
        slot.animated = info.text;
      }
    };
    slot.raf = requestAnimationFrame(frame);
  };

  function ensureCount(el) {
    if (el.dataset.countTracked !== "1") el.dataset.countTracked = "1";
    let slot = state.get(el);
    if (slot && slot.busy) return;

    const info = parseValue(el);
    if (!info) {
      if (slot && slot.raf) cancelAnimationFrame(slot.raf);
      if (slot) {
        slot.raf = 0;
        slot.busy = false;
      }
      countObserver.unobserve(el);
      return;
    }
    if (slot && slot.animated === info.text) return;

    if (inViewport(el)) {
      runCount(el, info);
    } else {
      countObserver.observe(el);
    }
  }

  const recheckAll = () => {
    document
      .querySelectorAll("[data-reveal]")
      .forEach((el) => trackReveal(el));
    document
      .querySelectorAll("[data-count]")
      .forEach((el) => ensureCount(el));
  };

  /* --- Global scan: catches both initial markup and anything the page
     scripts insert later (stats, analytics cards, etc.) --- */
  recheckAll();

  const mutationObserver = new MutationObserver(recheckAll);
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  /* Small public surface for page scripts. */
  window.HiveReveal = {
    trackCount: (el) => ensureCount(el),
    reveal: (el) => {
      el.classList.add("is-revealed");
      revealObserver.unobserve(el);
    },
  };
})();