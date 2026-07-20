/* India Recycles - floating WhatsApp / Call bubble.
   Injected on Join Us pages (Volunteer, Careers, Partners, Drop Locations) so the
   quick-contact shortcut is available everywhere in that section. If a page already
   has its own #ir-contact-fab (contact.html), this does nothing. */
(function () {
  if (document.getElementById('ir-contact-fab')) return;
  var PHONE = '917202035700';
  var WA = '<svg class="w-7 h-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.767.966-.941 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>';
  var CALL = '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 12 19.79 19.79 0 0 1 1.07 3.38 2 2 0 0 1 3.05 1.2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 8.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 15.91z"/></svg>';
  function chip(label, msg, icon) {
    return '<button class="ir-wa w-full text-left px-3 py-2.5 rounded-xl hover:bg-green-50 text-green-800 text-sm font-medium flex items-center gap-3 cursor-pointer" data-msg="' + msg + '">' +
      '<span class="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center shrink-0">' + icon + '</span> ' + label + '</button>';
  }
  var ICO_V = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  var ICO_H = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  var ICO_C = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>';
  var ICO_Q = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';

  var el = document.createElement('div');
  el.id = 'ir-contact-fab';
  el.className = 'fixed right-5 bottom-24 lg:bottom-6 z-[70] flex flex-col items-end gap-3';
  el.innerHTML =
    '<div id="ir-fab-panel" class="hidden w-72 max-w-[calc(100vw-2.5rem)] rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">' +
      '<div class="bg-green-700 px-4 py-3 text-white flex items-center gap-2.5">' + WA.replace('w-7 h-7', 'w-6 h-6') +
        '<div><div class="font-semibold text-sm leading-tight">Chat on WhatsApp</div><div class="text-green-100 text-[11px]">Pick what you\'d like to talk about</div></div>' +
      '</div>' +
      '<div class="p-2">' +
        chip('Volunteer with you', "Hi India Recycles! I'd like to volunteer with you. Please share how I can get involved.", ICO_V) +
        chip('Donate or support', "Hi India Recycles! I'd like to donate / support your work. Please share the details.", ICO_H) +
        chip('Corporate / CSR tie-up', "Hi India Recycles! We're interested in a corporate tie-up / CSR partnership. Please get in touch.", ICO_C) +
        chip('General question', 'Hi India Recycles! I have a general question.', ICO_Q) +
      '</div>' +
      '<a href="tel:+' + PHONE + '" class="block bg-green-50 text-green-800 text-sm font-semibold text-center py-3 border-t border-green-100 hover:bg-green-100 transition-colors">Call +91 72020 35700</a>' +
    '</div>' +
    '<div class="flex items-center gap-3">' +
      '<a href="tel:+' + PHONE + '" aria-label="Call India Recycles" class="w-12 h-12 rounded-full bg-white shadow-lg ring-1 ring-black/5 text-green-700 flex items-center justify-center hover:bg-green-50 transition-colors">' + CALL + '</a>' +
      '<button id="ir-fab-toggle" aria-label="Chat on WhatsApp" aria-expanded="false" class="relative w-14 h-14 rounded-full bg-[#25D366] text-white shadow-xl flex items-center justify-center hover:brightness-105 transition cursor-pointer">' + WA + '</button>' +
    '</div>';
  document.body.appendChild(el);

  var toggle = document.getElementById('ir-fab-toggle');
  var panel = document.getElementById('ir-fab-panel');
  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = panel.classList.toggle('hidden') === false;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  el.querySelectorAll('.ir-wa').forEach(function (b) {
    b.addEventListener('click', function () {
      window.open('https://wa.me/' + PHONE + '?text=' + encodeURIComponent(b.getAttribute('data-msg') || ''), '_blank', 'noopener');
      panel.classList.add('hidden'); toggle.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('click', function (e) {
    if (!el.contains(e.target)) { panel.classList.add('hidden'); toggle.setAttribute('aria-expanded', 'false'); }
  });
})();
