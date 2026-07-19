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

  // This script tag sits before the end of <body>, so elements like the sticky CTA bar
  // are not parsed yet. A cached/fast response can resolve before the parser gets there,
  // leaving those elements untouched - wait for the DOM before applying anything.
  function domReady() {
    return new Promise(function (res) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', res, { once: true });
      else res();
    });
  }

  var CACHE_KEY = 'ir_cms';
  var bound = {};            // listeners are attached once, even if applied twice

  /* Order a list by its optional Date field. ascending=true gives soonest-first,
     false gives newest-first. Entries without a date keep the order set in the
     admin and sit after the dated ones, so nothing disappears or jumps around. */
  function sortByDate(items, ascending) {
    var withDate = [], without = [];
    items.forEach(function (it, i) {
      var t = it && it.date ? Date.parse(it.date) : NaN;
      (isNaN(t) ? without : withDate).push({ it: it, t: t, i: i });
    });
    withDate.sort(function (a, b) { return ascending ? a.t - b.t : b.t - a.t; });
    if (!ascending) without.reverse();   // newest-added first when there is no date
    return withDate.concat(without).map(function (x) { return x.it; });
  }

  function applyContent(rows) {
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
        // Cache for js/img-boot.js, which applies these before paint on the next load.
        try { localStorage.setItem('ir_images', JSON.stringify(imgMap)); } catch (e) {}
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
            // Supabase serves storage objects inline, so a click loaded a multi-MB PDF
            // into the browser viewer and felt like nothing happened. ?download=<name>
            // sets Content-Disposition: attachment, so it saves straight away.
            var href = r.url;
            if (/\/storage\/v1\/object\/public\//.test(href) && href.indexOf('download') === -1) {
              var fname = (r.title || 'India-Recycles').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');
              var ext = (href.split('?')[0].match(/\.([a-z0-9]{2,5})$/i) || [, 'pdf'])[1];
              href += (href.indexOf('?') === -1 ? '?' : '&') + 'download=' + encodeURIComponent(fname + '.' + ext);
            }
            return '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" class="flex items-center gap-4 bg-white rounded-2xl border border-green-100 p-4 hover:border-green-300 transition-colors">' +
              '<span class="w-11 h-11 rounded-xl bg-green-100 text-green-700 flex items-center justify-center shrink-0"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/></svg></span>' +
              '<span class="min-w-0 flex-1"><span class="block font-semibold text-green-800 text-sm">' + esc(r.title) + '</span>' + (r.date ? '<span class="block text-xs text-green-500 mt-0.5">' + esc(r.date) + '</span>' : '') + '</span>' +
              '<span class="text-green-700 text-sm font-semibold shrink-0">Download</span></a>';
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
        /* IR page main image (configurable) */
        var talkImg = content.talks && content.talks.image;
        if (talkImg) { var irHero = document.querySelector('img[data-img-key="ir-talks-1"]'); if (irHero) irHero.src = talkImg; }
        var talks = sortByDate((content.talks && content.talks.items) || [], false);
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
            var parts = [];
            if (t.host_name) parts.push('<div><span class="text-green-400">Host:</span> <span class="text-green-700 font-semibold">' + esc(t.host_name) + '</span></div>');
            if (t.guest_name) {
              var g = t.guest_url ? '<a href="' + esc(t.guest_url) + '" target="_blank" rel="noopener noreferrer" class="text-green-700 font-semibold hover:underline">' + esc(t.guest_name) + '</a>' : '<span class="text-green-700 font-semibold">' + esc(t.guest_name) + '</span>';
              parts.push('<div><span class="text-green-400">Guest:</span> ' + g + '</div>');
            }
            var meta = parts.length ? '<div class="mt-4 pt-4 border-t border-green-100 text-sm text-green-600 space-y-0.5">' + parts.join('') + '</div>' : '';
            return '<article class="rounded-2xl border border-green-100 overflow-hidden bg-white flex flex-col shadow-sm">' +
              media +
              '<div class="p-5 flex-1 flex flex-col">' +
                '<h3 class="text-lg font-semibold text-green-800">' + esc(t.title) + '</h3>' +
                (t.description ? '<p class="text-green-600 text-sm mt-2 leading-relaxed flex-1" style="white-space:pre-line">' + esc(t.description) + '</p>' : '') +
                meta +
              '</div></article>';
          }).join('');
          if (!bound.talks) { bound.talks = true;
          talksEl.addEventListener('click', function (e) {
            var btn = e.target.closest('.ir-talk-play');
            if (!btn) return;
            var src = btn.getAttribute('data-embed');
            var wrap = document.createElement('div');
            wrap.className = 'aspect-video';
            wrap.innerHTML = '<iframe src="' + src + '" class="w-full h-full" style="border:0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
            btn.replaceWith(wrap);
          }); }
        }
      }

      /* Testimonials (homepage Community Voices) */
      var tmEl = document.getElementById('testimonials-list');
      if (tmEl) {
        var tms = (content.testimonials && content.testimonials.items) || [];
        if (tms.length) {
          var star = '<svg class="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
          var stars = '<div class="flex gap-0.5 mb-4" aria-label="5 stars">' + star + star + star + star + star + '</div>';
          tmEl.innerHTML = tms.map(function (t, i) {
            var nm = (t.name || '').trim();
            var initials = (nm || '?').split(/\s+/).map(function (w) { return w.charAt(0); }).slice(0, 2).join('').toUpperCase();
            var avatar = t.photo
              ? '<div class="w-11 h-11 rounded-full overflow-hidden bg-green-100 shrink-0"><img src="' + esc(t.photo) + '" alt="' + esc(nm) + '" class="w-full h-full object-cover"/></div>'
              : '<div class="w-11 h-11 rounded-full bg-green-100 text-green-700 font-semibold flex items-center justify-center shrink-0 text-sm">' + esc(initials) + '</div>';
            return '<div class="ir-tm-card bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col" role="button" tabindex="0" data-tm="' + i + '" aria-label="Read what ' + esc(nm || 'this person') + ' said">' +
              stars +
              '<p class="text-gray-800 text-[14px] leading-relaxed italic flex-1">' + (t.quote ? '&ldquo;' + esc(t.quote) + '&rdquo;' : '') + '</p>' +
              '<div class="mt-5 flex items-center gap-3">' + avatar +
                '<div><div class="font-semibold text-green-800 text-sm">' + esc(nm) + '</div>' +
                (t.role ? '<div class="text-gray-500 text-xs">' + esc(t.role) + '</div>' : '') + '</div>' +
              '</div></div>';
          }).join('');

          /* Clicking a voice opens it in full - photo, whole quote, who they are. */
          var tmModal = document.querySelector('.ir-tm-modal') || document.createElement('div');
          var tmFresh = !tmModal.parentNode;
          tmModal.className = 'ir-tm-modal';
          tmModal.setAttribute('role', 'dialog');
          tmModal.setAttribute('aria-modal', 'true');
          if (tmFresh) tmModal.innerHTML =
            '<div class="ir-tm-box">' +
              '<button class="ir-tm-close" aria-label="Close">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
              '</button>' +
              '<div class="ir-tm-media"></div>' +
              '<div class="ir-tm-body">' +
                '<div class="ir-tm-stars">' + stars + '</div>' +
                '<blockquote class="ir-tm-quote"></blockquote>' +
                '<div class="ir-tm-who"><div class="ir-tm-name"></div><div class="ir-tm-role"></div></div>' +
              '</div>' +
            '</div>';
          if (tmFresh) document.body.appendChild(tmModal);
          var tmLast;
          function tmOpen(i) {
            var t = tms[i]; if (!t) return;
            var nm2 = (t.name || '').trim();
            var media = tmModal.querySelector('.ir-tm-media');
            if (t.photo) {
              media.innerHTML = '<img src="' + esc(t.photo) + '" alt="' + esc(nm2) + '"/>';
              media.style.display = '';
            } else {
              media.innerHTML = ''; media.style.display = 'none';
            }
            tmModal.querySelector('.ir-tm-quote').textContent = t.quote || '';
            tmModal.querySelector('.ir-tm-name').textContent = nm2;
            var roleEl = tmModal.querySelector('.ir-tm-role');
            roleEl.textContent = t.role || '';
            roleEl.style.display = t.role ? '' : 'none';
            tmLast = document.activeElement;
            tmModal.classList.add('open');
            document.body.style.overflow = 'hidden';
            tmModal.querySelector('.ir-tm-close').focus();
          }
          function tmClose() {
            tmModal.classList.remove('open');
            document.body.style.overflow = '';
            if (tmLast && tmLast.focus) tmLast.focus();
          }
          if (tmFresh) { tmModal.querySelector('.ir-tm-close').addEventListener('click', tmClose);
          tmModal.addEventListener('click', function (e) { if (e.target === tmModal) tmClose(); });
          document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && tmModal.classList.contains('open')) tmClose();
          });
          tmEl.addEventListener('click', function (e) {
            if (e.target.closest('.ir-clamp-btn')) return;
            var c = e.target.closest('[data-tm]');
            if (c) tmOpen(Number(c.getAttribute('data-tm')));
          });
          tmEl.addEventListener('keydown', function (e) {
            var c = e.target.closest('[data-tm]');
            if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tmOpen(Number(c.getAttribute('data-tm'))); }
          }); }
        }
      }

      /* Long card copy is clamped to ~200 characters with a "More" toggle, so a
         wordy description cannot push everything else off the screen. */
      function clamp(text, n) {
        text = (text || '').trim();
        if (!text) return '';
        if (text.length <= (n || 200)) {
          return '<span style="white-space:pre-line">' + esc(text) + '</span>';
        }
        var cut = text.slice(0, n || 200);
        var sp = cut.lastIndexOf(' ');
        if (sp > 120) cut = cut.slice(0, sp);
        return '<span class="ir-clamp" style="white-space:pre-line">' +
                 '<span class="ir-clamp-short">' + esc(cut) + '… </span>' +
                 '<span class="ir-clamp-full" hidden>' + esc(text) + ' </span>' +
                 '<button type="button" class="ir-clamp-btn">More</button>' +
               '</span>';
      }
      if (!bound.clamp) { bound.clamp = true;
      document.addEventListener('click', function (e) {
        var b = e.target.closest('.ir-clamp-btn');
        if (!b) return;
        e.preventDefault(); e.stopPropagation();
        var wrap = b.closest('.ir-clamp');
        var short = wrap.querySelector('.ir-clamp-short'), full = wrap.querySelector('.ir-clamp-full');
        var open = full.hidden === false;
        full.hidden = open; short.hidden = !open;
        b.textContent = open ? 'More' : 'Less';
      }); }

      /* Homepage: 3 most recent events, with a link through to the full page */
      var heEl = document.getElementById('home-events');
      if (heEl) {
        var evAll = (content.events && content.events.items) || [];
        // upcoming first, then the most recent past ones
        var ordered = evAll.filter(function (e) { return (e.status || 'upcoming') === 'upcoming'; })
          .concat(evAll.filter(function (e) { return e.status === 'past'; }).reverse());
        if (ordered.length) {
          document.getElementById('home-events-section').style.display = '';
          heEl.innerHTML = ordered.slice(0, 3).map(function (ev) {
            var i = evAll.indexOf(ev);
            var photo = ev.photo ? '<div class="aspect-[16/10] bg-green-50 overflow-hidden"><img src="' + esc(ev.photo) + '" alt="' + esc(ev.title) + '" class="w-full h-full object-cover" loading="lazy"/></div>' : '';
            var when = [ev.when, ev.time].filter(Boolean).map(esc).join(' &middot; ');
            return '<a href="events.html#event-' + i + '" class="rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col shadow-sm hover:border-green-300 transition-colors">' + photo +
              '<div class="p-5 flex-1 flex flex-col">' +
                (when ? '<span class="text-xs font-semibold text-green-600 mb-1">' + when + '</span>' : '') +
                '<h3 class="font-bold text-gray-900 text-[15px] mb-1.5">' + esc(ev.title) + '</h3>' +
                (ev.description ? '<p class="text-gray-800 text-[13px] leading-relaxed flex-1">' + clamp(ev.description, 200) + '</p>' : '') +
              '</div></a>';
          }).join('');
        }
      }

      /* Homepage: 3 collaborations, with a link through to the full page */
      var hcEl = document.getElementById('home-collabs');
      if (hcEl) {
        var coAll = (content.collaborations && content.collaborations.items) || [];
        if (coAll.length) {
          document.getElementById('home-collabs-section').style.display = '';
          hcEl.innerHTML = coAll.slice(0, 3).map(function (co) {
            var photo = co.photo ? '<div class="aspect-[16/10] bg-green-50 overflow-hidden"><img src="' + esc(co.photo) + '" alt="' + esc(co.title) + '" class="w-full h-full object-cover" loading="lazy"/></div>' : '';
            var logo = co.logo ? '<div class="h-9 flex items-center mb-2"><img src="' + esc(co.logo) + '" alt="" class="max-h-9 max-w-[55%] object-contain object-left"/></div>' : '';
            return '<a href="collaborations.html" class="rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col shadow-sm hover:border-green-300 transition-colors">' + photo +
              '<div class="p-5 flex-1 flex flex-col">' + logo +
                '<h3 class="font-bold text-gray-900 text-[15px] mb-1.5">' + esc(co.title) + '</h3>' +
                (co.description ? '<p class="text-gray-800 text-[13px] leading-relaxed flex-1">' + clamp(co.description, 200) + '</p>' : '') +
              '</div></a>';
          }).join('');
        }
      }

      /* Homepage: one logo per mission partner, on a single scrollable line */
      var hpEl = document.getElementById('home-partners');
      if (hpEl) {
        var pAll = (content.partners && content.partners.items) || [];
        var withLogo = pAll.filter(function (p) { return p.logo || p.name; });
        if (withLogo.length) {
          document.getElementById('home-partners-strip').style.display = '';
          var fb = document.getElementById('home-partners-fallback');
          if (fb) fb.style.display = 'none';
          hpEl.innerHTML = withLogo.map(function (p) {
            var inner = p.logo
              ? '<img src="' + esc(p.logo) + '" alt="' + esc(p.name) + '" loading="lazy"/>'
              : '<span>' + esc(p.name) + '</span>';
            var cls = 'ir-strip-item', title = ' title="' + esc(p.name) + '" role="listitem"';
            return p.link
              ? '<a href="' + esc(p.link) + '" target="_blank" rel="noopener noreferrer" class="' + cls + '"' + title + '>' + inner + '</a>'
              : '<div class="' + cls + '"' + title + '>' + inner + '</div>';
          }).join('');

          // Duplicate the row so the auto-scroll can loop without a visible jump.
          hpEl.setAttribute('data-loop-count', String(withLogo.length));
          hpEl.innerHTML += hpEl.innerHTML;

          var strip = hpEl, prev = document.querySelector('.ir-strip-prev'), next = document.querySelector('.ir-strip-next');
          function syncNav() {
            // The row loops, so the arrows never dead-end; only hide them when
            // every logo already fits on screen.
            var overflows = strip.scrollWidth / 2 > strip.clientWidth + 2;
            prev.style.visibility = next.style.visibility = overflows ? '' : 'hidden';
          }
          if (!bound.strip) { bound.strip = true;
          prev.addEventListener('click', function () { strip.scrollBy({ left: -strip.clientWidth * 0.8, behavior: 'smooth' }); });
          next.addEventListener('click', function () { strip.scrollBy({ left:  strip.clientWidth * 0.8, behavior: 'smooth' }); });
          strip.addEventListener('scroll', syncNav);
          window.addEventListener('resize', syncNav);

          /* Drift the logos along slowly and loop seamlessly. Pauses on hover,
             while the tab is hidden, and for anyone who prefers reduced motion. */
          var half = function () { return strip.scrollWidth / 2; };
          var paused = false;
          var SPEED = 22;   // pixels per second
          strip.addEventListener('mouseenter', function () { paused = true; });
          strip.addEventListener('mouseleave', function () { paused = false; });
          // Every pause needs a matching resume, or one tap/focus stops it for good.
          strip.addEventListener('touchstart', function () { paused = true; }, { passive: true });
          strip.addEventListener('touchend', function () { setTimeout(function () { paused = false; }, 2500); }, { passive: true });
          strip.addEventListener('focusin', function () { paused = true; });
          strip.addEventListener('focusout', function () { paused = false; });
          [prev, next].forEach(function (b) {
            b.addEventListener('click', function () { paused = true; setTimeout(function () { paused = false; }, 2500); });
          });
          if (!reduceMotion) {
            var STEP_MS = 30;
            setInterval(function () {
              if (paused || document.hidden) return;
              strip.scrollLeft += SPEED * (STEP_MS / 1000);
              if (strip.scrollLeft >= half()) strip.scrollLeft -= half();
            }, STEP_MS);
          } }
          setTimeout(syncNav, 50);
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
        var PIN = '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
        var eventCard = function (ev) {
          var idx = evItems.indexOf(ev);
          var photo = ev.photo ? '<div class="aspect-[16/10] bg-green-50"><img src="' + esc(ev.photo) + '" alt="' + esc(ev.title) + '" class="w-full h-full object-cover"/></div>' : '';
          var whenBits = [];
          if (ev.when) whenBits.push(esc(ev.when));
          if (ev.time) whenBits.push(esc(ev.time));
          var when = whenBits.length ? '<span class="inline-flex items-center gap-1 text-xs font-semibold text-green-600"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>' + whenBits.join(' &middot; ') + '</span>' : '';
          var loc = '';
          if (ev.location_link) {
            loc = '<a href="' + esc(ev.location_link) + '" target="_blank" rel="noopener noreferrer" class="text-green-600 hover:text-green-800 text-sm mt-1 inline-flex items-center gap-1 font-medium">' + PIN + (ev.location ? esc(ev.location) : 'Directions') + '<span class="text-green-500">&nbsp;&rarr;</span></a>';
          } else if (ev.location) {
            loc = '<div class="text-green-500 text-sm mt-1 inline-flex items-center gap-1">' + PIN + esc(ev.location) + '</div>';
          }
          var share = '<button type="button" class="ir-ev-share mt-3 self-start inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-900 cursor-pointer" data-title="' + esc(ev.title) + '" data-anchor="event-' + idx + '"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share</button>';
          return '<article id="event-' + idx + '" class="rounded-2xl border border-green-100 bg-white overflow-hidden flex flex-col shadow-sm scroll-mt-24">' + photo +
            '<div class="p-5 flex-1 flex flex-col">' + when +
              '<h3 class="text-lg font-semibold text-green-800 mt-1">' + esc(ev.title) + '</h3>' + loc +
              (ev.description ? '<p class="text-green-600 text-sm mt-2 leading-relaxed flex-1" style="white-space:pre-line">' + esc(ev.description) + '</p>' : '<div class="flex-1"></div>') +
              share +
            '</div></article>';
        };
        var fillBucket = function (el, list) {
          if (!el) return;
          var sec = el.closest('section');
          if (!list.length) { if (evItems.length && sec) sec.style.display = 'none'; return; }
          el.innerHTML = list.map(eventCard).join('');
        };
        // Upcoming reads soonest-first (the next one you can attend); past reads
        // newest-first. Items carrying a Date sort by it, the rest keep admin order.
        fillBucket(evUp, sortByDate(evItems.filter(function (e) { return (e.status || 'upcoming') === 'upcoming'; }), true));
        fillBucket(evPast, sortByDate(evItems.filter(function (e) { return e.status === 'past'; }), false));
        if (!bound.share) { bound.share = true;
        document.addEventListener('click', function (e) {
          var b = e.target.closest('.ir-ev-share');
          if (!b) return;
          var url = location.origin + location.pathname + '#' + b.getAttribute('data-anchor');
          var title = b.getAttribute('data-title');
          if (navigator.share) { navigator.share({ title: title, text: title + ' - India Recycles', url: url }).catch(function () {}); }
          else if (navigator.clipboard) { navigator.clipboard.writeText(url); var o = b.innerHTML; b.innerHTML = 'Link copied'; setTimeout(function () { b.innerHTML = o; }, 1500); }
        }); }
      }

      /* Mobile sticky bar: the admin picks what the first button does */
      var ctaEl = document.querySelector('[data-cta-primary]');
      if (ctaEl) {
        var pick = (content.settings && content.settings.sticky_cta) || 'drop';
        var evs = (content.events && content.events.items) || [];
        // "Next event" points at the first upcoming event, falling back to the events page
        var upcoming = evs.filter(function (e) { return (e.status || 'upcoming') === 'upcoming'; });
        var nextEvent = upcoming.length ? 'events.html#event-' + evs.indexOf(upcoming[0]) : 'events.html';
        var CTA = {
          drop:   { href: 'drop-locations.html', text: 'Find Drop Location' },
          event:  { href: nextEvent,             text: 'Next Event' },
          talk:   { href: 'ir-talks.html',       text: 'Next IR Talk' },
          donate: { href: 'donate.html',         text: 'Donate' },
          revibe: { href: 'revibe.html',         text: 'Shop with ReVibe' }
        };
        var cta = CTA[pick] || CTA.drop;
        ctaEl.setAttribute('href', cta.href);
        ctaEl.textContent = cta.text;
      }

      /* Social links (footer): only the ones with a link set are shown */
      var socialEl = document.querySelector('[data-social]');
      if (socialEl) {
        var soc = content.social || {};
        var ICONS = {
          instagram: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
          facebook:  '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
          linkedin:  '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>',
          youtube:   '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#0A1C11"/></svg>',
          other:     '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
        };
        var ORDER = [
          { key: 'instagram', name: 'Instagram' },
          { key: 'facebook',  name: 'Facebook' },
          { key: 'linkedin',  name: 'LinkedIn' },
          { key: 'youtube',   name: 'YouTube' },
          { key: 'other',     name: (soc.other_name || '').trim() || 'Website' }
        ];
        var links = ORDER.filter(function (o) { return typeof soc[o.key] === 'string' && soc[o.key].trim(); });
        // Only touch the footer once the admin has saved something; otherwise keep the static markup.
        if (Object.keys(soc).length) {
          socialEl.innerHTML = links.map(function (o) {
            var label = o.key === 'other' ? o.name : 'India Recycles on ' + o.name;
            return '<a href="' + esc(soc[o.key].trim()) + '" target="_blank" rel="noopener noreferrer" ' +
              'class="w-8 h-8 bg-white/10 hover:bg-white/25 rounded-lg flex items-center justify-center transition-colors duration-200 cursor-pointer" ' +
              'aria-label="' + esc(label) + '" title="' + esc(label) + '">' + ICONS[o.key] + '</a>';
          }).join('');
          socialEl.style.display = links.length ? '' : 'none';
        }
      }

      /* Activities page hero image (description rides on data-cms) */
      var actImg = content.activities && content.activities.image;
      if (actImg) {
        var actHero = document.querySelector('img[data-img-key="activities-1"]');
        if (actHero) actHero.src = actImg;
      }

      /* Collaborations (Collaboration page) */
      var collabEl = document.getElementById('collaborations-list');
      if (collabEl) {
        var collabs = (content.collaborations && content.collaborations.items) || [];
        if (collabs.length) {
          collabEl.innerHTML = collabs.map(function (co) {
            var photo = co.photo ? '<div class="aspect-[16/10] bg-green-50"><img src="' + esc(co.photo) + '" alt="' + esc(co.title) + '" class="w-full h-full object-cover"/></div>' : '';
            var logo = co.logo ? '<div class="h-12 flex items-center mb-3"><img src="' + esc(co.logo) + '" alt="' + esc(co.title) + ' logo" class="max-h-12 max-w-[60%] object-contain object-left"/></div>' : '';
            return '<article class="rounded-2xl border border-green-100 bg-white overflow-hidden flex flex-col shadow-sm">' + photo +
              '<div class="p-5 flex-1 flex flex-col">' + logo +
                '<h3 class="text-lg font-semibold text-green-800">' + esc(co.title) + '</h3>' +
                (co.description ? '<p class="text-green-600 text-sm mt-2 leading-relaxed flex-1" style="white-space:pre-line">' + esc(co.description) + '</p>' : '') +
              '</div></article>';
          }).join('');
        }
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
                (cu.description ? '<p class="text-green-600 text-sm mt-2 leading-relaxed flex-1" style="white-space:pre-line">' + esc(cu.description) + '</p>' : '') +
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
                (v.description ? '<p class="text-green-600 text-sm mt-2 leading-relaxed flex-1">' + clamp(v.description, 200) + '</p>' : '') +
              '</div></article>';
          }).join('');
          if (!bound.vids) { bound.vids = true;
          vidsEl.addEventListener('click', function (e) {
            var btn = e.target.closest('.ir-talk-play');
            if (!btn) return;
            var wrap = document.createElement('div');
            wrap.className = 'aspect-video';
            wrap.innerHTML = '<iframe src="' + btn.getAttribute('data-embed') + '" class="w-full h-full" style="border:0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
            btn.replaceWith(wrap);
          }); }
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
  }

  /* Refresh used to show the built-in fallback text until the CMS reply arrived,
     roughly a second later, so stale numbers and placeholder copy flashed first.
     Keep the last payload and render it as soon as the DOM is ready; the network
     copy is only re-applied when it actually differs. */
  var cachedRaw = null;
  try { cachedRaw = localStorage.getItem(CACHE_KEY); } catch (e) {}

  /* Photos and logos are stored as base64 inside the payload, so a few sections run
     to megabytes (the gallery alone is ~8MB) - far past what localStorage accepts.
     Cache only the light, text-bearing sections: those are what visibly flashed.
     The heavy, below-the-fold ones keep loading from the network as before. */
  var MAX_SECTION_BYTES = 120 * 1024;
  function cacheable(rows) {
    return rows.filter(function (r) {
      try { return JSON.stringify(r).length <= MAX_SECTION_BYTES; } catch (e) { return false; }
    });
  }

  window.IR_CMS = new Promise(function (resolve) {
    domReady().then(function () {
      if (!cachedRaw) return;
      try { applyContent(JSON.parse(cachedRaw)); } catch (e) {}
    });

    fetch(URL_ + '/rest/v1/recycle_site_content?section=neq.team&select=section,data', {
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }
    })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) { return domReady().then(function () { return rows; }); })
      .then(function (rows) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(cacheable(rows))); }
        catch (e) { try { localStorage.removeItem(CACHE_KEY); } catch (e2) {} }
        // Applied a second time with the full payload; every listener is guarded
        // by `bound`, so nothing double-binds and the text simply rewrites itself.
        resolve(applyContent(rows));
      })
      .catch(function () { resolve({ get: function () { return undefined; } }); });
  });
})();
