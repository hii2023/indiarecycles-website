/* India Recycles - instant image overrides.
   cms.js can only swap a replaced image after its network request finishes, so the
   original file paints first and visibly flashes. This runs in <head> from a cached
   copy of the last-known image map and rewrites each <img> the moment it is parsed,
   before the browser paints it. cms.js refreshes the cache on every load, so a newly
   replaced image is correct from the next visit onwards. No cache = old behaviour. */
(function () {
  /* Perf: route every CMS image (Supabase Storage) through the on-the-fly
     image transformer — resized to the element's rendered width and served as
     WebP. Patching the <img>.src setter here (first script in <head>) covers
     every swap path with no double download, and leaves local images/... and
     already-transformed URLs untouched. Guarded so it installs only once. */
  if (!window.__irImgTx) {
    window.__irImgTx = 1;
    try {
      var _d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        configurable: true, enumerable: _d.enumerable,
        get: function () { return _d.get.call(this); },
        set: function (v) {
          try {
            if (typeof v === 'string' &&
                v.indexOf('/storage/v1/object/public/') > -1 &&
                v.indexOf('/render/image/') === -1) {
              var w = parseInt(this.getAttribute('data-w'), 10) ||
                      parseInt(this.getAttribute('width'), 10) ||
                      Math.round((this.clientWidth || 0) * (window.devicePixelRatio || 1)) ||
                      1200;
              if (w < 200) w = 200;
              if (w > 1600) w = 1600;
              v = v.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') +
                  (v.indexOf('?') > -1 ? '&' : '?') + 'width=' + w + '&quality=70';
            }
          } catch (e) {}
          _d.set.call(this, v);
        }
      });
      /* Images built via innerHTML set their src by attribute parsing, which
         bypasses the setter above. Catch those too: when such an <img> is added
         to the DOM, re-assign its src through the setter (transforming it). They
         are lazy/off-screen, so this fires before any download — no double load. */
      var reapply = function (img) {
        var s = img.getAttribute && img.getAttribute('src');
        if (s && s.indexOf('/storage/v1/object/public/') > -1 && s.indexOf('/render/image/') === -1) {
          img.src = s;
        }
      };
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var nodes = muts[i].addedNodes;
          for (var j = 0; j < nodes.length; j++) {
            var n = nodes[j];
            if (n.nodeType !== 1) continue;
            if (n.tagName === 'IMG') reapply(n);
            else if (n.querySelectorAll) {
              var found = n.querySelectorAll('img');
              for (var k = 0; k < found.length; k++) reapply(found[k]);
            }
          }
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }

  var map;
  try { map = JSON.parse(localStorage.getItem('ir_images') || 'null'); } catch (e) { return; }
  if (!map || typeof map !== 'object') return;

  function apply(img) {
    var key = img.getAttribute('data-img-key');
    var m = (img.getAttribute('src') || '').match(/(?:^|\/)images\/([^\/?#]+)/);
    var name = m && m[1];
    if (key && map[key]) img.src = map[key];
    else if (name && map[name]) img.src = map[name];
    var pos = (key && map[key + '::pos']) || (name && map[name + '::pos']);
    if (pos) img.style.objectPosition = pos;
    var alt = (key && map[key + '::alt']) || (name && map[name + '::alt']);
    if (alt) img.alt = alt;
  }

  var obs = new MutationObserver(function (recs) {
    for (var i = 0; i < recs.length; i++) {
      var added = recs[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var n = added[j];
        if (n.nodeType !== 1) continue;
        if (n.tagName === 'IMG') apply(n);
        else if (n.querySelectorAll) {
          var imgs = n.querySelectorAll('img');
          for (var k = 0; k < imgs.length; k++) apply(imgs[k]);
        }
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', function () {
    obs.disconnect();
    // Safety net for anything the observer missed.
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) apply(imgs[i]);
  });
})();
