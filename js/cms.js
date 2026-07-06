/* India Recycles - live content loader.
   Pulls published content from Supabase and applies it over the static HTML.
   Also computes live, auto-incrementing impact numbers from a base count +
   a monthly average growth rate. If the request fails, the page keeps its
   built-in text/numbers (nothing breaks). */
(function () {
  var URL_ = 'https://sqosmiifjqecidxhyjtg.supabase.co';
  var KEY = 'sb_publishable_mq6t15oAQU7f4ZAjXQZA5w_ELcgDfbt';
  var AVG_MONTH_MS = 30.4375 * 24 * 60 * 60 * 1000;

  function monthsElapsed(asOf) {
    // asOf is "YYYY-MM" (start of that month). Returns fractional months to now, >= 0.
    if (!asOf) return 0;
    var p = String(asOf).split('-');
    var start = new Date(Number(p[0]), (Number(p[1]) || 1) - 1, 1).getTime();
    var m = (Date.now() - start) / AVG_MONTH_MS;
    return m > 0 ? m : 0;
  }

  function liveValue(cfg) {
    var base = Number(cfg && cfg.base) || 0;
    var per = Number(cfg && cfg.per_month) || 0;
    return Math.floor(base + per * monthsElapsed(cfg && cfg.as_of));
  }

  function fmt(n) {
    return Number(n).toLocaleString('en-IN');
  }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function paintStat(el, value, suffix, suffixClass) {
    el.textContent = fmt(value);
    if (suffix) {
      var s = document.createElement('span');
      if (suffixClass) s.className = suffixClass;
      s.textContent = suffix;
      el.appendChild(s);
    }
  }

  function setStat(el, value, suffix) {
    var span = el.querySelector('span');
    var suffixClass = span ? span.className : '';
    // Paint the final value first so it is always correct, even without animation.
    paintStat(el, value, suffix, suffixClass);
    if (reduceMotion || value < 20) return;
    // Optional count-up flourish (uses timers so it works even when rAF is throttled).
    var start = performance.now(), dur = 1200;
    var timer = setInterval(function () {
      var p = Math.min((performance.now() - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      paintStat(el, Math.floor(value * eased), suffix, suffixClass);
      if (p >= 1) { clearInterval(timer); paintStat(el, value, suffix, suffixClass); }
    }, 40);
  }

  window.IR_CMS = fetch(URL_ + '/rest/v1/recycle_site_content?select=section,data', {
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }
  })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) {
      var content = {};
      rows.forEach(function (r) { content[r.section] = r.data || {}; });

      function get(path) {
        var p = path.split('.');
        return content[p[0]] ? content[p[0]][p[1]] : undefined;
      }

      /* Plain text swaps */
      document.querySelectorAll('[data-cms]').forEach(function (el) {
        var v = get(el.getAttribute('data-cms'));
        if (typeof v === 'string' && v.trim()) el.textContent = v;
      });

      /* Live impact numbers: base + monthly-average growth */
      var stats = content.stats || {};
      window.IR_STATS = stats;
      window.IR_LIVE = function (key) {
        return stats[key] ? liveValue(stats[key]) : null;
      };
      document.querySelectorAll('[data-stat]').forEach(function (el) {
        var cfg = stats[el.getAttribute('data-stat')];
        if (!cfg) return;
        setStat(el, liveValue(cfg), (cfg.suffix || ''));
      });

      content.get = get;
      return content;
    })
    .catch(function () { return { get: function () { return undefined; } }; });
})();
