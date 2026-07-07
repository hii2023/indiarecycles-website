/* Directional page transitions: pick slide direction from nav order.
   Falls back silently to normal navigation on unsupported browsers. */
(function () {
  if (!('startViewTransition' in document) || !window.navigation) return;

  var ORDER = [
    'index.html', 'about-us.html', 'our-model.html', 'our-impact.html',
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
