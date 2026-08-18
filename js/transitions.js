/* Exit guard: if pressing Back would LEAVE the site (you arrived from outside),
   trap that first Back press and ask before actually leaving. In-site Back is
   never touched. MPA-safe: arms only on pages whose referrer is off-site. */
(function () {
  if (window.__irExitGuard) return;
  var host = location.host;
  var internal = document.referrer && (function () {
    try { return new URL(document.referrer).host === host; } catch (e) { return false; }
  })();
  if (internal) return;               // came from within the site: leave Back alone
  window.__irExitGuard = true;

  history.pushState({ irExit: 1 }, '');   // trap entry
  var leaving = false;

  window.addEventListener('popstate', function () {
    if (leaving) return;
    history.pushState({ irExit: 1 }, '');  // hold position while we ask
    ask();
  });

  function close() { var m = document.getElementById('ir-exit-modal'); if (m) m.remove(); }

  function ask() {
    if (document.getElementById('ir-exit-modal')) return;
    var w = document.createElement('div');
    w.id = 'ir-exit-modal';
    w.setAttribute('role', 'dialog');
    w.setAttribute('aria-modal', 'true');
    w.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(10,28,17,0.55);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);';
    w.innerHTML =
      '<div style="background:#fff;border-radius:20px;max-width:340px;width:100%;padding:24px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.25);font-family:Inter,system-ui,sans-serif;">' +
        '<div style="font-size:17px;font-weight:700;color:#133a28;margin-bottom:6px;">Leave India Recycles?</div>' +
        '<div style="font-size:14px;color:#4b5563;line-height:1.5;margin-bottom:20px;">You are about to leave the site. Stay on the page, or go back?</div>' +
        '<div style="display:flex;gap:10px;">' +
          '<button id="ir-exit-stay" style="flex:1;padding:12px;border:none;border-radius:12px;background:#256b49;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">Stay</button>' +
          '<button id="ir-exit-leave" style="flex:1;padding:12px;border:1px solid #d1d5db;border-radius:12px;background:#fff;color:#374151;font-size:14px;font-weight:600;cursor:pointer;">Leave</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(w);
    document.getElementById('ir-exit-stay').addEventListener('click', close);
    document.getElementById('ir-exit-leave').addEventListener('click', function () {
      leaving = true; close(); history.go(-2);
    });
    w.addEventListener('click', function (e) { if (e.target === w) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }
})();

/* Ensure #hash links land on their section even when the page arrives
   through a cross-document view transition (which can swallow the
   browser's own anchor scroll). */
(function () {
  var NAVOFFSET = 88;   // keep the target clear of the fixed navbar
  function go() {
    if (!location.hash) return;
    var el = null;
    try { el = document.querySelector(location.hash); } catch (e) { return; }
    if (!el) return;
    // If the target is still mid reveal-animation it carries a transform that
    // throws off the measured position - land it first so the maths is stable.
    el.classList.remove('ir-reveal'); el.classList.add('ir-reveal-in');
    var lastY = -1;
    function jump(force) {
      // Never fight the user: if they've scrolled away from where we last landed,
      // stop re-correcting and hand control back.
      if (!force && lastY >= 0 && Math.abs(window.pageYOffset - lastY) > 4) return;
      var y = Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - NAVOFFSET);
      var h = document.documentElement, prev = h.style.scrollBehavior;
      h.style.scrollBehavior = 'auto';        // instant landing, not a long glide
      window.scrollTo(0, y);
      h.style.scrollBehavior = prev;
      lastY = window.pageYOffset;
    }
    jump(true);
    // Content below the hero (e.g. the calculator grid) builds after load and can
    // nudge the layout; re-correct only while the user hasn't taken over.
    setTimeout(jump, 120);
    setTimeout(jump, 350);
  }
  window.addEventListener('pagereveal', function () { setTimeout(go, 60); });
  window.addEventListener('load', function () { setTimeout(go, 60); });
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
