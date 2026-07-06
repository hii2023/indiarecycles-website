/* India Recycles - live content loader.
   Pulls published content from Supabase and applies it over the static HTML.
   If the request fails, the page keeps its built-in text (nothing breaks). */
(function () {
  var URL_ = 'https://sqosmiifjqecidxhyjtg.supabase.co';
  var KEY = 'sb_publishable_mq6t15oAQU7f4ZAjXQZA5w_ELcgDfbt';

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

      /* Stat numbers whose trailing + is a styled span; keep the span's color */
      document.querySelectorAll('[data-cms-plus]').forEach(function (el) {
        var v = get(el.getAttribute('data-cms-plus'));
        if (typeof v === 'string' && v.trim()) {
          var old = el.querySelector('span');
          var cls = old ? old.className : 'text-green-400';
          if (v.slice(-1) === '+') {
            el.textContent = v.slice(0, -1);
            var s = document.createElement('span');
            s.className = cls;
            s.textContent = '+';
            el.appendChild(s);
          } else {
            el.textContent = v;
          }
        }
      });

      content.get = get;
      return content;
    })
    .catch(function () { return { get: function () { return undefined; } }; });
})();
