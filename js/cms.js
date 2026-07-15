/* India Recycles - live content loader.
   Pulls published content from Supabase and applies it over the static HTML.
   Also computes live, auto-incrementing impact numbers from a base count +
   a monthly average growth rate. If the request fails, the page keeps its
   built-in text/numbers (nothing breaks). */
(function () {
  var URL_ = 'https://sqosmiifjqecidxhyjtg.supabase.co';
  var KEY = 'sb_publishable_mq6t15oAQU7f4ZAjXQZA5w_ELcgDfbt';
  var AVG_MONTH_MS = 30.4375 * 24 * 60 * 60 * 1000;

  /* Form submissions: store every submit in Supabase (for the admin inbox) while the
     form's own FormSubmit action still emails + redirects. Attached immediately so a
     fast submit is never missed; the notify-email swap happens once settings load. */
  function irSubmissionType(base, hint) {
    hint = (hint || '').toLowerCase();
    if (hint.indexOf('corporate') !== -1 || hint === 'partner') return 'corporate';
    if (hint.indexOf('drop') !== -1) return 'drop_point';
    if (hint.indexOf('intern') !== -1) return 'intern';
    if (hint.indexOf('pickup') !== -1) return 'pickup';
    if (hint.indexOf('volunteer') !== -1) return 'volunteer';
    if (hint.indexOf('other') !== -1) return 'other';
    return base;
  }
  (function () {
    function wire() {
      document.querySelectorAll('form[data-collect]').forEach(function (form) {
        if (form.__irWired) return; form.__irWired = true;
        form.addEventListener('submit', function () {
          if (form.querySelector('[name="_honey"]') && form.querySelector('[name="_honey"]').value) return;
          var data = {};
          new FormData(form).forEach(function (v, k) {
            if (k.charAt(0) !== '_' && typeof v === 'string' && v.trim()) data[k] = v.trim();
          });
          var type = irSubmissionType(form.getAttribute('data-collect'), data.how_join || data.form_type);
          try {
            fetch(URL_ + '/rest/v1/recycle_submissions', {
              method: 'POST', keepalive: true,
              headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
              body: JSON.stringify({ type: type, data: data })
            });
          } catch (e) {}
          // No preventDefault: the native FormSubmit POST sends the email and redirects.
        });
      });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
    else wire();
  })();
  var FOUNDED_MS = new Date(2017, 0, 1).getTime();

  function daysSinceFounded() {
    return Math.max(30, (Date.now() - FOUNDED_MS) / (24 * 60 * 60 * 1000));
  }

  // A "how fast" note derived from the live value, so it tracks the admin numbers.
  function statNote(key, val) {
    var d = daysSinceFounded(), w = d / 7, mo = d / 30.4375;
    function per(x) { return Math.max(1, Math.round(x)); }
    switch (key) {
      case 'clothes':        return '~' + fmt(per(val / d)) + ' recycled every day';
      case 'sales':          var s = per(val / w); return '~' + fmt(s) + (s === 1 ? ' sale' : ' sales') + ' every week';
      case 'volunteers':     return '~' + fmt(per(val / w)) + ' new joining every week';
      case 'medical':        return '~' + fmt(per(val / mo)) + ' helped every month';
      case 'drop_locations': return 'Across Ahmedabad & Baroda';
      case 'students':       return 'On scholarships every year';
      case 'cities':         return 'Ahmedabad & Vadodara';
      default:               return '';
    }
  }

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

  // Exclude the (potentially large) team section - only the Meet the Team page needs it.
  window.IR_CMS = fetch(URL_ + '/rest/v1/recycle_site_content?section=neq.team&select=section,data', {
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

      /* Image swaps: per-location override by data-img-key first, else by filename */
      var imgMap = content.images || {};
      if (imgMap && typeof imgMap === 'object') {
        document.querySelectorAll('img[src]').forEach(function (img) {
          var key = img.getAttribute('data-img-key');
          if (key && imgMap[key]) { img.src = imgMap[key]; return; }
          var m = (img.getAttribute('src') || '').match(/(?:^|\/)images\/([^\/?#]+)/);
          var name = m && m[1];
          if (name && imgMap[name]) img.src = imgMap[name];
        });
      }

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
      // Derived "how fast" sub-labels (Our Impact page), driven by the same live values
      document.querySelectorAll('[data-stat-sub]').forEach(function (el) {
        var key = el.getAttribute('data-stat-sub');
        var cfg = stats[key];
        if (!cfg) return;
        var note = statNote(key, liveValue(cfg));
        if (note) el.textContent = note;
      });

      /* Reports & Media (Resources page) */
      function esc(t) { var d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; }
      var reportsEl = document.getElementById('reports-list');
      if (reportsEl) {
        var reps = (content.reports && content.reports.items) || [];
        if (reps.length) {
          reportsEl.innerHTML = reps.map(function (r) {
            return '<a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer" class="flex items-center gap-4 bg-white rounded-2xl border border-green-100 p-4 hover:border-green-300 transition-colors">' +
              '<span class="w-11 h-11 rounded-xl bg-green-100 text-green-700 flex items-center justify-center shrink-0"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/></svg></span>' +
              '<span class="min-w-0 flex-1"><span class="block font-semibold text-green-800 text-sm">' + esc(r.title) + '</span>' + (r.date ? '<span class="block text-xs text-green-500 mt-0.5">' + esc(r.date) + '</span>' : '') + '</span>' +
              '<span class="text-green-700 text-sm font-semibold shrink-0">Open</span></a>';
          }).join('');
        }
      }
      var mediaEl = document.getElementById('media-grid');
      if (mediaEl) {
        var med = (content.media && content.media.items) || [];
        if (med.length) {
          mediaEl.innerHTML = med.map(function (m) {
            var inner = '<div class="aspect-[4/3] overflow-hidden bg-green-50">' + (m.image ? '<img src="' + esc(m.image) + '" alt="' + esc(m.title) + '" class="w-full h-full object-cover"/>' : '') + '</div>' +
              (m.title ? '<div class="p-3"><div class="text-sm font-semibold text-green-800 leading-snug">' + esc(m.title) + '</div></div>' : '');
            if (m.link) return '<a href="' + esc(m.link) + '" target="_blank" rel="noopener noreferrer" class="block bg-white rounded-2xl overflow-hidden border border-green-100 hover:border-green-300 transition-colors">' + inner + '</a>';
            return '<div class="bg-white rounded-2xl overflow-hidden border border-green-100">' + inner + '</div>';
          }).join('');
        }
      }

      /* IR Talks (India Recycles Talks page) */
      function ytId(u) {
        if (!u) return '';
        var m = String(u).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{6,})/);
        return m ? m[1] : '';
      }
      var talksEl = document.getElementById('talks-list');
      if (talksEl) {
        var talks = (content.talks && content.talks.items) || [];
        if (talks.length) {
          talksEl.innerHTML = talks.map(function (t) {
            var vid = ytId(t.video);
            var poster = t.photo ? esc(t.photo) : (vid ? 'https://img.youtube.com/vi/' + vid + '/hqdefault.jpg' : '');
            var media = '';
            if (vid) {
              media = '<button type="button" class="ir-talk-play group relative block w-full aspect-video bg-green-900 cursor-pointer" data-embed="https://www.youtube.com/embed/' + vid + '?autoplay=1&rel=0" aria-label="Play video">' +
                (poster ? '<img src="' + poster + '" alt="" class="w-full h-full object-cover"/>' : '') +
                '<span class="absolute inset-0 flex items-center justify-center"><span class="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform"><svg class="w-7 h-7 text-white ml-1" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span></span></button>';
            } else if (poster) {
              media = '<div class="aspect-video bg-green-50"><img src="' + poster + '" alt="" class="w-full h-full object-cover"/></div>';
            }
            var host = '';
            if (t.host_name || t.host_url) {
              var hn = esc(t.host_name || 'Host');
              host = '<div class="mt-4 pt-4 border-t border-green-100 text-sm text-green-600">Featuring ' +
                (t.host_url ? '<a href="' + esc(t.host_url) + '" target="_blank" rel="noopener noreferrer" class="text-green-700 font-semibold hover:underline">' + hn + '</a>' : '<span class="text-green-700 font-semibold">' + hn + '</span>') +
                '</div>';
            }
            return '<article class="rounded-2xl border border-green-100 overflow-hidden bg-white flex flex-col shadow-sm">' +
              media +
              '<div class="p-5 flex-1 flex flex-col">' +
                '<h3 class="text-lg font-semibold text-green-800">' + esc(t.title) + '</h3>' +
                (t.description ? '<p class="text-green-600 text-sm mt-2 leading-relaxed flex-1">' + esc(t.description) + '</p>' : '') +
                host +
              '</div></article>';
          }).join('');
          talksEl.addEventListener('click', function (e) {
            var btn = e.target.closest('.ir-talk-play');
            if (!btn) return;
            var src = btn.getAttribute('data-embed');
            var wrap = document.createElement('div');
            wrap.className = 'aspect-video';
            wrap.innerHTML = '<iframe src="' + src + '" class="w-full h-full" style="border:0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
            btn.replaceWith(wrap);
          });
        }
      }

      /* Testimonials (homepage Community Voices) */
      var tmEl = document.getElementById('testimonials-list');
      if (tmEl) {
        var tms = (content.testimonials && content.testimonials.items) || [];
        if (tms.length) {
          var star = '<svg class="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
          var stars = '<div class="flex gap-0.5 mb-4" aria-label="5 stars">' + star + star + star + star + star + '</div>';
          tmEl.innerHTML = tms.map(function (t) {
            var nm = (t.name || '').trim();
            var initials = (nm || '?').split(/\s+/).map(function (w) { return w.charAt(0); }).slice(0, 2).join('').toUpperCase();
            var avatar = t.photo
              ? '<div class="w-11 h-11 rounded-full overflow-hidden bg-green-100 shrink-0"><img src="' + esc(t.photo) + '" alt="' + esc(nm) + '" class="w-full h-full object-cover"/></div>'
              : '<div class="w-11 h-11 rounded-full bg-green-100 text-green-700 font-semibold flex items-center justify-center shrink-0 text-sm">' + esc(initials) + '</div>';
            return '<div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col">' +
              stars +
              '<p class="text-gray-800 text-[14px] leading-relaxed italic flex-1">' + (t.quote ? '&ldquo;' + esc(t.quote) + '&rdquo;' : '') + '</p>' +
              '<div class="mt-5 flex items-center gap-3">' + avatar +
                '<div><div class="font-semibold text-green-800 text-sm">' + esc(nm) + '</div>' +
                (t.role ? '<div class="text-gray-500 text-xs">' + esc(t.role) + '</div>' : '') + '</div>' +
              '</div></div>';
          }).join('');
        }
      }

      /* Partners (Our Partners page) */
      var partnersEl = document.getElementById('partners-list');
      if (partnersEl) {
        var partners = (content.partners && content.partners.items) || [];
        if (partners.length) {
          partnersEl.innerHTML = partners.map(function (p) {
            var logo = p.logo
              ? '<div class="h-16 flex items-center mb-4"><img src="' + esc(p.logo) + '" alt="' + esc(p.name) + '" class="max-h-16 max-w-[70%] object-contain"/></div>'
              : '<div class="h-16 flex items-center mb-4"><span class="text-green-800 font-semibold text-lg">' + esc(p.name) + '</span></div>';
            var inner = logo +
              (p.name ? '<h3 class="font-semibold text-green-800">' + esc(p.name) + '</h3>' : '') +
              (p.description ? '<p class="text-green-600 text-sm mt-1 leading-relaxed">' + esc(p.description) + '</p>' : '') +
              (p.link ? '<span class="mt-3 inline-flex items-center gap-1 text-green-700 text-sm font-semibold">Visit site <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span>' : '');
            if (p.link) return '<a href="' + esc(p.link) + '" target="_blank" rel="noopener noreferrer" class="block rounded-2xl border border-green-100 bg-white p-6 hover:border-green-300 transition-colors">' + inner + '</a>';
            return '<div class="rounded-2xl border border-green-100 bg-white p-6">' + inner + '</div>';
          }).join('');
        }
      }

      /* Corporate tie-ups & internships (Our Partners page) */
      var corpEl = document.getElementById('corporate-list');
      if (corpEl) {
        var corps = (content.corporate && content.corporate.items) || [];
        if (corps.length) {
          corpEl.innerHTML = corps.map(function (c) {
            var inner = c.logo
              ? '<img src="' + esc(c.logo) + '" alt="' + esc(c.name) + '" class="max-h-16 max-w-full object-contain"/>'
              : '<span class="text-green-800 font-semibold text-center text-sm">' + esc(c.name) + '</span>';
            var cls = 'flex items-center justify-center h-24 rounded-2xl border border-green-100 bg-white p-4';
            if (c.link) return '<a href="' + esc(c.link) + '" target="_blank" rel="noopener noreferrer" title="' + esc(c.name) + '" class="' + cls + ' hover:border-green-300 transition-colors">' + inner + '</a>';
            return '<div title="' + esc(c.name) + '" class="' + cls + '">' + inner + '</div>';
          }).join('');
        }
      }

      /* Photo gallery (Our Impact page) */
      var galEl = document.getElementById('gallery-list');
      if (galEl) {
        var gal = (content.gallery && content.gallery.items) || [];
        if (gal.length) {
          galEl.innerHTML = gal.map(function (g) {
            var cap = g.caption ? '<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3"><span class="text-white text-xs font-medium">' + esc(g.caption) + '</span></div>' : '';
            return '<div class="relative rounded-3xl overflow-hidden aspect-square"><img src="' + esc(g.photo) + '" alt="' + esc(g.caption || '') + '" class="w-full h-full object-cover"/>' + cap + '</div>';
          }).join('');
        }
      }

      /* Events (Events page: upcoming + past) */
      var evUp = document.getElementById('events-upcoming');
      var evPast = document.getElementById('events-past');
      if (evUp || evPast) {
        var evItems = (content.events && content.events.items) || [];
        var eventCard = function (ev) {
          var photo = ev.photo ? '<div class="aspect-[16/10] bg-green-50"><img src="' + esc(ev.photo) + '" alt="' + esc(ev.title) + '" class="w-full h-full object-cover"/></div>' : '';
          var when = ev.when ? '<span class="inline-flex items-center gap-1 text-xs font-semibold text-green-600"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>' + esc(ev.when) + '</span>' : '';
          var loc = ev.location ? '<div class="text-green-500 text-sm mt-1 inline-flex items-center gap-1"><svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>' + esc(ev.location) + '</div>' : '';
          return '<article class="rounded-2xl border border-green-100 bg-white overflow-hidden flex flex-col shadow-sm">' + photo +
            '<div class="p-5 flex-1 flex flex-col">' + when +
              '<h3 class="text-lg font-semibold text-green-800 mt-1">' + esc(ev.title) + '</h3>' + loc +
              (ev.description ? '<p class="text-green-600 text-sm mt-2 leading-relaxed flex-1">' + esc(ev.description) + '</p>' : '') +
            '</div></article>';
        };
        var fillBucket = function (el, list) {
          if (!el) return;
          var sec = el.closest('section');
          if (!list.length) { if (evItems.length && sec) sec.style.display = 'none'; return; }
          el.innerHTML = list.map(eventCard).join('');
        };
        fillBucket(evUp, evItems.filter(function (e) { return (e.status || 'upcoming') === 'upcoming'; }));
        fillBucket(evPast, evItems.filter(function (e) { return e.status === 'past'; }));
      }

      /* Community Impact causes (Our Impact page) */
      var causesEl = document.getElementById('causes-list');
      if (causesEl) {
        var causes = (content.causes && content.causes.items) || [];
        if (causes.length) {
          causesEl.innerHTML = causes.map(function (cu) {
            var photo = cu.photo ? '<div class="aspect-[16/10] bg-green-50"><img src="' + esc(cu.photo) + '" alt="' + esc(cu.name) + '" class="w-full h-full object-cover"/></div>' : '';
            var loc = cu.location ? '<div class="text-green-500 text-sm mt-1 inline-flex items-center gap-1"><svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>' + esc(cu.location) + '</div>' : '';
            return '<article class="rounded-2xl border border-green-100 bg-white overflow-hidden flex flex-col shadow-sm">' + photo +
              '<div class="p-5 flex-1 flex flex-col">' +
                '<h3 class="text-lg font-semibold text-green-800">' + esc(cu.name) + '</h3>' + loc +
                (cu.description ? '<p class="text-green-600 text-sm mt-2 leading-relaxed flex-1">' + esc(cu.description) + '</p>' : '') +
              '</div></article>';
          }).join('');
        }
      }

      /* Videos (homepage "See Us in Action") */
      var vidsEl = document.getElementById('videos-list');
      if (vidsEl) {
        var vids = (content.videos && content.videos.items) || [];
        if (vids.length) {
          var vsec = document.getElementById('videos-section');
          if (vsec) vsec.style.display = '';
          vidsEl.innerHTML = vids.map(function (v) {
            var vid = ytId(v.video);
            var poster = v.photo ? esc(v.photo) : (vid ? 'https://img.youtube.com/vi/' + vid + '/hqdefault.jpg' : '');
            var media = '';
            if (vid) {
              media = '<button type="button" class="ir-talk-play group relative block w-full aspect-video bg-green-900 cursor-pointer" data-embed="https://www.youtube.com/embed/' + vid + '?autoplay=1&rel=0" aria-label="Play video">' +
                (poster ? '<img src="' + poster + '" alt="" class="w-full h-full object-cover"/>' : '') +
                '<span class="absolute inset-0 flex items-center justify-center"><span class="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform"><svg class="w-7 h-7 text-white ml-1" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span></span></button>';
            }
            return '<article class="rounded-2xl border border-green-100 overflow-hidden bg-white flex flex-col shadow-sm">' + media +
              '<div class="p-5 flex-1 flex flex-col">' +
                (v.title ? '<h3 class="text-lg font-semibold text-green-800">' + esc(v.title) + '</h3>' : '') +
                (v.description ? '<p class="text-green-600 text-sm mt-2 leading-relaxed flex-1">' + esc(v.description) + '</p>' : '') +
              '</div></article>';
          }).join('');
          vidsEl.addEventListener('click', function (e) {
            var btn = e.target.closest('.ir-talk-play');
            if (!btn) return;
            var wrap = document.createElement('div');
            wrap.className = 'aspect-video';
            wrap.innerHTML = '<iframe src="' + btn.getAttribute('data-embed') + '" class="w-full h-full" style="border:0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
            btn.replaceWith(wrap);
          });
        }
      }

      /* Configurable notification email: point FormSubmit at the admin-set address */
      var notify = content.settings && content.settings.notify_email;
      if (notify && /@/.test(notify)) {
        document.querySelectorAll('form[data-collect]').forEach(function (form) {
          var act = form.getAttribute('action') || '';
          if (act.indexOf('formsubmit.co') !== -1) form.setAttribute('action', 'https://formsubmit.co/' + notify);
        });
      }

      /* Pickup-request form toggle (settings.pickup_enabled) */
      var pickupOn = !(content.settings && content.settings.pickup_enabled === false);
      document.querySelectorAll('[data-pickup-form]').forEach(function (el) {
        el.style.display = pickupOn ? '' : 'none';
      });

      content.get = get;
      return content;
    })
    .catch(function () { return { get: function () { return undefined; } }; });
})();
