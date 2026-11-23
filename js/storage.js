/* Alokasiku — penyimpanan lokal (localStorage). Tidak ada data yang dikirim ke server. */
(function (root) {
  'use strict';
  var KEY = 'alokasiku.v1';
  var timer = null;
  var listeners = [];

  function emit(ok) { listeners.forEach(function (f) { f(ok); }); }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); emit(true); return true; }
    catch (e) { emit(false); return false; }
  }
  function saveDebounced(state, ms) {
    clearTimeout(timer);
    timer = setTimeout(function () { save(state); }, ms || 350);
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) { /* abaikan */ } }
  function onSave(fn) { listeners.push(fn); }

  root.Store = { KEY: KEY, load: load, save: save, saveDebounced: saveDebounced, clear: clear, onSave: onSave };
})(window);
