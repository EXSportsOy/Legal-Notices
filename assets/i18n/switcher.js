// assets/i18n/switcher.js — requires languages.js loaded first.
// Two mounts (either may be absent on a given page):
//   <div data-i18n-picker data-base="."></div>   -> full grid (picker pages)
//   <div data-i18n-switcher data-current="en"></div> -> compact nav dropdown
(function () {
  var langs = window.EXS_LANGS || [];

  function remember(code) { try { localStorage.setItem('exs-lang', code); } catch (e) {} }

  // The page each language links to within its <lang>/ folder.
  // Defaults to index.html (section landings); legal pickers set data-file.
  var grid = document.querySelector('[data-i18n-picker]');
  if (grid) {
    var base = grid.getAttribute('data-base') || '.';
    var gridFile = grid.getAttribute('data-file') || 'index.html';
    // Optional: one language whose file sits directly in data-base instead of a
    // <lang>/ subfolder (Heda's legal pages keep English at the folder root).
    var rootLang = grid.getAttribute('data-root-lang');
    langs.forEach(function (l) {
      var a = document.createElement('a');
      a.className = 'lang-option';
      a.href = (l.code === rootLang)
        ? base + '/' + gridFile
        : base + '/' + l.code + '/' + gridFile;
      a.addEventListener('click', function () { remember(l.code); });
      a.innerHTML =
        '<span class="lang-name">' + l.en + '</span>' +
        '<span class="lang-native">' + l.native + '</span>';
      grid.appendChild(a);
    });
  }

  var sw = document.querySelector('[data-i18n-switcher]');
  if (sw) {
    var current = sw.getAttribute('data-current') || 'en';
    var sel = document.createElement('select');
    sel.className = 'lang-switch';
    sel.setAttribute('aria-label', 'Language');
    langs.forEach(function (l) {
      var o = document.createElement('option');
      o.value = l.code; o.textContent = l.native;
      if (l.code === current) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      remember(sel.value);
      // Navigate to the sibling-language copy of the CURRENT page, keeping its
      // filename (index.html for landings, e.g. privacy_policy.html for legal).
      var here = window.location.pathname.split('/').pop() || 'index.html';
      window.location.href = '../' + sel.value + '/' + here;
    });
    sw.appendChild(sel);
  }
})();
