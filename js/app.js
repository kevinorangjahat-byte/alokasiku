/* Alokasiku — controller UI. Bergantung pada Engine, Fmt, Store, Charts, Icons. */
(function () {
  'use strict';

  var E = window.Engine, F = window.Fmt, S = window.Store, C = window.Charts, I = window.Icons;
  var FMT = { rp: F.rp, pct: F.pct, months: F.months, dec: F.dec };
  var esc = F.esc;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  var state, result, current = 'dashboard';

  var VIEWS = {
    dashboard: { title: 'Dashboard', sub: 'Ringkasan kondisi & kesehatan finansialmu', render: renderDashboard },
    data: { title: 'Data Keuangan', sub: 'Pendapatan, pengeluaran tetap, aset, dan tujuan', render: renderData },
    alokasi: { title: 'Alokasi Pendapatan', sub: 'Atur ke mana setiap rupiah pergi — total selalu 100%', render: renderAllocation },
    investasi: { title: 'Investasi', sub: 'Rekomendasi instrumen & proyeksi sesuai profil risiko', render: renderInvest },
    simulasi: { title: 'Simulasi', sub: 'Uji skenario: pendapatan naik, biaya berubah, porsi investasi', render: renderSim }
  };

  var LEVEL_COLOR = { great: 'var(--ok)', good: 'var(--ok)', fair: 'var(--warn)', warn: '#E8762B', bad: 'var(--danger)', none: 'var(--text-muted)' };

  /* =========================================================
     State & siklus render
     ========================================================= */

  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); }
  function setPath(o, p, v) {
    var ks = p.split('.'), last = ks.pop();
    ks.reduce(function (a, k) { return a[k]; }, o)[last] = v;
  }

  function recompute() {
    if (state.allocation.mode === 'smart') state.allocation.shares = E.smartAllocation(state.profile, state.goals);
    if (state.investMix.mode === 'auto') state.investMix.shares = E.autoInvestMix(state.profile);
    result = E.analyze(state, FMT);
  }

  function commit(opts) {
    if (isLocked() && !(opts && opts.allowLocked)) {
      // Tidak seharusnya terjadi (kontrol dinonaktifkan), tapi pastikan data tidak ikut berubah.
      var saved = S.load();
      if (saved) { state = E.sanitize(saved); buildGoals(); }
      recompute(); render();
      toast('Data terkunci — buka kunci untuk mengubah');
      return;
    }
    if (opts && opts.dataEdit && state.meta.demo) state.meta.demo = false;
    recompute();
    S.saveDebounced(state);
    render();
  }

  function render() {
    VIEWS[current].render();
    $('#demoBanner').hidden = !state.meta.demo || isLocked();
    applyLockUI();
  }

  /* =========================================================
     Kunci data & versi tersimpan
     ========================================================= */

  function isLocked() { return !!(state.meta && state.meta.locked); }

  /** Elemen yang mengubah data. Simulasi & pengaturan tampilan tetap aktif. */
  var EDIT_SELECTOR = [
    '#view-data input', '#view-data select', '#view-data [data-add-goal]', '#view-data [data-gremove]',
    '#view-data [data-set]', '[data-risk]', '#presetGrid [data-preset]', '#allocRows input', '#allocRows [data-role="lock"]',
    '#invRows input', '#invRows [data-role="lock"]', '#invShareRange', '[data-invmode]', '#simApply',
    '#demoBanner button', '[data-action="empty"]', '[data-action="demo"]', '[data-action="import"]', '[data-action="reset"]'
  ].join(',');

  function applyLockUI() {
    var on = isLocked();
    document.body.classList.toggle('is-locked', on);
    $('#lockBanner').hidden = !on;
    $$(EDIT_SELECTOR).forEach(function (el) { el.disabled = on; });
    var b = $('#lockBtn');
    b.innerHTML = I.icon(on ? 'lock' : 'unlock');
    b.classList.toggle('on', on);
    b.title = on ? 'Data terkunci — klik untuk membuka' : 'Kunci data agar tidak berubah';
    b.setAttribute('aria-label', on ? 'Buka kunci data' : 'Kunci data');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function setLocked(on) {
    state.meta.locked = !!on;
    S.save(state);
    render();
    toast(on ? 'Data dikunci — tidak bisa diubah sampai dibuka' : 'Kunci dibuka — data bisa diubah lagi');
  }

  function snapshotSummary(st) {
    var p = st.profile || {};
    return (p.incomeType === 'oneTime' ? 'Sekali masuk ' : 'Pendapatan ') + F.rp(p.income || 0) + ' · ' + ((st.goals || []).length) + ' tujuan';
  }
  function fmtDate(ts) {
    try { return new Date(ts).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }

  function openSaveSnapshot() {
    var d = new Date();
    var def = 'Versi ' + d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    openModal({
      title: 'Simpan versi data',
      html: '<p class="muted">Simpan salinan data saat ini. Kamu bisa memulihkannya kapan saja dari Riwayat versi, walau data aktif sudah berubah.</p>' +
        '<label class="field" style="margin-top:12px"><span>Nama versi</span><input class="input" id="snapName" maxlength="60" value="' + esc(def) + '"></label>' +
        '<label class="switch" style="margin:0"><input type="checkbox" id="snapLock"' + (isLocked() ? ' checked' : '') + '><span>Kunci data setelah disimpan</span></label>',
      ok: 'Simpan versi',
      onOk: function () {
        var name = ($('#snapName').value || '').trim() || def;
        var list = S.loadSnapshots();
        var copy = E.clone(state);
        delete copy.sim; delete copy.ui; delete copy.theme;
        list.unshift({ id: 's' + Date.now().toString(36), name: name, savedAt: Date.now(), data: copy });
        if (list.length > 30) list.length = 30;
        if (!S.saveSnapshots(list)) { toast('Gagal menyimpan — penyimpanan browser penuh atau diblokir'); return false; }
        var lockAfter = $('#snapLock').checked;
        setTimeout(function () {
          if (lockAfter !== isLocked()) setLocked(lockAfter);
          toast('Versi "' + name + '" disimpan' + (lockAfter ? ' dan data dikunci' : ''));
        }, 0);
        return true;
      }
    });
    setTimeout(function () { var i = $('#snapName'); if (i) { i.focus(); i.select(); } }, 60);
  }

  function openHistory() {
    var list = S.loadSnapshots();
    var html = list.length ? '<ul class="snap-list">' + list.map(function (sn) {
      return '<li data-snap="' + esc(sn.id) + '"><div class="snap-info"><strong>' + esc(sn.name) + '</strong>' +
        '<span>' + fmtDate(sn.savedAt) + ' · ' + esc(snapshotSummary(sn.data || {})) + '</span></div>' +
        '<div class="snap-actions"><button type="button" class="btn sm" data-snap-restore>Pulihkan</button>' +
        '<button type="button" class="icon-btn sm" data-snap-delete aria-label="Hapus versi" title="Hapus versi">' + I.icon('trash') + '</button></div></li>';
    }).join('') + '</ul>'
      : '<div class="empty">Belum ada versi tersimpan. Pilih <b>Simpan versi data</b> di menu ⋮ untuk membuat yang pertama.</div>';
    openModal({ title: 'Riwayat versi tersimpan', html: html, cancel: 'Tutup' });
    var box = $('#modalBody');
    box.onclick = function (e) {
      var li = e.target.closest('[data-snap]');
      if (!li) return;
      var id = li.getAttribute('data-snap');
      var sn = S.loadSnapshots().filter(function (x) { return x.id === id; })[0];
      if (!sn) return;
      if (e.target.closest('[data-snap-restore]')) {
        openModal({
          title: 'Pulihkan versi?',
          html: '<p>Data aktif akan diganti dengan versi <b>' + esc(sn.name) + '</b> (' + fmtDate(sn.savedAt) + '). Simpan versi data saat ini dulu jika ingin menyimpannya.</p>',
          ok: 'Pulihkan',
          onClose: function (yes) {
            if (!yes) { openHistory(); return; }
            var next = E.sanitize(E.clone(sn.data));
            next.meta.demo = false;
            next.meta.locked = isLocked();
            replaceState(next);
            toast('Versi "' + sn.name + '" dipulihkan');
          }
        });
      } else if (e.target.closest('[data-snap-delete]')) {
        openModal({
          title: 'Hapus versi?',
          html: '<p>Versi <b>' + esc(sn.name) + '</b> akan dihapus permanen dari perangkat ini. Data aktif tidak berubah.</p>',
          ok: 'Hapus versi', danger: true,
          onClose: function (yes) {
            if (yes) {
              S.saveSnapshots(S.loadSnapshots().filter(function (x) { return x.id !== id; }));
              toast('Versi dihapus');
            }
            openHistory();
          }
        });
      }
    };
  }

  function replaceState(next) {
    var theme = state ? state.theme : 'auto';
    state = next;
    state.theme = theme;
    buildGoals();
    recompute();
    S.save(state);
    render();
  }

  /* =========================================================
     Util UI
     ========================================================= */

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /** Format input rupiah saat diketik sambil menjaga posisi kursor. */
  function formatMoneyInput(el) {
    var pos = el.selectionStart == null ? el.value.length : el.selectionStart;
    var digitsBefore = el.value.slice(0, pos).replace(/\D/g, '').length;
    var n = F.parseDigits(el.value);
    var str = n ? F.num(n) : '';
    el.value = str;
    var i = 0, count = 0;
    if (digitsBefore > 0) {
      for (; i < str.length; i++) {
        if (/\d/.test(str[i])) count++;
        if (count === digitsBefore) { i++; break; }
      }
    }
    try { if (document.activeElement === el) el.setSelectionRange(i, i); } catch (e) { /* abaikan */ }
    return n;
  }

  function isFocused(el) { return document.activeElement === el; }

  function setRange(el, value, max) {
    if (!isFocused(el) || String(el.value) !== String(value)) el.value = value;
    el.style.setProperty('--fill', (Number(value) - Number(el.min || 0)) / ((max || Number(el.max)) - Number(el.min || 0)) * 100 + '%');
  }

  function bar(ratio, color, after) {
    var w = Math.max(0, Math.min(1, ratio || 0)) * 100;
    var a = after != null ? '<i class="after" style="width:' + Math.min(100, after * 100) + '%;--c:' + color + '"></i>' : '';
    return '<div class="progress-bar">' + a + '<i style="width:' + w + '%;--c:' + color + '"></i></div>';
  }

  function legendHTML(chartId, items) {
    return items.map(function (it, i) {
      return '<li data-i="' + i + '" class="' + (C.visible(chartId, i) ? '' : 'off') + '">' +
        '<span class="dot" style="background:' + it.color + '"></span>' +
        '<span class="nm">' + esc(it.name) + '</span>' +
        '<span class="pc">' + it.pct + '</span>' +
        '<span class="am">' + it.amount + '</span></li>';
    }).join('');
  }

  function catItems(r, filterZero) {
    return E.CATEGORIES.filter(function (c) { return !filterZero || r.shares[c.key] > 0; }).map(function (c) {
      return { key: c.key, name: c.name, color: c.color, share: r.shares[c.key], amountRaw: r.amounts[c.key] };
    });
  }
  function instItems(r, filterZero) {
    return E.INSTRUMENTS.filter(function (i) { return !filterZero || r.invShares[i.key] > 0; }).map(function (i) {
      return { key: i.key, name: i.short, color: i.color, share: r.invShares[i.key], amountRaw: r.invAmounts[i.key] };
    });
  }

  function drawDoughnut(chartId, legendSel, items, center) {
    C.doughnut(chartId, {
      labels: items.map(function (i) { return i.name; }),
      values: items.map(function (i) { return i.share; }),
      amounts: items.map(function (i) { return i.amountRaw; }),
      colors: items.map(function (i) { return i.color; }),
      center: center
    });
    if (legendSel) {
      $(legendSel).innerHTML = legendHTML(chartId, items.map(function (i) {
        return { name: i.name, color: i.color, pct: F.pct(i.share), amount: F.rp(i.amountRaw) };
      }));
    }
  }

  function goalStatus(g, oneTime) {
    var color = g.type === 'short' ? '#93C83E' : '#16B47A';
    var tag;
    if (g.gap <= 0) tag = '<span class="tag ok">Tercapai</span>';
    else if (g.onTrack) tag = '<span class="tag ok">On-track</span>';
    else tag = '<span class="tag warn">Perlu ditambah</span>';
    var meta;
    if (oneTime) {
      meta = '<span>' + F.rp(g.current) + ' → <b>' + F.rp(g.current + g.contrib) + '</b> / ' + F.rp(g.target) + '</span><span>+' + F.rp(g.contrib) + ' dari alokasi ini</span>';
    } else {
      meta = '<span><b>' + F.rp(g.current) + '</b> / ' + F.rp(g.target) + '</span><span>' +
        (g.gap <= 0 ? 'Selesai' : F.rp(g.contrib) + '/bln · ' + (g.eta ? F.months(g.eta) : 'belum ada alokasi')) + '</span>';
    }
    return { tag: tag, bar: bar(g.progress, color, oneTime ? g.progressAfter : null), meta: meta };
  }

  /* =========================================================
     Tema, navigasi, menu
     ========================================================= */

  function effectiveTheme() {
    if (state.theme === 'light' || state.theme === 'dark') return state.theme;
    if (window.__hostTheme === 'light' || window.__hostTheme === 'dark') return window.__hostTheme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme() {
    var t = effectiveTheme();
    document.documentElement.setAttribute('data-theme', t);
    $('#themeBtn').innerHTML = I.icon(t === 'dark' ? 'sun' : 'moon');
    $('#themeBtn').title = t === 'dark' ? 'Mode terang' : 'Mode gelap';
    C.destroyAll();
  }

  function show(view) {
    if (!VIEWS[view]) view = 'dashboard';
    current = view;
    $$('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + view); });
    $$('[data-nav]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-nav') === view); });
    $('#viewTitle').textContent = VIEWS[view].title;
    $('#viewSub').textContent = VIEWS[view].sub;
    if (location.hash !== '#' + view) { try { history.replaceState(null, '', '#' + view); } catch (e) { /* abaikan */ } }
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- Dialog di dalam halaman (pengganti confirm/prompt) ---------- */

  var modalCleanup = null;
  /** opts: {title, html, ok, cancel, danger, onOk} — onOk mengembalikan false agar dialog tetap terbuka. */
  function openModal(opts) {
    var m = $('#modal'), okb = $('#modalOk'), cb = $('#modalCancel');
    if (modalCleanup) modalCleanup(false);
    $('#modalBody').onclick = null;
    $('#modalTitle').textContent = opts.title;
    $('#modalBody').innerHTML = opts.html;
    okb.textContent = opts.ok || 'Lanjutkan';
    okb.className = 'btn ' + (opts.danger ? 'danger-solid' : 'primary');
    okb.hidden = !opts.ok;
    cb.textContent = opts.cancel || 'Batal';
    m.hidden = false;
    var prev = document.activeElement;
    function close(result) {
      m.hidden = true;
      okb.onclick = cb.onclick = m.onclick = null;
      modalCleanup = null;
      if (prev && prev.focus) try { prev.focus(); } catch (e) { /* abaikan */ }
      if (opts.onClose) opts.onClose(result);
    }
    modalCleanup = close;
    okb.onclick = function () { if (!opts.onOk || opts.onOk() !== false) close(true); };
    cb.onclick = function () { close(false); };
    m.onclick = function (e) { if (e.target === m) close(false); };
    setTimeout(function () { (opts.ok ? okb : cb).focus(); }, 30);
    return close;
  }
  function askConfirm(text, ok, danger, onYes) {
    openModal({
      title: 'Konfirmasi', html: '<p>' + esc(text) + '</p>', ok: ok, danger: danger,
      onClose: function (yes) { if (yes) onYes(); }
    });
  }

  function exportData() {
    var json = JSON.stringify(state, null, 2);
    openModal({
      title: 'Ekspor data',
      html: '<p class="muted">Simpan teks ini (mis. di Catatan) sebagai backup, atau tempelkan di menu Impor pada perangkat lain.</p>' +
        '<textarea id="exportText" class="input textarea" readonly rows="9" spellcheck="false">' + esc(json) + '</textarea>' +
        '<button type="button" class="btn sm" id="exportFileBtn" style="margin-top:10px">' + I.icon('download') + 'Unduh file .json</button>' +
        '<small class="muted" style="display:block;margin-top:6px">Unduhan file mungkin tidak tersedia di versi online; gunakan Salin teks.</small>',
      ok: 'Salin teks', cancel: 'Tutup',
      onOk: function () {
        var ta = $('#exportText');
        var fallback = function () { ta.focus(); ta.select(); toast('Teks dipilih — salin manual (⌘C / tahan lalu Salin)'); };
        try {
          navigator.clipboard.writeText(json).then(function () { toast('Data disalin ke clipboard'); }, fallback);
        } catch (e) { fallback(); }
        return false;
      }
    });
    $('#exportFileBtn').onclick = function () {
      try {
        var blob = new Blob([json], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'alokasiku-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      } catch (e) { toast('Unduhan tidak tersedia — gunakan Salin teks'); }
    };
  }

  function applyImport(text) {
    try {
      var raw = JSON.parse(text);
      if (!raw || typeof raw !== 'object' || !raw.profile) throw new Error('format');
      var next = E.sanitize(raw);
      next.meta.demo = false;
      replaceState(next);
      toast('Data berhasil diimpor');
      return true;
    } catch (e) {
      toast('Data tidak valid — pastikan hasil ekspor Alokasiku');
      return false;
    }
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () { if (applyImport(reader.result) && modalCleanup) modalCleanup(false); };
    reader.readAsText(file);
  }

  function openImport() {
    openModal({
      title: 'Impor data',
      html: '<p class="muted">Tempel teks hasil ekspor, atau pilih file .json. Data saat ini akan diganti.</p>' +
        '<textarea id="importText" class="input textarea" rows="7" spellcheck="false" placeholder="{ &quot;version&quot;: 1, ... }"></textarea>' +
        '<button type="button" class="btn sm" id="importFileBtn" style="margin-top:10px">' + I.icon('upload') + 'Pilih file .json</button>',
      ok: 'Impor',
      onOk: function () {
        var t = $('#importText').value.trim();
        if (!t) { toast('Tempel teks ekspor terlebih dahulu'); return false; }
        return applyImport(t);
      }
    });
    $('#importFileBtn').onclick = function () { $('#importFile').click(); };
  }

  function handleAction(action) {
    $('#menu').hidden = true;
    $('#menuBtn').setAttribute('aria-expanded', 'false');
    if (action === 'snapshot') openSaveSnapshot();
    else if (action === 'history') openHistory();
    else if (action === 'unlock') setLocked(false);
    else if (action === 'export') exportData();
    else if (action === 'import') openImport();
    else if (action === 'demo') {
      askConfirm('Ganti data saat ini dengan data contoh?', 'Muat data contoh', false, function () {
        replaceState(E.sanitize(null));
        toast('Data contoh dimuat');
      });
    } else if (action === 'reset') {
      askConfirm('Hapus semua data keuangan yang tersimpan di browser ini? Tindakan ini tidak bisa dibatalkan, kecuali kamu sudah mengekspor backup.', 'Hapus semua', true, function () {
        S.clear();
        replaceState(E.emptyState());
        show('data');
        toast('Semua data dihapus');
      });
    } else if (action === 'empty') {
      replaceState(E.emptyState());
      show('data');
      toast('Silakan isi data keuanganmu');
    }
  }

  /* =========================================================
     DATA KEUANGAN
     ========================================================= */

  function buildDataForm() {
    $('#expenseFields').innerHTML = E.EXPENSE_FIELDS.map(function (f) {
      return '<label class="field"><span>' + esc(f.name) + '</span>' +
        '<div class="money"><span>Rp</span><input data-bind="profile.expenses.' + f.key + '" data-type="money" inputmode="numeric" autocomplete="off" placeholder="0"></div></label>';
    }).join('');
  }

  function syncForm() {
    $$('[data-bind]').forEach(function (el) {
      if (isFocused(el)) return;
      var v = getPath(state, el.getAttribute('data-bind'));
      if (el.getAttribute('data-type') === 'money') el.value = v ? F.num(v) : '';
      else el.value = v == null ? '' : String(v);
    });
    $$('[data-set]').forEach(function (b) {
      var on = String(getPath(state, b.getAttribute('data-set'))) === b.getAttribute('data-value');
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function handleBind(el) {
    var type = el.getAttribute('data-type'), v;
    if (type === 'money') v = formatMoneyInput(el);
    else if (type === 'int') v = parseInt(el.value, 10) || 0;
    else v = el.value;
    setPath(state, el.getAttribute('data-bind'), v);
    commit({ dataEdit: true });
  }

  function renderRiskPickers() {
    var keys = Object.keys(E.RISK_PROFILES);
    var html = keys.map(function (k, i) {
      var r = E.RISK_PROFILES[k];
      var bars = [0, 1, 2].map(function (j) { return '<i class="' + (j <= i ? 'on' : '') + '"></i>'; }).join('');
      return '<button type="button" class="risk-opt' + (state.profile.risk === k ? ' active' : '') + '" data-risk="' + k + '" aria-pressed="' + (state.profile.risk === k) + '">' +
        '<strong>' + r.name + '<span class="risk-bars">' + bars + '</span></strong><span>' + r.desc + '</span></button>';
    }).join('');
    $$('[data-risk-picker]').forEach(function (el) { el.innerHTML = html; });
  }

  function buildGoals() {
    var list = $('#goalList');
    if (!state.goals.length) {
      list.innerHTML = '<div class="empty" style="grid-column:1/-1">Belum ada tujuan. Tambahkan tujuan seperti liburan, gadget, menikah, DP rumah, atau dana pensiun.</div>';
      return;
    }
    list.innerHTML = state.goals.map(function (g) {
      return '<div class="goal" data-goal="' + esc(g.id) + '">' +
        '<div class="goal-top">' +
          '<input class="goal-name" data-gfield="name" value="' + esc(g.name) + '" maxlength="60" aria-label="Nama tujuan">' +
          '<select class="input" data-gfield="type" style="width:auto;height:32px;font-size:12px;padding-left:10px" aria-label="Jenis tujuan">' +
            '<option value="short"' + (g.type === 'short' ? ' selected' : '') + '>Jangka pendek</option>' +
            '<option value="long"' + (g.type === 'long' ? ' selected' : '') + '>Jangka panjang</option></select>' +
          '<button type="button" class="icon-btn sm" data-gremove aria-label="Hapus tujuan" title="Hapus tujuan">' + I.icon('trash') + '</button>' +
        '</div>' +
        '<div class="goal-fields">' +
          '<label class="field"><span>Target dana</span><div class="money"><span>Rp</span><input data-gfield="target" inputmode="numeric" autocomplete="off" value="' + (g.target ? F.num(g.target) : '') + '" placeholder="0"></div></label>' +
          '<label class="field"><span>Sudah terkumpul</span><div class="money"><span>Rp</span><input data-gfield="current" inputmode="numeric" autocomplete="off" value="' + (g.current ? F.num(g.current) : '') + '" placeholder="0"></div></label>' +
          '<label class="field"><span>Jangka waktu (bulan)</span><input class="input" type="number" min="1" max="600" data-gfield="months" value="' + g.months + '"></label>' +
          '<div class="field"><span data-greq-label>Kebutuhan / bulan</span><div class="input tabular" data-greq style="background:var(--surface-2);border-color:transparent;font-weight:650"></div></div>' +
        '</div>' +
        '<div class="goal-status" data-gstatus></div>' +
      '</div>';
    }).join('');
  }

  function renderGoalStatuses() {
    result.goals.forEach(function (g) {
      var el = $('#goalList [data-goal="' + (window.CSS && CSS.escape ? CSS.escape(g.id) : g.id) + '"]');
      if (!el) return;
      var st = goalStatus(g, result.oneTime);
      $('[data-greq-label]', el).textContent = result.oneTime ? 'Sisa kebutuhan' : 'Kebutuhan / bulan';
      $('[data-greq]', el).textContent = F.rp(result.oneTime ? g.gap : g.required);
      $('[data-gstatus]', el).innerHTML =
        '<div class="progress-head" style="margin-bottom:6px"><span class="muted small">' + F.ratio(g.progress) + ' terkumpul · dari ' +
        (g.type === 'short' ? 'Tabungan' : 'Investasi') + '</span>' + st.tag + '</div>' + st.bar +
        '<div class="progress-meta">' + st.meta + '</div>';
    });
  }

  function renderData() {
    syncForm();
    var r = result, oneTime = state.profile.incomeType === 'oneTime';
    $('#incomeLabel').textContent = oneTime ? 'Jumlah pendapatan sekali masuk' : 'Pendapatan bulanan bersih';
    $('#incomeHint').textContent = oneTime
      ? 'Bonus, THR, hasil proyek, atau uang masuk tidak rutin. Tidak dipakai untuk biaya hidup bulanan.'
      : 'Gaji / penghasilan bersih setelah pajak & potongan.';
    $('#regularIncomeField').hidden = !oneTime;
    $('#expTotal').textContent = F.rp(r.expTotal);
    var ratio = r.expRatio;
    var meter = $('#expMeter');
    meter.style.width = (ratio === null ? 0 : Math.min(100, ratio * 100)) + '%';
    meter.style.background = ratio === null ? 'var(--accent)' : ratio <= 0.5 ? 'var(--ok)' : ratio <= 0.8 ? 'var(--warn)' : 'var(--danger)';
    $('#expRatioText').textContent = ratio === null
      ? (oneTime ? 'Isi pendapatan bulanan rutin untuk melihat rasio pengeluaran.' : 'Isi pendapatan untuk melihat rasio pengeluaran.')
      : Math.round(ratio * 100) + '% dari pendapatan bulanan' + (ratio > 1 ? ' — melebihi pendapatan!' : ratio > 0.5 ? ' — idealnya ≤ 50%' : ' — sehat');
    $('#emTargetText').innerHTML = r.emTarget > 0
      ? 'Target dana darurat: <b>' + F.rp(r.emTarget) + '</b> · terkumpul <b>' + F.ratio(r.emRatio) + '</b>' +
        (r.emMonths !== null ? ' (setara ' + F.dec(r.emMonths) + ' bulan pengeluaran)' : '')
      : 'Isi pengeluaran tetap agar target dana darurat dihitung otomatis.';
    $('#invTargetHint').textContent = r.invTarget > 0
      ? 'Progress ' + F.ratio(r.invProgress) + ' · estimasi tercapai ' + (r.invETA === null ? 'lebih dari 50 tahun' : F.months(r.invETA)) +
        ' (asumsi imbal hasil ' + F.dec(r.expReturn) + '%/tahun)'
      : 'Contoh: dana pensiun atau kebebasan finansial.';
    renderRiskPickers();
    renderGoalStatuses();
  }

  function wireGoals() {
    var list = $('#goalList');
    list.addEventListener('input', function (e) {
      var el = e.target, field = el.getAttribute('data-gfield');
      if (!field) return;
      var id = el.closest('[data-goal]').getAttribute('data-goal');
      var g = state.goals.filter(function (x) { return x.id === id; })[0];
      if (!g) return;
      if (field === 'target' || field === 'current') g[field] = formatMoneyInput(el);
      else if (field === 'months') {
        var m = parseInt(el.value, 10);
        if (!m || m < 1) return;
        g.months = Math.min(600, m);
      } else if (field === 'type') g.type = el.value === 'long' ? 'long' : 'short';
      else g.name = el.value;
      commit({ dataEdit: true });
    });
    list.addEventListener('click', function (e) {
      if (!e.target.closest('[data-gremove]')) return;
      var id = e.target.closest('[data-goal]').getAttribute('data-goal');
      state.goals = state.goals.filter(function (x) { return x.id !== id; });
      buildGoals();
      commit({ dataEdit: true });
      toast('Tujuan dihapus');
    });
    $$('[data-add-goal]').forEach(function (b) {
      b.addEventListener('click', function () {
        var type = b.getAttribute('data-add-goal');
        state.goals.push({
          id: 'g' + Date.now().toString(36), type: type,
          name: type === 'short' ? 'Tujuan baru' : 'Tujuan jangka panjang',
          target: type === 'short' ? 10000000 : 100000000, current: 0, months: type === 'short' ? 12 : 60
        });
        buildGoals();
        commit({ dataEdit: true });
        var last = $$('#goalList .goal-name').pop();
        if (last) { last.focus(); last.select(); }
      });
    });
  }

  /* =========================================================
     Baris persentase (dipakai Alokasi & Investasi)
     ========================================================= */

  function wireShareRows(container, cfg) {
    container.addEventListener('input', function (e) {
      var el = e.target, row = el.closest('[data-key]');
      if (!row) return;
      var role = el.getAttribute('data-role');
      if (role === 'range') cfg.set(row.getAttribute('data-key'), Number(el.value));
      else if (role === 'money') formatMoneyInput(el);
    });
    container.addEventListener('change', function (e) {
      var el = e.target, row = el.closest('[data-key]');
      if (!row) return;
      var key = row.getAttribute('data-key'), role = el.getAttribute('data-role');
      if (role === 'pct') {
        var v = F.parseDecimal(el.value);
        if (isNaN(v)) { render(); return; }
        cfg.set(key, Math.round(v * 10));
      } else if (role === 'money') {
        var base = cfg.base();
        if (base <= 0) { toast('Isi pendapatan terlebih dahulu'); render(); return; }
        cfg.set(key, Math.round(F.parseDigits(el.value) / base * E.TOTAL));
      }
    });
    container.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.matches('input[data-role="pct"], input[data-role="money"]')) e.target.blur();
    });
    container.addEventListener('click', function (e) {
      var b = e.target.closest('[data-role="lock"]');
      if (!b) return;
      cfg.toggleLock(b.closest('[data-key]').getAttribute('data-key'));
    });
  }

  function rowHTML(item, withMoneyInput) {
    return '<div class="alloc-row' + (withMoneyInput ? '' : ' inv-row') + '" data-key="' + item.key + '" style="--c:' + item.color + '">' +
      '<div class="alloc-name"><span class="dot" style="background:' + item.color + '"></span><div><strong>' + esc(item.name) + '</strong><small>' + esc(item.desc) + '</small></div></div>' +
      '<div class="range"><input type="range" min="0" max="1000" step="5" data-role="range" aria-label="Persentase ' + esc(item.name) + '"></div>' +
      '<div class="pct pct-box"><input data-role="pct" inputmode="decimal" autocomplete="off" aria-label="Persen ' + esc(item.name) + '"><span>%</span></div>' +
      (withMoneyInput
        ? '<div class="money"><span>Rp</span><input data-role="money" inputmode="numeric" autocomplete="off" aria-label="Nominal ' + esc(item.name) + '"></div>'
        : '<div class="amt" data-role="amt"></div>') +
      '<button type="button" class="lock lock-btn" data-role="lock"></button>' +
      (withMoneyInput ? '<div class="warn-line" data-role="warn"></div>' : '<div class="inst-note">' + esc(item.note) + ' <span class="muted">· asumsi ' + F.dec(item.ret) + '%/thn · risiko ' + item.risk + '/5</span></div>') +
    '</div>';
  }

  function renderShareRows(container, shares, amounts, locks) {
    $$('[data-key]', container).forEach(function (row) {
      var k = row.getAttribute('data-key'), sh = shares[k], locked = !!locks[k];
      setRange($('[data-role="range"]', row), sh, 1000);
      var pct = $('[data-role="pct"]', row);
      if (!isFocused(pct)) pct.value = F.pctNum(sh);
      var money = $('[data-role="money"]', row);
      if (money && !isFocused(money)) money.value = F.num(amounts[k]);
      var amt = $('[data-role="amt"]', row);
      if (amt) amt.textContent = F.rp(amounts[k]);
      var lock = $('[data-role="lock"]', row);
      lock.classList.toggle('on', locked);
      lock.innerHTML = I.icon(locked ? 'lock' : 'unlock');
      lock.title = locked ? 'Terkunci — klik untuk membuka' : 'Kunci agar tidak ikut berubah';
      lock.setAttribute('aria-label', (locked ? 'Buka kunci ' : 'Kunci ') + k);
      lock.setAttribute('aria-pressed', locked ? 'true' : 'false');
      row.classList.toggle('locked', locked);
    });
  }

  /* =========================================================
     ALOKASI
     ========================================================= */

  function setAlloc(key, tenths) {
    var a = state.allocation;
    var before = a.shares[key];
    a.shares = E.setShare(a.shares, a.locks, key, tenths, E.CAT_KEYS, E.PROTECTED_CATS);
    if (a.shares[key] !== Math.round(tenths) && before === a.shares[key]) toast('Buka kunci kategori lain agar persentase bisa berubah');
    a.mode = 'custom';
    a.preset = 'custom';
    commit();
  }

  function buildAllocation() {
    var items = [{ key: 'smart', name: 'Otomatis (Smart)', desc: 'Menyesuaikan pengeluaran, dana darurat, tujuan & risiko', icon: 'sparkles' }]
      .concat(Object.keys(E.PRESETS).map(function (k) { return { key: k, name: E.PRESETS[k].name, desc: E.PRESETS[k].desc }; }));
    $('#presetGrid').innerHTML = items.map(function (it) {
      return '<button type="button" class="preset" data-preset="' + it.key + '"><strong>' + (it.icon ? I.icon(it.icon) : '') + esc(it.name) +
        '</strong><span>' + esc(it.desc) + '</span><div class="mini"></div></button>';
    }).join('');
    $('#presetGrid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-preset]');
      if (!b) return;
      var k = b.getAttribute('data-preset'), a = state.allocation;
      a.locks = {};
      if (k === 'smart') { a.mode = 'smart'; a.preset = 'smart'; }
      else { a.mode = 'preset'; a.preset = k; a.shares = E.toShares(E.PRESETS[k].pct); }
      commit();
      toast((k === 'smart' ? 'Alokasi otomatis' : 'Preset ' + E.PRESETS[k].name) + ' diterapkan');
    });

    $('#allocRows').innerHTML = E.CATEGORIES.map(function (c) { return rowHTML(c, true); }).join('');
    wireShareRows($('#allocRows'), {
      set: setAlloc,
      base: function () { return result.income; },
      toggleLock: function (k) {
        var a = state.allocation;
        a.locks[k] = !a.locks[k];
        if (a.mode === 'smart') { a.mode = 'custom'; a.preset = 'custom'; }
        commit();
      }
    });
  }

  function miniBar(shares) {
    return E.CATEGORIES.map(function (c) {
      return shares[c.key] > 0 ? '<i style="width:' + shares[c.key] / 10 + '%;background:' + c.color + '"></i>' : '';
    }).join('');
  }

  function renderAllocation() {
    var r = result, a = state.allocation;
    $$('#presetGrid [data-preset]').forEach(function (b) {
      var k = b.getAttribute('data-preset');
      b.classList.toggle('active', (a.mode === 'smart' && k === 'smart') || (a.mode === 'preset' && a.preset === k));
      var sh = k === 'smart' ? E.smartAllocation(state.profile, state.goals) : E.toShares(E.PRESETS[k].pct);
      $('.mini', b).innerHTML = miniBar(sh);
    });

    var okTotal = r.totalShare === E.TOTAL && r.totalAllocated === r.income;
    var pill = $('#allocTotal');
    pill.innerHTML = I.icon(okTotal ? 'check' : 'alert') + 'Total ' + F.pct(r.totalShare);
    pill.style.background = okTotal ? '' : 'var(--danger-soft)';
    pill.style.color = okTotal ? '' : 'var(--danger)';

    var note;
    if (a.mode === 'smart') note = I.icon('sparkles') + '<span><b>Mode Otomatis</b> — dihitung ulang setiap data keuangan berubah. Menggeser slider akan beralih ke mode manual.</span>';
    else if (a.mode === 'preset') note = I.icon('pie') + '<span><b>Preset ' + esc(E.PRESETS[a.preset].name) + '</b> — persentase tetap. Sesuaikan agar anggaran kebutuhan pokok menutup pengeluaran aktual.</span>';
    else note = I.icon('sliders') + '<span><b>Mode Manual</b> — ' + F.rp(r.totalAllocated) + ' dari ' + F.rp(r.income) + ' teralokasi, sisa <b>Rp 0</b>. Kunci kategori agar tidak ikut berubah.</span>';
    $('#allocModeNote').innerHTML = note;

    renderShareRows($('#allocRows'), r.shares, r.amounts, a.locks);
    var issues = {};
    r.budgetIssues.forEach(function (b) { issues[b.key] = b; });
    $$('#allocRows [data-key]').forEach(function (row) {
      var k = row.getAttribute('data-key'), w = $('[data-role="warn"]', row), txt = '';
      if (issues[k]) txt = 'Kurang ' + F.rp(issues[k].gap) + ' dari pengeluaran aktual ' + F.rp(issues[k].actual);
      else if (k === 'darurat' && r.emGap <= 0 && r.emTarget > 0 && r.shares.darurat > 0) txt = 'Dana darurat sudah penuh — porsi ini bisa dialihkan ke investasi';
      w.innerHTML = txt ? I.icon('alert') + '<span>' + txt + '</span>' : '';
    });

    $('#allocSumSub').textContent = (r.oneTime ? 'Pendapatan sekali masuk ' : 'Pendapatan bulanan ') + F.rp(r.income);
    drawDoughnut('allocChart', null, catItems(r, false), { label: r.oneTime ? 'Sekali masuk' : 'Per bulan', value: F.rpShort(r.income) });

    var guide = { needs: 'Ideal ≤ 50%', future: 'Ideal ≥ 20%', wants: 'Ideal ≤ 30%', other: '' };
    var html = '<div class="stacked" style="height:12px">' + miniBar(r.shares) + '</div>';
    html += Object.keys(E.GROUPS).map(function (g) {
      var G = E.GROUPS[g], d = r.groups[g];
      var cats = E.CATEGORIES.filter(function (c) { return c.group === g; });
      var inner = cats.map(function (c) {
        return d.share > 0 ? '<i style="width:' + (r.shares[c.key] / d.share * 100) + '%;background:' + c.color + '"></i>' : '';
      }).join('');
      return '<div><div class="group-bar-head"><span><span class="dot" style="background:' + G.color + ';border-radius:50%"></span>' + G.name +
        (guide[g] ? ' <span class="muted small" style="font-weight:400">· ' + guide[g] + '</span>' : '') +
        '</span><span>' + F.pct(d.share) + ' · ' + F.rp(d.amount) + '</span></div>' +
        '<div class="stacked" style="height:6px"><div style="display:flex;gap:2px;width:' + (d.share / 10) + '%">' + inner + '</div></div></div>';
    }).join('');
    $('#groupBars').innerHTML = html;
  }

  /* =========================================================
     INVESTASI
     ========================================================= */

  function setInv(key, tenths) {
    var m = state.investMix;
    m.shares = E.setShare(m.shares, m.locks, key, tenths, E.INST_KEYS);
    m.mode = 'manual';
    commit();
  }

  function buildInvest() {
    $('#invRows').innerHTML = E.INSTRUMENTS.map(function (i) {
      return rowHTML({ key: i.key, name: i.name, desc: i.short, color: i.color, note: i.note, ret: i.ret, risk: i.risk }, false);
    }).join('');
    wireShareRows($('#invRows'), {
      set: setInv,
      base: function () { return result.amounts.investasi; },
      toggleLock: function (k) {
        var m = state.investMix;
        m.locks[k] = !m.locks[k];
        m.mode = 'manual';
        commit();
      }
    });
    $('#invShareRange').addEventListener('input', function (e) { setAlloc('investasi', Number(e.target.value)); });
    $$('[data-invmode]').forEach(function (b) {
      b.addEventListener('click', function () {
        var mode = b.getAttribute('data-invmode');
        state.investMix.mode = mode;
        if (mode === 'auto') state.investMix.locks = {};
        commit();
      });
    });
    $('#projYears').addEventListener('change', function (e) {
      state.ui.projYears = parseInt(e.target.value, 10) || 10;
      S.saveDebounced(state);
      render();
    });
  }

  function riskLabel(score) {
    if (score < 1.8) return 'Rendah';
    if (score < 2.6) return 'Menengah-rendah';
    if (score < 3.4) return 'Menengah';
    if (score < 4.1) return 'Menengah-tinggi';
    return 'Tinggi';
  }

  function renderInvest() {
    var r = result, m = state.investMix;
    $('#invAmount').textContent = F.rp(r.amounts.investasi);
    $('#invPeriod').textContent = r.oneTime ? 'dari pendapatan sekali masuk' : 'per bulan · ' + F.pct(r.shares.investasi) + ' dari pendapatan';
    var tag = $('#invRiskTag');
    tag.textContent = 'Profil ' + E.RISK_PROFILES[state.profile.risk].name;
    tag.className = 'tag neutral';
    setRange($('#invShareRange'), r.shares.investasi, 1000);
    $('#invShareOut').textContent = F.pct(r.shares.investasi);
    $('#invStats').innerHTML =
      '<div class="stat"><span>Imbal hasil asumsi</span><strong>' + F.dec(r.expReturn) + '% / thn</strong></div>' +
      '<div class="stat"><span>Tingkat risiko</span><strong>' + riskLabel(r.riskScore) + '</strong></div>' +
      '<div class="stat"><span>Investasi saat ini</span><strong>' + F.rpShort(r.invCurrent) + '</strong></div>';
    renderRiskPickers();
    $$('[data-invmode]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-invmode') === m.mode); });

    renderShareRows($('#invRows'), r.invShares, r.invAmounts, m.locks);
    $('#invChartSub').textContent = m.mode === 'auto'
      ? 'Rekomendasi profil ' + E.RISK_PROFILES[state.profile.risk].name.toLowerCase() + (r.emRatio < 0.5 && state.profile.risk !== 'konservatif' ? ' · digeser ke RDPU karena dana darurat < 50%' : '')
      : 'Komposisi manual';
    drawDoughnut('invChart', '#invLegend', instItems(r, true), { label: 'Investasi', value: F.rpShort(r.amounts.investasi) });

    var years = state.ui.projYears || 10;
    $('#projYears').value = String(years);
    var proj = E.project(r.invStart, r.monthlyInvest, r.expReturn, years);
    var ds = [
      { label: 'Nilai investasi (' + F.dec(r.expReturn) + '%/thn)', data: proj.map(function (p) { return p.value; }), color: '#16B47A', fill: true },
      { label: 'Total modal disetor', data: proj.map(function (p) { return p.modal; }), color: '#8590A2', dash: true }
    ];
    if (r.invTarget > 0) ds.push({ label: 'Target', data: proj.map(function () { return r.invTarget; }), color: '#F2A93B', dash: true });
    C.line('projChart', { labels: proj.map(function (p) { return p.year === 0 ? 'Kini' : 'Thn ' + p.year; }), datasets: ds });
    var last = proj[proj.length - 1];
    $('#projSub').textContent = r.oneTime
      ? 'Modal awal ' + F.rp(r.invStart) + ' (investasi saat ini + alokasi sekali masuk), tanpa setoran rutin'
      : 'Modal awal ' + F.rp(r.invStart) + ' + setoran ' + F.rp(r.monthlyInvest) + '/bulan';
    $('#projStats').innerHTML =
      '<div class="stat"><span>Nilai setelah ' + years + ' tahun</span><strong>' + F.rpShort(last.value) + '</strong></div>' +
      '<div class="stat"><span>Estimasi imbal hasil</span><strong class="pos">+' + F.rpShort(last.value - last.modal) + '</strong></div>' +
      '<div class="stat"><span>Target investasi tercapai</span><strong>' + (r.invTarget > 0 ? (r.invETA === null ? '> 50 tahun' : F.months(r.invETA)) : '—') + '</strong></div>';
  }

  /* =========================================================
     SIMULASI
     ========================================================= */

  function defaultSim() { return { incomeChange: 0, expenseChange: 0, autoRealloc: true, investOverride: false, investPct: Math.round(result.shares.investasi / 10) }; }

  function signed(v, suffix) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + (suffix || ''); }

  function buildSim() {
    function upd() { S.saveDebounced(state); renderSim(); }
    $('#simInc').addEventListener('input', function (e) { state.sim.incomeChange = Number(e.target.value); upd(); });
    $('#simExp').addEventListener('input', function (e) { state.sim.expenseChange = Number(e.target.value); upd(); });
    $('#simInv').addEventListener('input', function (e) { state.sim.investPct = Number(e.target.value); upd(); });
    $('#simAuto').addEventListener('change', function (e) { state.sim.autoRealloc = e.target.checked; upd(); });
    $('#simInvOn').addEventListener('change', function (e) {
      state.sim.investOverride = e.target.checked;
      if (e.target.checked) state.sim.investPct = Math.round(result.shares.investasi / 10);
      upd();
    });
    $$('[data-sim]').forEach(function (b) {
      b.addEventListener('click', function () { Object.assign(state.sim, JSON.parse(b.getAttribute('data-sim'))); upd(); });
    });
    $('#simReset').addEventListener('click', function () { state.sim = defaultSim(); upd(); });
    $('#simApply').addEventListener('click', function () {
      var sim = state.sim;
      if (!sim.incomeChange && !sim.expenseChange && !sim.investOverride) { toast('Belum ada perubahan skenario'); return; }
      askConfirm('Terapkan skenario ini? Pendapatan, pengeluaran tetap, dan alokasi di data kamu akan diperbarui.', 'Terapkan', false, function () { applySim(sim); });
    });
  }

  function applySim(sim) {
    var res = E.simulate(state, sim, FMT);
    state.profile = res.state.profile;
    if (sim.investOverride || (!sim.autoRealloc && state.allocation.mode !== 'smart')) {
      state.allocation.shares = res.state.allocation.shares;
      state.allocation.mode = 'custom';
      state.allocation.preset = 'custom';
    } else if (sim.autoRealloc) {
      state.allocation.mode = 'smart';
      state.allocation.preset = 'smart';
    }
    recompute();
    state.sim = defaultSim();
    commit({ dataEdit: true });
    toast('Skenario diterapkan ke data kamu');
    show('dashboard');
  }

  function renderSim() {
    var sim = state.sim, b = result;
    setRange($('#simInc'), sim.incomeChange);
    setRange($('#simExp'), sim.expenseChange);
    setRange($('#simInv'), sim.investPct);
    $('#simAuto').checked = !!sim.autoRealloc;
    $('#simInvOn').checked = !!sim.investOverride;
    $('#simInv').disabled = !sim.investOverride;
    $('#simInvWrap').style.opacity = sim.investOverride ? 1 : 0.5;
    $('#simIncOut').textContent = signed(sim.incomeChange, '%');
    $('#simExpOut').textContent = signed(sim.expenseChange, '%');
    $('#simInvOut').textContent = sim.investPct + '%';

    var res = E.simulate(state, sim, FMT), s = res.result;
    $('#simIncHint').textContent = 'Pendapatan menjadi ' + F.rp(s.income) + (b.oneTime ? '' : '/bulan');
    $('#simExpHint').textContent = 'Pengeluaran tetap menjadi ' + F.rp(s.expTotal) + '/bulan';

    function scoreBox(title, h) {
      return '<div class="box"><span>' + title + '</span><strong style="color:' + LEVEL_COLOR[h.level] + '">' + h.score + '</strong><span class="tag ' + h.level + '">' + h.label + '</span></div>';
    }
    $('#simScore').innerHTML = scoreBox('Skor saat ini', b.health) + '<span class="arrow">' + I.icon('trend') + '</span>' + scoreBox('Skor simulasi', s.health);

    var years = state.ui.projYears || 10;
    var pb = E.project(b.invStart, b.monthlyInvest, b.expReturn, years);
    var ps = E.project(s.invStart, s.monthlyInvest, s.expReturn, years);

    function dMoney(x, y, inverse) {
      var d = y - x;
      if (!d) return '<span class="muted">—</span>';
      var good = inverse ? d < 0 : d > 0;
      return '<span class="' + (good ? 'pos' : 'neg') + '">' + (d > 0 ? '+' : '−') + F.rpShort(Math.abs(d)) + '</span>';
    }
    function dMonths(x, y) {
      if (x === y) return '<span class="muted">—</span>';
      if (x === null) return '<span class="pos">lebih cepat</span>';
      if (y === null) return '<span class="neg">tidak tercapai</span>';
      var d = y - x;
      return '<span class="' + (d < 0 ? 'pos' : 'neg') + '">' + (d < 0 ? '−' : '+') + Math.abs(d) + ' bln</span>';
    }
    function m(v) { return v === null ? '—' : F.months(v); }
    var rows = [
      ['Pendapatan', F.rp(b.income), F.rp(s.income), dMoney(b.income, s.income)],
      ['Pengeluaran tetap', F.rp(b.expTotal), F.rp(s.expTotal), dMoney(b.expTotal, s.expTotal, true)],
      ['Kebutuhan pokok', F.rp(b.groups.needs.amount), F.rp(s.groups.needs.amount), dMoney(b.groups.needs.amount, s.groups.needs.amount, true)],
      ['Dana darurat', F.rp(b.amounts.darurat), F.rp(s.amounts.darurat), dMoney(b.amounts.darurat, s.amounts.darurat)],
      ['Tabungan', F.rp(b.amounts.tabungan), F.rp(s.amounts.tabungan), dMoney(b.amounts.tabungan, s.amounts.tabungan)],
      ['Investasi', F.rp(b.amounts.investasi) + ' <span class="muted small">' + F.pct(b.shares.investasi) + '</span>', F.rp(s.amounts.investasi) + ' <span class="muted small">' + F.pct(s.shares.investasi) + '</span>', dMoney(b.amounts.investasi, s.amounts.investasi), true],
      ['Hiburan & lifestyle', F.rp(b.lifestyleAmount), F.rp(s.lifestyleAmount), dMoney(b.lifestyleAmount, s.lifestyleAmount)],
      ['Sisa setelah biaya tetap', F.rp(b.leftover), F.rp(s.leftover), dMoney(b.leftover, s.leftover)],
      ['Dana darurat penuh dalam', m(b.emETA), m(s.emETA), dMonths(b.emETA, s.emETA)],
      ['Nilai investasi ' + years + ' thn', F.rpShort(pb[pb.length - 1].value), F.rpShort(ps[ps.length - 1].value), dMoney(pb[pb.length - 1].value, ps[ps.length - 1].value), true]
    ];
    $('#simTable').innerHTML = '<thead><tr><th>Metrik</th><th>Saat ini</th><th>Simulasi</th><th class="d">Selisih</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr' + (r[4] ? ' class="hl"' : '') + '><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td class="d">' + r[3] + '</td></tr>';
      }).join('') + '</tbody>';

    C.bar('simBarChart', {
      horizontal: true,
      labels: E.CATEGORIES.map(function (c) { return c.name; }),
      datasets: [
        { label: 'Saat ini', data: E.CAT_KEYS.map(function (k) { return b.amounts[k]; }), color: C.hexA('#8590A2', 0.55) },
        { label: 'Simulasi', data: E.CAT_KEYS.map(function (k) { return s.amounts[k]; }), color: '#16B47A' }
      ]
    });
    $('#simProjSub').textContent = years + ' tahun · ubah horizon di menu Investasi';
    C.line('simLineChart', {
      labels: pb.map(function (p) { return p.year === 0 ? 'Kini' : 'Thn ' + p.year; }),
      datasets: [
        { label: 'Saat ini', data: pb.map(function (p) { return p.value; }), color: '#8590A2', dash: true },
        { label: 'Simulasi', data: ps.map(function (p) { return p.value; }), color: '#16B47A', fill: true }
      ]
    });
  }

  /* =========================================================
     DASHBOARD
     ========================================================= */

  function ringSVG(score, color) {
    var r = 60, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, score)) / 100);
    return '<div class="ring-wrap"><svg class="ring" viewBox="0 0 148 148"><circle class="ring-track" cx="74" cy="74" r="' + r + '"/>' +
      '<circle class="ring-val" cx="74" cy="74" r="' + r + '" style="stroke:' + color + '" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '" transform="rotate(-90 74 74)"/></svg>' +
      '<div class="ring-label"><div class="ring-score">' + score + '</div><div class="ring-sub">dari 100</div></div></div>';
  }

  function kpi(icon, label, value, sub, cls) {
    return '<div class="card kpi"><div class="kpi-top"><span class="kpi-ico">' + I.icon(icon) + '</span>' + label + '</div>' +
      '<div class="kpi-value ' + (cls || '') + '" title="' + esc(value) + '">' + value + '</div><div class="kpi-sub">' + sub + '</div></div>';
  }

  function renderDashboard() {
    var r = result, h = r.health, color = LEVEL_COLOR[h.level];

    $('#scoreCard').innerHTML = ringSVG(h.score, color) +
      '<div class="score-info"><h3>Financial Health Score</h3><div class="label">' + h.label + '</div>' +
      h.components.map(function (c) {
        return '<div class="comp" title="' + esc(c.hint) + '"><span>' + c.name + '</span><span>' + Math.round(c.score) + '/' + c.max + '</span>' +
          '<div class="bar"><i style="width:' + (c.score / c.max * 100) + '%;background:' + color + '"></i></div></div>';
      }).join('') + '</div>';

    var f = r.focus;
    $('#focusCard').innerHTML =
      '<div class="focus-eyebrow">' + I.icon('target') + 'Rekomendasi fokus saat ini</div>' +
      '<h2>' + esc(f.title) + '</h2><p>' + esc(f.text) + '</p>' +
      '<div class="focus-stats">' +
        '<div>Untuk masa depan<strong>' + F.pct(r.futureShare) + '</strong></div>' +
        '<div>Dana darurat<strong>' + (r.emTarget > 0 ? F.ratio(r.emRatio) : '—') + '</strong></div>' +
        '<div>Imbal hasil asumsi<strong>' + F.dec(r.expReturn) + '%/thn</strong></div>' +
      '</div>';

    var per = r.oneTime ? 'sekali masuk' : 'per bulan';
    $('#kpiGrid').innerHTML =
      kpi('wallet', 'Total Pendapatan', F.rp(r.income), per) +
      kpi('receipt', 'Pengeluaran Tetap', F.rp(r.expTotal), r.expRatio === null ? 'per bulan' : F.ratio(r.expRatio) + ' dari pendapatan', r.expRatio !== null && r.expRatio > 1 ? 'neg' : '') +
      kpi('trend', 'Dapat Diinvestasikan', F.rp(r.amounts.investasi), F.pct(r.shares.investasi) + ' · ' + per) +
      kpi('heart', 'Dana Lifestyle', F.rp(r.lifestyleAmount), 'Hiburan + lifestyle · ' + F.pct(r.lifestyleShare)) +
      kpi('coins', 'Sisa Uang', F.rp(r.leftover), r.oneTime ? 'seluruhnya bebas dialokasikan' : 'setelah pengeluaran tetap', r.leftover < 0 ? 'neg' : '') +
      kpi('piggy', 'Ditabung & Diinvestasi', F.rp(r.futureAmount), 'Darurat + tabungan + investasi');

    drawDoughnut('dashAllocChart', '#dashAllocLegend', catItems(r, true), { label: 'Pendapatan', value: F.rpShort(r.income) });
    $('#dashInvSub').textContent = 'Profil ' + E.RISK_PROFILES[state.profile.risk].name.toLowerCase() + ' · ' + F.rp(r.amounts.investasi) + (r.oneTime ? '' : '/bulan');
    drawDoughnut('dashInvChart', '#dashInvLegend', instItems(r, true), { label: 'Investasi', value: F.rpShort(r.amounts.investasi) });

    // Progress
    var prog = [];
    var emTag = r.emTarget <= 0 ? '<span class="tag neutral">Belum ada target</span>' : r.emGap <= 0 ? '<span class="tag ok">Penuh</span>' : '<span class="tag ' + (r.emRatio < 0.5 ? 'warn' : 'info') + '">' + F.ratio(r.emRatio) + '</span>';
    prog.push('<div class="progress-item"><div class="progress-head"><strong>' + I.icon('shield') + 'Dana Darurat</strong>' + emTag + '</div>' +
      bar(r.emRatio, '#F2A93B', r.oneTime ? (r.emTarget ? Math.min(1, r.emAfter / r.emTarget) : 0) : null) +
      '<div class="progress-meta"><span><b>' + F.rp(r.emCurrent) + '</b> / ' + F.rp(r.emTarget) + '</span><span>' +
      (r.emGap <= 0 ? (r.emMonths !== null ? F.dec(r.emMonths) + ' bulan pengeluaran' : 'Target tercapai') :
        r.oneTime ? '+' + F.rp(r.amounts.darurat) + ' dari alokasi ini' :
        r.emETA ? 'Penuh dalam ' + F.months(r.emETA) : 'Belum ada alokasi') + '</span></div></div>');
    if (r.invTarget > 0) {
      prog.push('<div class="progress-item"><div class="progress-head"><strong>' + I.icon('trend') + 'Target Investasi</strong><span class="tag info">' + F.ratio(r.invProgress) + '</span></div>' +
        bar(r.invProgress, '#16B47A') +
        '<div class="progress-meta"><span><b>' + F.rp(r.invCurrent) + '</b> / ' + F.rp(r.invTarget) + '</span><span>' +
        (r.invETA === null ? 'Lebih dari 50 tahun' : r.invETA === 0 ? 'Tercapai' : 'Estimasi ' + F.months(r.invETA)) + '</span></div></div>');
    }
    r.goals.forEach(function (g) {
      var st = goalStatus(g, r.oneTime);
      prog.push('<div class="progress-item"><div class="progress-head"><strong>' + I.icon('flag') + esc(g.name) +
        ' <span class="muted small" style="font-weight:400">' + (g.type === 'short' ? 'pendek' : 'panjang') + '</span></strong>' + st.tag + '</div>' +
        st.bar + '<div class="progress-meta">' + st.meta + '</div></div>');
    });
    if (!r.goals.length) prog.push('<div class="progress-item"><p class="muted small">Belum ada tujuan keuangan. <a href="#data" data-goto="data" style="color:var(--accent)">Tambahkan tujuan</a> untuk melacak progresnya.</p></div>');
    $('#progressList').innerHTML = prog.join('');

    // Prioritas
    var focusKey = { darurat: 'darurat', tabungan: 'tabungan', investasi: 'investasi', pengeluaran: 'needs' }[f.key];
    $('#priorityList').innerHTML = r.priorities.map(function (p) {
      return '<li class="' + (p.key === focusKey ? 'hl' : '') + '"><div><div class="t">' + p.title + '</div><div class="n">' + esc(p.note) + '</div></div>' +
        '<div class="a">' + F.rp(p.amount) + '<small>' + F.pct(p.share) + '</small></div></li>';
    }).join('');

    var icons = { warn: 'alert', ok: 'check', info: 'info' };
    $('#insightList').innerHTML = r.insights.map(function (it) {
      return '<li class="' + it.type + '">' + I.icon(icons[it.type]) + '<span>' + esc(it.text) + '</span></li>';
    }).join('');
  }

  /* =========================================================
     Init & event global
     ========================================================= */

  function wireGlobal() {
    document.addEventListener('input', function (e) {
      if (e.target.matches && e.target.matches('[data-bind]')) handleBind(e.target);
    });
    document.addEventListener('click', function (e) {
      var t = e.target;
      var nav = t.closest('[data-nav]');
      if (nav) { show(nav.getAttribute('data-nav')); return; }
      var go = t.closest('[data-goto]');
      if (go) { e.preventDefault(); show(go.getAttribute('data-goto')); return; }
      var set = t.closest('[data-set]');
      if (set) {
        setPath(state, set.getAttribute('data-set'), set.getAttribute('data-value'));
        commit({ dataEdit: true });
        return;
      }
      var risk = t.closest('[data-risk]');
      if (risk) {
        state.profile.risk = risk.getAttribute('data-risk');
        state.investMix.mode = 'auto';
        state.investMix.locks = {};
        commit({ dataEdit: true });
        toast('Profil ' + E.RISK_PROFILES[state.profile.risk].name + ' diterapkan');
        return;
      }
      var act = t.closest('[data-action]');
      if (act) { handleAction(act.getAttribute('data-action')); return; }
      if (!t.closest('.menu-wrap')) { $('#menu').hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); }
    });

    // Legenda interaktif
    document.addEventListener('mouseover', function (e) {
      var li = e.target.closest && e.target.closest('.legend li');
      if (!li) return;
      var ul = li.parentElement;
      if (ul._hi === li.getAttribute('data-i')) return;
      ul._hi = li.getAttribute('data-i');
      C.highlight(ul.getAttribute('data-chart'), Number(ul._hi));
    });
    $$('.legend').forEach(function (ul) {
      ul.addEventListener('mouseleave', function () { ul._hi = null; C.highlight(ul.getAttribute('data-chart'), null); });
      ul.addEventListener('click', function (e) {
        var li = e.target.closest('li');
        if (!li) return;
        var vis = C.toggle(ul.getAttribute('data-chart'), Number(li.getAttribute('data-i')));
        li.classList.toggle('off', !vis);
      });
    });

    $('#menuBtn').addEventListener('click', function () {
      var m = $('#menu');
      m.hidden = !m.hidden;
      $('#menuBtn').setAttribute('aria-expanded', m.hidden ? 'false' : 'true');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      $('#menu').hidden = true;
      if (modalCleanup) modalCleanup(false);
    });
    $('#importFile').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
      e.target.value = '';
    });
    $('#lockBtn').addEventListener('click', function () {
      if (isLocked()) { setLocked(false); return; }
      openModal({
        title: 'Kunci data?',
        html: '<p>Saat terkunci, semua angka, alokasi, dan tujuan tidak bisa diubah sehingga tidak berubah tanpa sengaja. Kamu tetap bisa melihat dashboard dan mencoba simulasi. Buka kunci kapan saja dengan tombol yang sama.</p>',
        ok: 'Kunci data',
        onClose: function (yes) { if (yes) setLocked(true); }
      });
    });
    $('#themeBtn').addEventListener('click', function () {
      state.theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
      applyTheme();
      S.save(state);
      render();
    });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () { if (state.theme === 'auto') { applyTheme(); render(); } };
      if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
    }
    window.addEventListener('hashchange', function () { var v = location.hash.slice(1); if (v !== current) show(v); });
    window.addEventListener('storage', function (e) {
      if (e.key === S.KEY && e.newValue) { state = E.sanitize(JSON.parse(e.newValue)); buildGoals(); recompute(); render(); }
    });

    S.onSave(function (ok) {
      var el = $('#saveStatus');
      el.classList.toggle('err', !ok);
      var d = new Date();
      var hh = ('0' + d.getHours()).slice(-2) + '.' + ('0' + d.getMinutes()).slice(-2);
      $('span', el).textContent = ok ? 'Tersimpan ' + hh : 'Gagal menyimpan';
      el.title = ok ? 'Tersimpan di localStorage browser ini pukul ' + hh : 'Penyimpanan lokal tidak tersedia (mode privat?)';
    });
  }

  function init() {
    state = E.sanitize(S.load());
    I.inject();
    applyTheme();
    buildDataForm();
    buildGoals();
    wireGoals();
    buildAllocation();
    buildInvest();
    buildSim();
    wireGlobal();
    recompute();
    S.save(state);
    show(location.hash.slice(1) || 'dashboard');
  }

  // Service worker: aplikasi bisa dibuka offline (hanya di https / localhost).
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !/claude\.(ai|site)$/.test(location.hostname)) {
    window.addEventListener('load', function () {
      try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) { /* abaikan */ }
    });
  }

  // Kunci zoom: blokir pinch-zoom (Safari iOS) dan double-tap zoom.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) {
    document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false });
  });
  document.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  // Double-tap zoom dimatikan lewat CSS `touch-action: manipulation`.

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
