/* Alokasiku — wrapper Chart.js (doughnut, line, bar) yang mengikuti tema. */
(function (root) {
  'use strict';
  var inst = {};

  function v(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function ok() { return typeof root.Chart !== 'undefined'; }
  function hexA(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function fallback(canvas) {
    var box = canvas.parentElement;
    if (box.querySelector('.chart-fallback')) return;
    canvas.style.display = 'none';
    var d = document.createElement('div');
    d.className = 'chart-fallback';
    d.textContent = 'Grafik tidak dapat dimuat. Chart.js membutuhkan koneksi internet saat aplikasi pertama dibuka.';
    box.appendChild(d);
  }
  function defaults() {
    Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = v('--text-muted');
    Chart.defaults.borderColor = v('--border');
  }
  function tooltip(extra) {
    return Object.assign({
      backgroundColor: v('--tooltip-bg'), titleColor: v('--tooltip-fg'), bodyColor: v('--tooltip-fg'),
      borderColor: v('--border-strong'), borderWidth: 1, padding: 10, cornerRadius: 10,
      boxPadding: 4, usePointStyle: true, titleFont: { weight: '600' }
    }, extra || {});
  }

  var centerPlugin = {
    id: 'centerText',
    afterDraw: function (chart) {
      var c = chart.$center;
      if (!c) return;
      var meta = chart.getDatasetMeta(0);
      if (!meta.data.length) return;
      var x = meta.data[0].x, y = meta.data[0].y, ctx = chart.ctx;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = v('--text-muted');
      ctx.font = "500 11px Inter, system-ui, sans-serif";
      ctx.fillText(c.label, x, y - 11);
      ctx.fillStyle = v('--text');
      ctx.font = "700 16px Inter, system-ui, sans-serif";
      ctx.fillText(c.value, x, y + 9);
      ctx.restore();
    }
  };

  function get(id, canvas, make) {
    var ch = inst[id];
    if (ch && ch.canvas !== canvas) { ch.destroy(); ch = null; }
    if (!ch) { defaults(); ch = make(); inst[id] = ch; }
    return ch;
  }

  /** cfg: {labels, values (bobot), amounts (rupiah), colors, center:{label,value}} */
  function doughnut(id, cfg) {
    var canvas = document.getElementById(id);
    if (!canvas) return null;
    if (!ok()) { fallback(canvas); return null; }
    var ch = get(id, canvas, function () {
      return new Chart(canvas, {
        type: 'doughnut',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 2, hoverOffset: 8, borderRadius: 3 }] },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '70%', layout: { padding: 8 },
          animation: { duration: 450 },
          plugins: {
            legend: { display: false },
            tooltip: tooltip({
              callbacks: {
                label: function (ctx) {
                  var c = ctx.chart.$cfg, i = ctx.dataIndex;
                  var tot = c.values.reduce(function (a, b) { return a + b; }, 0);
                  var p = tot ? c.values[i] / tot : 0;
                  var amt = c.amounts ? ' · ' + Fmt.rp(c.amounts[i]) : '';
                  return ' ' + ctx.label + ': ' + Fmt.ratio(p) + amt;
                }
              }
            })
          }
        },
        plugins: [centerPlugin]
      });
    });
    ch.$cfg = cfg;
    ch.$center = cfg.center;
    ch.data.labels = cfg.labels;
    var ds = ch.data.datasets[0];
    ds.data = cfg.values;
    ds.backgroundColor = cfg.colors;
    ds.borderColor = v('--surface');
    ch.update();
    return ch;
  }

  /** cfg: {labels, datasets:[{label,data,color,fill,dash}]} */
  function line(id, cfg) {
    var canvas = document.getElementById(id);
    if (!canvas) return null;
    if (!ok()) { fallback(canvas); return null; }
    var ch = get(id, canvas, function () {
      return new Chart(canvas, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: { grid: { display: false }, border: { display: false } },
            y: { grid: { color: v('--border') }, border: { display: false },
              ticks: { callback: function (val) { return Fmt.rpShort(val); }, maxTicksLimit: 6 } }
          },
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 16 } },
            tooltip: tooltip({ callbacks: { label: function (ctx) { return ' ' + ctx.dataset.label + ': ' + Fmt.rp(ctx.raw); } } })
          }
        }
      });
    });
    ch.data.labels = cfg.labels;
    ch.data.datasets = cfg.datasets.map(function (d) {
      return {
        label: d.label, data: d.data, borderColor: d.color,
        backgroundColor: d.fill ? hexA(d.color, 0.12) : d.color, fill: !!d.fill,
        tension: 0.32, pointRadius: 0, pointHoverRadius: 5, pointBackgroundColor: d.color,
        borderWidth: d.dash ? 1.5 : 2.25, borderDash: d.dash ? [5, 5] : []
      };
    });
    ch.update();
    return ch;
  }

  /** cfg: {labels, datasets:[{label,data,color}], horizontal} */
  function bar(id, cfg) {
    var canvas = document.getElementById(id);
    if (!canvas) return null;
    if (!ok()) { fallback(canvas); return null; }
    var ch = get(id, canvas, function () {
      return new Chart(canvas, {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
          indexAxis: cfg.horizontal ? 'y' : 'x',
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: cfg.horizontal
              ? { grid: { color: v('--border') }, border: { display: false }, ticks: { callback: function (val) { return Fmt.rpShort(val); }, maxTicksLimit: 5 } }
              : { grid: { display: false }, border: { display: false } },
            y: cfg.horizontal
              ? { grid: { display: false }, border: { display: false } }
              : { grid: { color: v('--border') }, border: { display: false }, ticks: { callback: function (val) { return Fmt.rpShort(val); } } }
          },
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 16 } },
            tooltip: tooltip({ callbacks: { label: function (ctx) { return ' ' + ctx.dataset.label + ': ' + Fmt.rp(ctx.raw); } } })
          }
        }
      });
    });
    ch.data.labels = cfg.labels;
    ch.data.datasets = cfg.datasets.map(function (d) {
      return { label: d.label, data: d.data, backgroundColor: d.color, borderRadius: 5, borderSkipped: false,
        barPercentage: 0.8, categoryPercentage: 0.7 };
    });
    ch.update();
    return ch;
  }

  function highlight(id, index) {
    var ch = inst[id];
    if (!ch) return;
    var els = index == null ? [] : [{ datasetIndex: 0, index: index }];
    ch.setActiveElements(els);
    var meta = ch.getDatasetMeta(0);
    var pt = index != null && meta.data[index] ? meta.data[index].tooltipPosition() : { x: 0, y: 0 };
    ch.tooltip.setActiveElements(els, pt);
    ch.update('none');
  }
  function toggle(id, index) {
    var ch = inst[id];
    if (!ch) return true;
    ch.toggleDataVisibility(index);
    ch.update();
    return ch.getDataVisibility(index);
  }
  function visible(id, index) { var ch = inst[id]; return ch ? ch.getDataVisibility(index) : true; }
  function destroyAll() { Object.keys(inst).forEach(function (k) { inst[k].destroy(); }); inst = {}; }

  root.Charts = { available: ok, doughnut: doughnut, line: line, bar: bar, highlight: highlight,
    toggle: toggle, visible: visible, destroyAll: destroyAll, hexA: hexA };
})(window);
