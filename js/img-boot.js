/* India Recycles - instant image overrides.
   cms.js can only swap a replaced image after its network request finishes, so the
   original file paints first and visibly flashes. This runs in <head> from a cached
   copy of the last-known image map and rewrites each <img> the moment it is parsed,
   before the browser paints it. cms.js refreshes the cache on every load, so a newly
   replaced image is correct from the next visit onwards. No cache = old behaviour. */
(function () {
  /* Perf: serve every CMS image (Supabase Storage) from a PRE-GENERATED WebP
     variant instead of the on-the-fly image transformer.

     Why: /render/image/ is a METERED Supabase feature. Pro includes only 100
     "origin images" per billing cycle and this site references ~244, so with the
     spend cap on the transformer gets disabled part-way through every cycle and
     every CMS image breaks site-wide until the cycle resets. Variants are plain
     public objects: unmetered, CDN-cacheable, and measurably faster (~0.1-0.3s
     vs 1-3s for a cold transform).

     Variants sit beside the original at  _v/<object-name>/<width>.webp  for the
     widths in LADDER, written at upload time by the ir-upload function (and
     backfilled for images that predate it). They are never upscaled - a step
     wider than the source is just the source re-encoded - so every step always
     exists and a legitimate image never 404s.

     Safety net: if a variant is missing anyway, the first error event restores
     the ORIGINAL url, so a gap degrades to an unoptimised image instead of a
     broken one. Patching the <img>.src setter here (first script in <head>)
     covers every swap path with no double download and leaves local images/...
     alone. Guarded so it installs only once. */
  if (!window.__irImgTx) {
    window.__irImgTx = 1;
    try {
      var SEG = '/storage/v1/object/public/site-images/';
      var LADDER = [400, 800, 1200, 1600];
      var _d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');

      var variantFor = function (img, url) {
        var w = parseInt(img.getAttribute('data-w'), 10) ||
                parseInt(img.getAttribute('width'), 10) ||
                Math.round((img.clientWidth || 0) * (window.devicePixelRatio || 1)) ||
                1200;
        var step = LADDER[LADDER.length - 1];
        for (var i = 0; i < LADDER.length; i++) {
          if (LADDER[i] >= w) { step = LADDER[i]; break; }
        }
        return url.split('?')[0].split('#')[0].replace(SEG, SEG + '_v/') + '/' + step + '.webp';
      };

      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        configurable: true, enumerable: _d.enumerable,
        get: function () { return _d.get.call(this); },
        set: function (v) {
          var self = this;
          try {
            if (typeof v === 'string' && !self.__irRaw &&
                v.indexOf(SEG) > -1 && v.indexOf(SEG + '_v/') === -1) {
              self.__irOriginal = v;
              if (!self.__irBound) {
                self.__irBound = 1;
                self.addEventListener('error', function () {
                  if (self.__irRaw) return;   // already on the original: a real failure
                  self.__irRaw = 1;           // bypass the rewrite on the retry
                  _d.set.call(self, self.__irOriginal);
                });
              }
              v = variantFor(self, v);
            }
          } catch (e) {}
          _d.set.call(this, v);
        }
      });
      /* Images built via innerHTML set their src by attribute parsing, which
         bypasses the setter above. Catch those too: when such an <img> is added
         to the DOM, re-assign its src through the setter. They are lazy/off-screen,
         so this fires before any download - no double load. */
      var reapply = function (img) {
        var s = img.getAttribute && img.getAttribute('src');
        if (s && s.indexOf(SEG) > -1 && s.indexOf(SEG + '_v/') === -1) img.src = s;
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

  /* Below-fold CMS images intentionally ship with NO src attribute; their local
     path sits in data-fallback instead. Reason: those images always have a CMS
     override, so a real src just makes the browser download a local file that
     cms.js immediately replaces - ~2.9 MB of pure waste across the site. The
     preload scanner starts that fetch before any script can rewrite it, so the
     only way to stop it is to not ship a src at all.

     cms.js fills these from the CMS. This is the net for when that does not
     happen (CMS unreachable, entry deleted, cms.js failed) so a slot never stays
     permanently empty. It runs after load, by which point anything real has
     already been set, and it only touches images still lacking a src. */
  (function () {
    function fill() {
      var l = document.querySelectorAll('img[data-fallback]:not([src])');
      for (var i = 0; i < l.length; i++) {
        var fb = l[i].getAttribute('data-fallback');
        if (fb) l[i].src = fb;
      }
    }
    if (document.readyState === 'complete') setTimeout(fill, 600);
    else window.addEventListener('load', function () { setTimeout(fill, 600); });
  })();

  var map;
  try { map = JSON.parse(localStorage.getItem('ir_images') || 'null'); } catch (e) { return; }
  if (!map || typeof map !== 'object') return;

  function apply(img) {
    var key = img.getAttribute('data-img-key');
    // src may be absent by design (see the data-fallback note above), so fall
    // back to that path for the by-filename lookup.
    var m = (img.getAttribute('src') || img.getAttribute('data-fallback') || '')
              .match(/(?:^|\/)images\/([^\/?#]+)/);
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
