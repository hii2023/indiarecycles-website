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
