/* Ensure #hash links land on their section even when the page arrives
   through a cross-document view transition (which can swallow the
   browser's own anchor scroll). */
(function () {
  function go() {
    if (!location.hash) return;
    var el = null;
    try { el = document.querySelector(location.hash); } catch (e) { return; }
    if (el) el.scrollIntoView({ block: 'start' });
  }
  window.addEventListener('pagereveal', function () { setTimeout(go, 80); });
  window.addEventListener('load', function () { setTimeout(go, 80); });
})();

/* Mobile back chip: every sub-page gets a clear way back.
   Goes to the previous page when you arrived from within the site,
   otherwise straight to the homepage. Hidden on desktop and on the homepage. */
(function () {
  function init() {
    var file = location.pathname.split('/').pop() || 'index.html';
    if (file === '' || file === 'index.html') return;
    var slot = document.querySelector('nav > div');
    if (!slot || slot.querySelector('.ir-back')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ir-back';
    btn.setAttribute('aria-label', 'Go back');
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
    btn.addEventListener('click', function () {
      var cameFromSite = document.referrer && document.referrer.indexOf(location.host) !== -1;
      if (history.length > 1 && cameFromSite) history.back();
      else location.href = 'index.html';
    });
    slot.insertBefore(btn, slot.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* Directional page transitions: pick slide direction from nav order.
   Falls back silently to normal navigation on unsupported browsers. */
(function () {
  if (!('startViewTransition' in document) || !window.navigation) return;

  var ORDER = [
    'index.html', 'about-us.html', 'our-model.html', 'our-impact.html', 'impact-calculator.html', 'resources.html',
    'zero-waste-promise.html', 'revibe.html', 'our-partners.html',
    'careers.html', 'volunteer.html', 'drop-locations.html',
    'contact.html', 'donate.html', 'thank-you.html'
  ];

  function fileOf(url) {
    try {
      var f = new URL(url, location.href).pathname.split('/').pop();
      return f || 'index.html';
    } catch (e) { return null; }
  }

  function direction(fromUrl, toUrl) {
    var a = ORDER.indexOf(fileOf(fromUrl));
    var b = ORDER.indexOf(fileOf(toUrl));
    if (a === -1 || b === -1 || a === b) return 'forward';
    return b > a ? 'forward' : 'back';
  }

  // Outgoing page: tag the transition so the old snapshot animates correctly.
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.from || !e.activation.entry) return;
    e.viewTransition.types.add(direction(e.activation.from.url, e.activation.entry.url));
  });

  // Incoming page: tag it the same way so the new snapshot matches.
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    var act = window.navigation.activation;
    if (!act || !act.from || !act.entry) return;
    e.viewTransition.types.add(direction(act.from.url, act.entry.url));
  });
})();
