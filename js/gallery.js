/* India Recycles - photo galleries.
   Shows the first few photos with a "Show all" toggle instead of dumping every
   picture on the page, and opens any photo full size in a lightbox.
   Applies to any grid marked data-gallery; re-runs after cms.js rebuilds a grid. */
(function () {
  var STEP = 6;              // photos visible before "Show all"
  var lb, lbImg, lbCap, lbCount, lastFocus, current = [], idx = 0;

  function tilesOf(grid) {
    return Array.prototype.filter.call(grid.children, function (el) {
      return el.nodeType === 1 && el.querySelector('img');
    });
  }

  /* ── Lightbox ─────────────────────────────────────────────── */
  function buildLightbox() {
    if (lb) return;
    lb = document.createElement('div');
    lb.className = 'ir-lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Photo viewer');
    lb.innerHTML =
      '<button class="ir-lb-close" aria-label="Close photo">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>' +
      '<button class="ir-lb-nav ir-lb-prev" aria-label="Previous photo">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>' +
      '</button>' +
      '<figure class="ir-lb-fig">' +
        '<img class="ir-lb-img" alt=""/>' +
        '<figcaption class="ir-lb-cap"></figcaption>' +
      '</figure>' +
      '<button class="ir-lb-nav ir-lb-next" aria-label="Next photo">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>' +
      '</button>' +
      '<div class="ir-lb-count" aria-live="polite"></div>';
    document.body.appendChild(lb);
    lbImg = lb.querySelector('.ir-lb-img');
    lbCap = lb.querySelector('.ir-lb-cap');
    lbCount = lb.querySelector('.ir-lb-count');

    lb.querySelector('.ir-lb-close').addEventListener('click', close);
    lb.querySelector('.ir-lb-prev').addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
    lb.querySelector('.ir-lb-next').addEventListener('click', function (e) { e.stopPropagation(); step(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.closest('.ir-lb-fig') === null) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });
    // swipe on touch devices
    var x0 = null;
    lb.addEventListener('touchstart', function (e) { x0 = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) step(dx < 0 ? 1 : -1);
      x0 = null;
    }, { passive: true });
  }

  function show(i) {
    idx = (i + current.length) % current.length;
    var src = current[idx];
    lbImg.src = src.full;
    lbImg.alt = src.alt || '';
    lbCap.textContent = src.alt || '';
    lbCap.style.display = src.alt ? '' : 'none';
    lbCount.textContent = (idx + 1) + ' / ' + current.length;
    var multi = current.length > 1;
    lb.querySelector('.ir-lb-prev').style.display = multi ? '' : 'none';
    lb.querySelector('.ir-lb-next').style.display = multi ? '' : 'none';
    lbCount.style.display = multi ? '' : 'none';
  }

  function step(d) { if (current.length) show(idx + d); }

  function open(list, i) {
    buildLightbox();
    current = list;
    lastFocus = document.activeElement;
    show(i);
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    lb.querySelector('.ir-lb-close').focus();
  }

  function close() {
    if (!lb) return;
    lb.classList.remove('open');
    document.body.style.overflow = '';
    lbImg.removeAttribute('src');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ── Grid: limit to STEP photos + "Show all" ───────────────── */
  function initGrid(grid) {
    var tiles = tilesOf(grid);
    if (!tiles.length) return;

    // clean up anything from a previous run (cms.js may have rebuilt the grid)
    var oldBtn = grid.parentNode.querySelector('[data-gallery-more]');
    if (oldBtn) oldBtn.remove();

    var list = tiles.map(function (t) {
      var img = t.querySelector('img');
      return { full: img.currentSrc || img.src, alt: img.getAttribute('alt') || '' };
    });

    tiles.forEach(function (t, i) {
      t.style.display = i < STEP ? '' : 'none';
      if (!t.__irBound) {
        t.__irBound = true;
        t.classList.add('ir-lb-tile');
        t.setAttribute('role', 'button');
        t.setAttribute('tabindex', '0');
        t.setAttribute('aria-label', 'Open photo' + (list[i].alt ? ': ' + list[i].alt : ''));
        t.addEventListener('click', function () { open(list, tiles.indexOf(t)); });
        t.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(list, tiles.indexOf(t)); }
        });
      }
    });

    if (tiles.length <= STEP) return;

    var wrap = document.createElement('div');
    wrap.className = 'text-center mt-7';
    wrap.setAttribute('data-gallery-more', '');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ir-more-btn';
    var expanded = false;
    function label() {
      btn.innerHTML = (expanded ? 'Show fewer photos' : 'Show all ' + tiles.length + ' photos') +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="transform:rotate(' + (expanded ? 180 : 0) + 'deg)"><path d="m6 9 6 6 6-6"/></svg>';
      btn.setAttribute('aria-expanded', String(expanded));
    }
    btn.addEventListener('click', function () {
      expanded = !expanded;
      tiles.forEach(function (t, i) { t.style.display = (expanded || i < STEP) ? '' : 'none'; });
      label();
      if (!expanded) grid.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    label();
    wrap.appendChild(btn);
    grid.parentNode.insertBefore(wrap, grid.nextSibling);
  }

  function initAll() {
    document.querySelectorAll('[data-gallery]').forEach(initGrid);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();

  // cms.js replaces some grids' contents after its fetch resolves - re-run then.
  if (window.IR_CMS && window.IR_CMS.then) window.IR_CMS.then(function () { setTimeout(initAll, 0); }, function () {});
  window.IR_GALLERY_REFRESH = initAll;
})();
