/* India Recycles - instant image overrides.
   cms.js can only swap a replaced image after its network request finishes, so the
   original file paints first and visibly flashes. This runs in <head> from a cached
   copy of the last-known image map and rewrites each <img> the moment it is parsed,
   before the browser paints it. cms.js refreshes the cache on every load, so a newly
   replaced image is correct from the next visit onwards. No cache = old behaviour. */
(function () {
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
