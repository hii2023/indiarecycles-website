/* India Recycles - reveal on scroll.
   Sections ease up and fade in as they enter the viewport, so scrolling feels
   smooth and intentional rather than everything being fully painted at once.
   Disabled entirely for anyone who prefers reduced motion. */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  function collect() {
    // Top-level content sections on every page; skip the fixed navbar and footer.
    return [].slice.call(document.querySelectorAll('main > section, body > section'))
      .filter(function (s) { return !s.closest('nav') && !s.querySelector('nav'); });
  }

  function start() {
    var sections = collect();
    if (!sections.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('ir-reveal-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });

    sections.forEach(function (s, i) {
      var r = s.getBoundingClientRect();
      // Anything already on screen at load stays visible - never hide the hero.
      if (r.top < window.innerHeight * 0.92) { s.classList.add('ir-reveal-in'); return; }
      s.classList.add('ir-reveal');
      io.observe(s);
    });

    // Safety net: if a section never triggers (print, odd layouts), reveal after 3s.
    setTimeout(function () {
      document.querySelectorAll('.ir-reveal:not(.ir-reveal-in)').forEach(function (s) {
        s.classList.add('ir-reveal-in');
      });
    }, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

/* Section snapping. After you stop scrolling, the nearest section eases into a
   clean frame - centred under the navbar when it fits on screen, top-aligned when
   it is taller than the screen. It only catches when you settle within half a
   screen of a section edge, so long sections still scroll freely and it never
   fights you mid-read. Custom easing keeps it buttery. Desktop pointers only;
   off for touch and for anyone who prefers reduced motion. */
(function () {
  var mq = window.matchMedia;
  if (!mq) return;
  if (!mq('(min-width: 1024px) and (pointer: fine)').matches) return;
  if (mq('(prefers-reduced-motion: reduce)').matches) return;

  var NAV = 84;         // fixed navbar height (matches scroll-padding-top)
  var CATCH = 0.5;      // only snap when within half a screen of a rest point
  var raf = null, snapping = false, idle = null, prevBehavior = '';

  function sections() { return [].slice.call(document.querySelectorAll('main > section')); }
  function maxScroll() { return Math.max(0, document.documentElement.scrollHeight - window.innerHeight); }

  // Where a section should come to rest: centred if it fits under the navbar,
  // otherwise its top tucked just below the navbar.
  function restFor(sec) {
    var r = sec.getBoundingClientRect();
    var absTop = r.top + window.pageYOffset;
    var avail = window.innerHeight - NAV;
    var target = (r.height <= avail) ? absTop - NAV - (avail - r.height) / 2 : absTop - NAV;
    return Math.max(0, Math.min(Math.round(target), maxScroll()));
  }
  function nearest() {
    var y = window.pageYOffset, best = null, bd = Infinity, secs = sections();
    var cands = secs.map(restFor);
    // The bottom of the page (the footer) is its own valid rest, so you can
    // settle on the footer instead of being yanked back up to the last section.
    cands.push(maxScroll());
    for (var i = 0; i < cands.length; i++) {
      var d = Math.abs(cands[i] - y);
      if (d < bd) { bd = d; best = cands[i]; }
    }
    return { top: best, dist: bd };
  }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function stopGlide() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (snapping) { document.documentElement.style.scrollBehavior = prevBehavior; snapping = false; }
  }
  function glideTo(target) {
    var startY = window.pageYOffset, dist = target - startY;
    if (Math.abs(dist) < 2) return;
    var dur = Math.min(1000, Math.max(520, Math.abs(dist) * 0.95)), t0 = null;
    prevBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';  // keep our per-frame writes instant
    snapping = true;
    (function frame(now) {
      if (t0 === null) t0 = now;
      var p = Math.min(1, (now - t0) / dur);
      window.scrollTo(0, Math.round(startY + dist * ease(p)));
      if (p < 1) { raf = requestAnimationFrame(frame); }
      else { raf = null; document.documentElement.style.scrollBehavior = prevBehavior; snapping = false; }
    })(performance.now());
  }
  function maybeSnap() {
    if (snapping) return;
    if (sections().length < 2) return;
    var n = nearest();
    if (n.top == null || n.dist < 3) return;                 // already framed
    if (n.dist > window.innerHeight * CATCH) return;         // deep inside a long section: leave it
    glideTo(n.top);
  }

  addEventListener('scroll', function () {
    if (snapping) return;               // ignore the scroll events our own glide emits
    clearTimeout(idle);
    idle = setTimeout(maybeSnap, 120);  // wait for trackpad/wheel momentum to settle
  }, { passive: true });

  // Any real user input during a glide hands control straight back to the user.
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (ev) {
    addEventListener(ev, function () {
      if (!snapping) return;
      stopGlide();
      clearTimeout(idle);
      idle = setTimeout(maybeSnap, 180);
    }, { passive: true });
  });
})();
