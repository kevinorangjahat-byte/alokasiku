/* Alokasiku — service worker: membuat aplikasi bisa dibuka offline setelah kunjungan pertama. */
var VERSION = 'alokasiku-v1.5.3';
var CORE = [
  './',
  './index.html',
  './css/styles.css?v=1.5.3',
  './js/format.js?v=1.5.3',
  './js/icons.js?v=1.5.3',
  './js/engine.js?v=1.5.3',
  './js/storage.js?v=1.5.3',
  './js/charts.js?v=1.5.3',
  './js/app.js?v=1.5.3',
  './assets/logo.svg',
  './assets/apple-touch-icon.png',
  './assets/icon-512.png',
  './manifest.webmanifest',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // Halaman: coba jaringan dulu (agar update cepat), jatuh ke cache saat offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(VERSION).then(function (c) { c.put('./index.html', copy); });
      return res;
    }).catch(function () { return caches.match('./index.html'); }));
    return;
  }
  // Aset & font: cache dulu, perbarui di latar belakang.
  var cacheable = url.origin === location.origin || /(jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname);
  if (!cacheable) return;
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
