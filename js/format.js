/* Alokasiku — format angka & Rupiah (locale id-ID). */
(function (root) {
  'use strict';
  var nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
  var d1 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1, minimumFractionDigits: 0 });

  function num(n) { return nf.format(Math.round(n || 0)); }
  function rp(n) {
    n = Math.round(n || 0);
    return (n < 0 ? '−' : '') + 'Rp ' + nf.format(Math.abs(n));
  }
  function rpShort(n) {
    var a = Math.abs(n || 0), s = n < 0 ? '−' : '';
    if (a >= 1e12) return s + 'Rp ' + d1.format(a / 1e12) + ' T';
    if (a >= 1e9) return s + 'Rp ' + d1.format(a / 1e9) + ' M';
    if (a >= 1e6) return s + 'Rp ' + d1.format(a / 1e6) + ' jt';
    if (a >= 1e3) return s + 'Rp ' + d1.format(a / 1e3) + ' rb';
    return rp(n);
  }
  /** tenths (0–1000) → "12,5%" */
  function pct(tenths) { return d1.format((tenths || 0) / 10) + '%'; }
  /** tenths → "12,5" (untuk input) */
  function pctNum(tenths) { return d1.format((tenths || 0) / 10); }
  /** rasio 0–1 → "45%" */
  function ratio(r) { return d1.format((r || 0) * 100) + '%'; }
  function dec(n) { return d1.format(n || 0); }
  function parseDigits(str) {
    var d = String(str == null ? '' : str).replace(/[^\d]/g, '');
    return d ? parseInt(d.slice(0, 15), 10) : 0;
  }
  function parseDecimal(str) {
    var s = String(str == null ? '' : str).replace(/\s|%/g, '');
    // "12,5" (format Indonesia) atau "12.5" keduanya diterima.
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var v = parseFloat(s);
    return isFinite(v) ? v : NaN;
  }
  function months(m) {
    if (m === null || m === undefined) return '—';
    if (m <= 0) return 'tercapai';
    if (m < 12) return m + ' bulan';
    var y = Math.floor(m / 12), r = m % 12;
    return y + ' tahun' + (r ? ' ' + r + ' bulan' : '');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  root.Fmt = { num: num, rp: rp, rpShort: rpShort, pct: pct, pctNum: pctNum, ratio: ratio, dec: dec,
    parseDigits: parseDigits, parseDecimal: parseDecimal, months: months, esc: esc };
})(window);
