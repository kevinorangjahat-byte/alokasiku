/*
 * Alokasiku — Engine kalkulasi keuangan (murni, tanpa DOM).
 * Semua persentase disimpan sebagai "persepuluh persen" (integer, total = 1000)
 * agar penjumlahan selalu tepat 100% tanpa galat floating point.
 */
(function (root) {
  'use strict';

  var TOTAL = 1000;

  var CATEGORIES = [
    { key: 'makan', name: 'Makan', desc: 'Makan, minum & belanja dapur', group: 'needs', color: '#4F7CFF' },
    { key: 'transportasi', name: 'Transportasi', desc: 'Bensin, ojol, KRL, parkir', group: 'needs', color: '#22B8CF' },
    { key: 'tagihan', name: 'Tagihan', desc: 'Listrik, air, internet, pulsa', group: 'needs', color: '#8B7CF6' },
    { key: 'kos', name: 'Kos / Sewa', desc: 'Kos, kontrakan, atau KPR', group: 'needs', color: '#64748B' },
    { key: 'darurat', name: 'Dana Darurat', desc: 'Bantalan 3–12 bulan pengeluaran', group: 'future', color: '#F2A93B' },
    { key: 'investasi', name: 'Investasi', desc: 'Pertumbuhan aset jangka panjang', group: 'future', color: '#16B47A' },
    { key: 'tabungan', name: 'Tabungan', desc: 'Tujuan jangka pendek & sinking fund', group: 'future', color: '#93C83E' },
    { key: 'hiburan', name: 'Hiburan', desc: 'Nonton, langganan, hobi', group: 'wants', color: '#F0648A' },
    { key: 'lifestyle', name: 'Lifestyle', desc: 'Nongkrong, fashion, self-reward', group: 'wants', color: '#C46BF0' },
    { key: 'lainnya', name: 'Lainnya', desc: 'Cicilan, keluarga, sedekah, buffer', group: 'other', color: '#94A3B8' }
  ];
  var CAT_KEYS = CATEGORIES.map(function (c) { return c.key; });
  /** Kategori yang baru dikurangi setelah kategori fleksibel habis saat menyeimbangkan. */
  var PROTECTED_CATS = ['makan', 'transportasi', 'tagihan', 'kos', 'lainnya'];
  var CAT = {};
  CATEGORIES.forEach(function (c) { CAT[c.key] = c; });

  var GROUPS = {
    needs: { name: 'Kebutuhan Pokok', color: '#4F7CFF' },
    future: { name: 'Masa Depan', color: '#16B47A' },
    wants: { name: 'Keinginan', color: '#F0648A' },
    other: { name: 'Lainnya', color: '#94A3B8' }
  };

  var EXPENSE_FIELDS = [
    { key: 'kos', cat: 'kos', name: 'Kos / Sewa / KPR' },
    { key: 'makan', cat: 'makan', name: 'Makan & belanja harian' },
    { key: 'transportasi', cat: 'transportasi', name: 'Transportasi' },
    { key: 'tagihan', cat: 'tagihan', name: 'Tagihan (listrik, air, internet, pulsa)' },
    { key: 'lainnya', cat: 'lainnya', name: 'Lainnya (cicilan, asuransi, kirim keluarga)' }
  ];

  var PRESETS = {
    beginner: {
      name: 'Financial Beginner',
      desc: 'Bangun dana darurat & kebiasaan menabung dulu',
      pct: { makan: 20, transportasi: 8, tagihan: 7, kos: 15, darurat: 15, investasi: 7, tabungan: 10, hiburan: 5, lifestyle: 8, lainnya: 5 }
    },
    balanced: {
      name: 'Balanced Investor',
      desc: 'Seimbang antara hidup nyaman & bertumbuh',
      pct: { makan: 17, transportasi: 7, tagihan: 6, kos: 15, darurat: 10, investasi: 18, tabungan: 10, hiburan: 5, lifestyle: 8, lainnya: 4 }
    },
    aggressive: {
      name: 'Aggressive Investor',
      desc: 'Maksimalkan investasi, gaya hidup hemat',
      pct: { makan: 15, transportasi: 6, tagihan: 5, kos: 12, darurat: 7, investasi: 32, tabungan: 8, hiburan: 4, lifestyle: 7, lainnya: 4 }
    },
    wealth: {
      name: 'Wealth Building',
      desc: 'Akumulasi aset & tujuan besar jangka panjang',
      pct: { makan: 15, transportasi: 6, tagihan: 6, kos: 13, darurat: 8, investasi: 27, tabungan: 15, hiburan: 3, lifestyle: 4, lainnya: 3 }
    },
    classic: {
      name: 'Klasik 50/30/20',
      desc: '50% kebutuhan, 30% keinginan, 20% masa depan',
      pct: { makan: 18, transportasi: 8, tagihan: 9, kos: 15, darurat: 7, investasi: 8, tabungan: 5, hiburan: 12, lifestyle: 15, lainnya: 3 }
    }
  };

  var INSTRUMENTS = [
    { key: 'rdpu', name: 'Reksa Dana Pasar Uang', short: 'RDPU', ret: 4.5, risk: 1, color: '#5B9BF8',
      note: 'Sangat likuid & stabil. Ideal untuk dana darurat dan tujuan < 1 tahun.' },
    { key: 'deposito', name: 'Deposito', short: 'Deposito', ret: 4.0, risk: 1, color: '#94A3B8',
      note: 'Bunga tetap, dijamin LPS sesuai ketentuan. Dana terkunci sampai jatuh tempo.' },
    { key: 'obligasi', name: 'Obligasi / SBN', short: 'Obligasi', ret: 6.5, risk: 2, color: '#A78BFA',
      note: 'SBR, ORI, Sukuk ritel, atau reksa dana pendapatan tetap. Kupon rutin.' },
    { key: 'emas', name: 'Emas', short: 'Emas', ret: 7.5, risk: 3, color: '#E5B21C',
      note: 'Lindung nilai inflasi & pelemahan rupiah. Horizon menengah–panjang.' },
    { key: 'sahamId', name: 'Saham Indonesia', short: 'Saham ID', ret: 10, risk: 4, color: '#F06A6A',
      note: 'Blue-chip, indeks IDX30/LQ45, atau reksa dana indeks. Horizon ≥ 5 tahun.' },
    { key: 'sahamUs', name: 'ETF / Saham AS', short: 'ETF AS', ret: 10, risk: 4, color: '#2FC7A1',
      note: 'Diversifikasi global, mis. ETF S&P 500. Ada risiko kurs USD/IDR.' },
    { key: 'bitcoin', name: 'Bitcoin', short: 'Bitcoin', ret: 15, risk: 5, color: '#F7861B',
      note: 'Volatilitas sangat tinggi. Batasi di porsi kecil yang siap turun tajam.' }
  ];
  var INST_KEYS = INSTRUMENTS.map(function (i) { return i.key; });
  var INST = {};
  INSTRUMENTS.forEach(function (i) { INST[i.key] = i; });

  var RISK_PROFILES = {
    konservatif: { name: 'Konservatif', desc: 'Prioritas keamanan modal, fluktuasi minimal.',
      mix: { rdpu: 35, deposito: 25, obligasi: 20, emas: 15, sahamId: 5, sahamUs: 0, bitcoin: 0 }, invRatio: 0.4 },
    moderat: { name: 'Moderat', desc: 'Seimbang antara pertumbuhan dan stabilitas.',
      mix: { rdpu: 15, deposito: 10, obligasi: 15, emas: 15, sahamId: 20, sahamUs: 20, bitcoin: 5 }, invRatio: 0.55 },
    agresif: { name: 'Agresif', desc: 'Kejar pertumbuhan maksimal, siap naik-turun tajam.',
      mix: { rdpu: 5, deposito: 0, obligasi: 5, emas: 10, sahamId: 30, sahamUs: 35, bitcoin: 15 }, invRatio: 0.7 }
  };

  /* ---------- Utilitas dasar ---------- */

  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function pos(v) { return Math.max(0, num(v)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function sumKeys(obj, keys) { return keys.reduce(function (s, k) { return s + num(obj && obj[k]); }, 0); }

  /** Membagi `total` unit bulat sesuai bobot (largest remainder) — hasil selalu berjumlah tepat `total`. */
  function apportion(weights, keys, total) {
    var out = {};
    total = Math.max(0, Math.round(total));
    var w = {}, sum = 0;
    keys.forEach(function (k) { w[k] = pos(weights && weights[k]); sum += w[k]; });
    if (sum <= 0) { keys.forEach(function (k) { w[k] = 1; }); sum = keys.length; }
    var used = 0, rems = [];
    keys.forEach(function (k) {
      var raw = (w[k] / sum) * total;
      var f = Math.floor(raw + 1e-9);
      out[k] = f; used += f;
      rems.push({ k: k, r: raw - f, w: w[k] });
    });
    rems.sort(function (a, b) { return (b.r - a.r) || (b.w - a.w); });
    for (var i = 0; used < total; i++, used++) out[rems[i % rems.length].k]++;
    return out;
  }

  function toShares(pctObj, keys) { return apportion(pctObj, keys || CAT_KEYS, TOTAL); }

  function validShares(shares, keys) {
    if (!shares || typeof shares !== 'object') return false;
    var s = 0;
    for (var i = 0; i < keys.length; i++) {
      var v = shares[keys[i]];
      if (typeof v !== 'number' || !isFinite(v) || v < 0 || Math.round(v) !== v) return false;
      s += v;
    }
    return s === TOTAL;
  }

  /**
   * Ubah satu kategori lalu seimbangkan kategori lain (yang tidak dikunci)
   * secara proporsional sehingga total tetap 100%.
   */
  function setShare(shares, locks, key, value, keys, protectedKeys) {
    keys = keys || Object.keys(shares);
    locks = locks || {};
    var prot = {};
    (protectedKeys || []).forEach(function (k) { prot[k] = true; });
    var next = {};
    keys.forEach(function (k) { next[k] = shares[k] || 0; });
    var lockedSum = 0;
    keys.forEach(function (k) { if (k !== key && locks[k]) lockedSum += next[k]; });
    var free = keys.filter(function (k) { return k !== key && !locks[k]; });
    var max = TOTAL - lockedSum;
    var v = Math.round(clamp(num(value), 0, max));
    if (!free.length) v = max;
    var delta = v - next[key];
    next[key] = v;
    if (!delta) return next;
    // Kategori "dilindungi" (mis. kebutuhan pokok) baru disentuh setelah kategori fleksibel habis.
    var flex = free.filter(function (k) { return !prot[k]; });
    var guarded = free.filter(function (k) { return prot[k]; });
    function sumOf(list) { return list.reduce(function (s, k) { return s + next[k]; }, 0); }
    if (delta > 0) {
      var need = delta;
      [flex, guarded].forEach(function (list) {
        if (need <= 0 || !list.length) return;
        var take = Math.min(need, sumOf(list));
        if (take <= 0) return;
        var cut = apportion(next, list, take);
        list.forEach(function (k) { next[k] -= cut[k]; });
        need -= take;
      });
    } else {
      var target = flex.length ? flex : guarded;
      var w = {}, ws = 0;
      target.forEach(function (k) { w[k] = next[k]; ws += w[k]; });
      if (ws === 0) target.forEach(function (k) { w[k] = 1; });
      var add = apportion(w, target, -delta);
      target.forEach(function (k) { next[k] += add[k]; });
    }
    return next;
  }

  /** Nominal rupiah per kategori; jumlahnya selalu sama persis dengan pendapatan. */
  function toAmounts(income, shares, keys) {
    return apportion(shares, keys, Math.max(0, Math.round(num(income))));
  }

  function expensesTotal(p) {
    return EXPENSE_FIELDS.reduce(function (s, f) { return s + pos(p.expenses && p.expenses[f.key]); }, 0);
  }
  function monthlyIncome(p) { return p.incomeType === 'oneTime' ? pos(p.regularIncome) : pos(p.income); }
  function emergencyTarget(p) {
    if (pos(p.emergencyTargetCustom) > 0) return pos(p.emergencyTargetCustom);
    return Math.round((pos(p.emergencyMonths) || 6) * expensesTotal(p));
  }
  function emergencyRatio(p) {
    var t = emergencyTarget(p);
    return t > 0 ? Math.min(1, pos(p.emergencyCurrent) / t) : 1;
  }

  function shortGoalNeed(goals, oneTime) {
    return (goals || []).filter(function (g) { return (g.type || 'short') === 'short'; }).reduce(function (s, g) {
      var gap = Math.max(0, pos(g.target) - pos(g.current));
      return s + (oneTime ? gap : gap / Math.max(1, Math.round(pos(g.months)) || 1));
    }, 0);
  }

  /* ---------- Alokasi otomatis (Smart) ---------- */

  /**
   * Alokasi adaptif: kebutuhan pokok mengikuti pengeluaran aktual,
   * sisanya dibagi berdasarkan kondisi dana darurat, tujuan jangka pendek,
   * rasio beban hidup, dan profil risiko.
   */
  function smartAllocation(p, goals) {
    var inc = pos(p.income);
    if (!inc) return toShares(PRESETS.balanced.pct);
    var oneTime = p.incomeType === 'oneTime';
    var w = {};
    CAT_KEYS.forEach(function (k) { w[k] = 0; });
    var essTotal = 0;
    if (!oneTime) {
      EXPENSE_FIELDS.forEach(function (f) {
        var v = pos(p.expenses && p.expenses[f.key]);
        w[f.cat] += v; essTotal += v;
      });
    }
    // Defisit: seluruh pendapatan untuk kebutuhan pokok (proporsional)
    if (essTotal >= inc) return apportion(w, CAT_KEYS, TOTAL);

    var free = inc - essTotal;
    var essRatio = essTotal / inc;
    var emT = emergencyTarget(p);
    var emGap = Math.max(0, emT - pos(p.emergencyCurrent));
    var emR = emergencyRatio(p);

    var wantsShare = oneTime ? 0.08 : essRatio > 0.7 ? 0.10 : essRatio > 0.5 ? 0.18 : 0.24;
    if (emR < 0.25) wantsShare *= 0.7;
    var bufferShare = oneTime ? 0.02 : 0.04;
    var wants = free * wantsShare;
    var buffer = free * bufferShare;
    var core = free - wants - buffer;

    var emW = emR >= 1 ? 0 : emR < 0.25 ? 0.55 : emR < 0.5 ? 0.42 : emR < 0.75 ? 0.3 : 0.2;
    if (oneTime && emGap > 0) emW = Math.max(emW, 0.4);
    var em = Math.min(core * emW, emGap);
    var rest = core - em;
    var invRatio = (RISK_PROFILES[p.risk] || RISK_PROFILES.moderat).invRatio;
    var inv = rest * invRatio;
    var tab = rest - inv;

    var need = shortGoalNeed(goals, oneTime) * 1.01; // +1% ruang pembulatan
    if (need > tab) {
      var shift = Math.min(need - tab, inv * 0.5);
      tab += shift; inv -= shift;
    }

    // Anggaran kebutuhan pokok dibulatkan KE ATAS (ke 0,1%) agar selalu menutup pengeluaran aktual.
    var fixed = {}, fixedSum = 0;
    CAT_KEYS.forEach(function (k) {
      fixed[k] = w[k] > 0 ? Math.ceil(w[k] / inc * TOTAL - 1e-9) : 0;
      fixedSum += fixed[k];
    });
    var flex = { darurat: em, investasi: inv, tabungan: tab, hiburan: wants * 0.42, lifestyle: wants * 0.58, lainnya: buffer };
    if (fixedSum > TOTAL) {
      CAT_KEYS.forEach(function (k) { w[k] += flex[k] || 0; });
      return apportion(w, CAT_KEYS, TOTAL);
    }
    var flexKeys = Object.keys(flex);
    var dist = apportion(flex, flexKeys, TOTAL - fixedSum);
    var out = {};
    CAT_KEYS.forEach(function (k) { out[k] = fixed[k] + (dist[k] || 0); });
    return out;
  }

  /** Komposisi investasi otomatis berdasarkan profil risiko & kesiapan dana darurat. */
  function autoInvestMix(p) {
    var prof = RISK_PROFILES[p.risk] || RISK_PROFILES.moderat;
    var m = {};
    INST_KEYS.forEach(function (k) { m[k] = prof.mix[k] || 0; });
    if (emergencyRatio(p) < 0.5 && p.risk !== 'konservatif') {
      // Dana darurat belum kuat → geser sebagian aset berisiko ke instrumen likuid.
      var moved = m.bitcoin * 0.5 + (m.sahamId + m.sahamUs) * 0.15;
      m.bitcoin *= 0.5; m.sahamId *= 0.85; m.sahamUs *= 0.85;
      m.rdpu += moved;
    }
    return apportion(m, INST_KEYS, TOTAL);
  }

  /* ---------- Proyeksi ---------- */

  function project(start, monthly, annualPct, years) {
    var i = Math.pow(1 + annualPct / 100, 1 / 12) - 1;
    var v = pos(start), modal = pos(start);
    var out = [{ year: 0, value: Math.round(v), modal: Math.round(modal) }];
    for (var m = 1; m <= years * 12; m++) {
      v = v * (1 + i) + monthly;
      modal += monthly;
      if (m % 12 === 0) out.push({ year: m / 12, value: Math.round(v), modal: Math.round(modal) });
    }
    return out;
  }

  function monthsToTarget(start, monthly, annualPct, target) {
    if (start >= target) return 0;
    if (monthly <= 0 && (annualPct <= 0 || start <= 0)) return null;
    var i = Math.pow(1 + annualPct / 100, 1 / 12) - 1;
    var v = start;
    for (var m = 1; m <= 600; m++) {
      v = v * (1 + i) + monthly;
      if (v >= target) return m;
    }
    return null;
  }

  /* ---------- Analisis lengkap ---------- */

  function analyzeGoals(goals, amounts, oneTime) {
    var out = [];
    ['short', 'long'].forEach(function (type) {
      var list = (goals || []).filter(function (g) { return (g.type || 'short') === type; });
      var pool = type === 'short' ? amounts.tabungan : amounts.investasi;
      var reqs = list.map(function (g) {
        var gap = Math.max(0, pos(g.target) - pos(g.current));
        return oneTime ? gap : gap / Math.max(1, Math.round(pos(g.months)) || 1);
      });
      var rs = reqs.reduce(function (a, b) { return a + b; }, 0);
      list.forEach(function (g, i) {
        var target = pos(g.target), cur = pos(g.current);
        var gap = Math.max(0, target - cur);
        var months = Math.max(1, Math.round(pos(g.months)) || 1);
        var contrib = rs > 0 ? reqs[i] * Math.min(1, pool / rs) : 0;
        var eta = gap <= 0 ? 0 : contrib > 0
          ? (oneTime ? (contrib >= gap - 0.5 ? 0 : null) : Math.ceil(gap / contrib - 1e-9))
          : null;
        out.push({
          id: g.id, name: g.name || 'Tujuan', type: type, target: target, current: cur, gap: gap,
          months: months, required: reqs[i], contrib: contrib,
          progress: target > 0 ? Math.min(1, cur / target) : 0,
          progressAfter: target > 0 ? Math.min(1, (cur + (oneTime ? contrib : 0)) / target) : 0,
          eta: eta,
          onTrack: gap <= 0 || (eta !== null && eta <= months),
          coverage: reqs[i] > 0 ? Math.min(1, contrib / reqs[i]) : 1
        });
      });
    });
    return out;
  }

  function healthScore(x) {
    if (!x.income) return { score: 0, label: 'Belum ada data', level: 'none', components: [] };
    var comps = [];
    var sr = x.shares.darurat + x.shares.investasi + x.shares.tabungan;
    comps.push({ key: 'saving', name: 'Porsi tabung & investasi', max: 25,
      score: Math.min(1, (sr / TOTAL) / 0.3) * 25, hint: 'Ideal ≥ 30% pendapatan' });
    var s2 = x.expRatio === null ? 10 : x.expRatio <= 0.5 ? 20 : x.expRatio >= 1 ? 0 : 20 * (1 - (x.expRatio - 0.5) / 0.5);
    comps.push({ key: 'expense', name: 'Beban pengeluaran tetap', max: 20, score: s2, hint: 'Ideal ≤ 50% pendapatan' });
    comps.push({ key: 'emergency', name: 'Kesiapan dana darurat', max: 25, score: 25 * x.emRatio, hint: 'Terhadap target dana darurat' });
    var invP = x.invProgress === null ? 0.5 : x.invProgress;
    comps.push({ key: 'invest', name: 'Kebiasaan investasi', max: 15,
      score: Math.min(1, (x.shares.investasi / TOTAL) / 0.15) * 10 + invP * 5, hint: 'Porsi ≥ 15% + progres target' });
    var gt = x.goals.length ? x.goals.reduce(function (s, g) { return s + (g.onTrack ? 1 : g.coverage); }, 0) / x.goals.length : 0.6;
    comps.push({ key: 'goals', name: 'Tujuan keuangan', max: 15, score: 15 * gt, hint: 'Tujuan yang on-track' });
    var total = Math.round(comps.reduce(function (s, c) { return s + c.score; }, 0));
    if (x.expRatio !== null && x.expRatio > 1) total = Math.min(total, 30);
    var label, level;
    if (total >= 80) { label = 'Sangat Sehat'; level = 'great'; }
    else if (total >= 65) { label = 'Sehat'; level = 'good'; }
    else if (total >= 45) { label = 'Cukup'; level = 'fair'; }
    else if (total >= 25) { label = 'Perlu Perhatian'; level = 'warn'; }
    else { label = 'Kritis'; level = 'bad'; }
    return { score: total, label: label, level: level, components: comps };
  }

  function pickFocus(x, rp) {
    if (!x.income) return { key: 'data', level: 'info', title: 'Lengkapi data keuanganmu',
      text: 'Masukkan pendapatan dan pengeluaran tetap agar rekomendasi bisa dihitung.' };
    if (x.mIncome > 0 && x.expTotal > x.mIncome) return { key: 'pengeluaran', level: 'bad', title: 'Fokus: Pangkas Pengeluaran',
      text: 'Pengeluaran tetap ' + rp(x.expTotal) + ' melebihi pendapatan bulanan ' + rp(x.mIncome) +
        '. Kurangi biaya tetap atau tambah penghasilan sebelum menabung dan berinvestasi.' };
    if (x.emRatio < 0.5) return { key: 'darurat', level: 'warn', title: 'Fokus: Dana Darurat',
      text: 'Dana darurat baru ' + Math.round(x.emRatio * 100) + '% dari target ' + rp(x.emTarget) +
        '. Isi dulu bantalan ini sebelum memperbesar investasi berisiko — simpan di RDPU atau tabungan terpisah.' };
    var offTrack = x.goals.filter(function (g) { return g.type === 'short' && !g.onTrack; });
    if (offTrack.length) return { key: 'tabungan', level: 'warn', title: 'Fokus: Tabungan Tujuan',
      text: offTrack.length + ' tujuan jangka pendek belum on-track. Naikkan porsi tabungan atau perpanjang tenggat waktunya.' };
    if (x.expRatio !== null && x.expRatio > 0.7) return { key: 'pengeluaran', level: 'warn', title: 'Fokus: Efisiensi Pengeluaran',
      text: 'Pengeluaran tetap memakan ' + Math.round(x.expRatio * 100) + '% pendapatan. Menekannya ke ≤ 50% akan membuka ruang besar untuk investasi.' };
    if (x.emRatio < 1) return { key: 'darurat', level: 'info', title: 'Fokus: Lengkapi Dana Darurat + Mulai Investasi',
      text: 'Dana darurat sudah ' + Math.round(x.emRatio * 100) + '% — lanjutkan sampai penuh sambil berinvestasi rutin secara bertahap.' };
    return { key: 'investasi', level: 'good', title: 'Fokus: Investasi & Pertumbuhan Aset',
      text: 'Fondasi keuanganmu kuat. Saatnya mengoptimalkan investasi rutin sesuai profil risiko untuk tujuan jangka panjang.' };
  }

  function buildPriorities(x) {
    var a = x.amounts, s = x.shares;
    var items = {
      needs: { key: 'needs', title: 'Penuhi kebutuhan pokok', amount: a.makan + a.transportasi + a.tagihan + a.kos,
        share: s.makan + s.transportasi + s.tagihan + s.kos, note: 'Makan, transportasi, tagihan, dan tempat tinggal dibayar di awal.' },
      darurat: { key: 'darurat', title: 'Sisihkan dana darurat', amount: a.darurat, share: s.darurat,
        note: x.emGap > 0 ? 'Kurang ' + x.rp(x.emGap) + ' menuju target. Simpan di rekening terpisah / RDPU.' : 'Target sudah tercapai — cukup pertahankan.' },
      tabungan: { key: 'tabungan', title: 'Isi tabungan tujuan', amount: a.tabungan, share: s.tabungan,
        note: 'Untuk tujuan jangka pendek & pengeluaran besar terencana.' },
      investasi: { key: 'investasi', title: 'Investasi rutin', amount: a.investasi, share: s.investasi,
        note: 'Auto-debit di awal bulan agar konsisten (pay yourself first).' },
      wants: { key: 'wants', title: 'Hiburan & lifestyle', amount: a.hiburan + a.lifestyle, share: s.hiburan + s.lifestyle,
        note: 'Nikmati tanpa rasa bersalah — selama di dalam batas ini.' },
      lainnya: { key: 'lainnya', title: 'Lainnya & buffer', amount: a.lainnya, share: s.lainnya,
        note: 'Cicilan, keluarga, sedekah, atau cadangan tak terduga.' }
    };
    var order;
    if (x.focus.key === 'investasi') order = ['needs', 'investasi', 'tabungan', 'darurat', 'lainnya', 'wants'];
    else if (x.focus.key === 'tabungan') order = ['needs', 'tabungan', 'darurat', 'investasi', 'lainnya', 'wants'];
    else order = ['needs', 'darurat', 'tabungan', 'investasi', 'lainnya', 'wants'];
    return order.map(function (k) { return items[k]; }).filter(function (it) { return it.share > 0 || it.key === 'needs'; });
  }

  function buildInsights(x, f) {
    var out = [];
    if (!x.income) {
      out.push({ type: 'info', text: 'Masukkan pendapatan di menu Data Keuangan untuk mulai menghitung alokasi.' });
      return out;
    }
    x.budgetIssues.forEach(function (b) {
      out.push({ type: 'warn', text: 'Anggaran ' + b.name + ' (' + f.rp(b.budget) + ') lebih kecil dari pengeluaran aktual ' +
        f.rp(b.actual) + '. Naikkan persentasenya ±' + f.pct(Math.ceil(b.gap / x.income * TOTAL)) + ' atau pangkas pengeluaran.' });
    });
    var wantsShare = x.shares.hiburan + x.shares.lifestyle;
    if (wantsShare > 300) out.push({ type: 'warn', text: 'Porsi hiburan & lifestyle ' + f.pct(wantsShare) + ' — di atas batas sehat 30%.' });
    var fut = x.shares.darurat + x.shares.investasi + x.shares.tabungan;
    if (fut < 100) out.push({ type: 'warn', text: 'Kurang dari 10% pendapatan dialokasikan untuk masa depan. Usahakan minimal 20%.' });
    else if (fut >= 250) out.push({ type: 'ok', text: 'Mantap! ' + f.pct(fut) + ' pendapatan dialokasikan untuk dana darurat, tabungan, dan investasi.' });
    if (x.expRatio !== null && x.expRatio > 0.5 && x.expRatio <= 1)
      out.push({ type: 'info', text: 'Pengeluaran tetap memakan ' + Math.round(x.expRatio * 100) + '% pendapatan bulanan. Idealnya ≤ 50%.' });
    if (x.expTotal === 0 && x.incomeType === 'monthly')
      out.push({ type: 'info', text: 'Isi pengeluaran tetap agar target dana darurat dan anggaran kebutuhan pokok bisa dihitung akurat.' });
    if (x.emGap <= 0 && x.emTarget > 0) {
      if (x.amounts.darurat > 0) out.push({ type: 'info', text: 'Dana darurat sudah penuh, tapi masih ada alokasi ' + f.rp(x.amounts.darurat) + ' ke sana. Pertimbangkan alihkan ke investasi.' });
      else out.push({ type: 'ok', text: 'Dana darurat sudah penuh (' + (x.emMonths !== null ? f.dec(x.emMonths) + ' bulan pengeluaran' : 'sesuai target') + ').' });
    } else if (x.emETA !== null && x.emETA > 0) {
      out.push({ type: 'info', text: 'Dengan alokasi sekarang, dana darurat penuh dalam ' + f.months(x.emETA) + '.' });
    } else if (x.emGap > 0 && x.amounts.darurat === 0) {
      out.push({ type: 'warn', text: 'Dana darurat belum penuh tetapi tidak ada alokasi ke dana darurat.' });
    }
    if (x.emRatio < 0.25 && x.shares.investasi > 150)
      out.push({ type: 'warn', text: 'Dana darurat masih sangat minim sementara porsi investasi besar. Dahulukan dana darurat agar tidak terpaksa menjual investasi saat rugi.' });
    if (x.risk === 'konservatif' && x.invShares.bitcoin > 100)
      out.push({ type: 'warn', text: 'Porsi Bitcoin ' + f.pct(x.invShares.bitcoin) + ' terlalu besar untuk profil konservatif.' });
    if (x.amounts.investasi > 0 && x.amounts.investasi < 100000)
      out.push({ type: 'info', text: 'Nominal investasi masih kecil — mulai dari reksa dana (RDPU/indeks) yang bisa dibeli mulai Rp 10 ribu.' });
    x.goals.forEach(function (g) {
      if (g.onTrack || g.gap <= 0) return;
      if (x.incomeType === 'oneTime') {
        out.push({ type: 'warn', text: 'Tujuan "' + g.name + '" masih kurang ' + f.rp(g.gap - g.contrib) + ' setelah alokasi ini.' });
      } else {
        out.push({ type: 'warn', text: 'Tujuan "' + g.name + '" butuh ' + f.rp(g.required) + '/bulan, teralokasi ' + f.rp(g.contrib) +
          '. Estimasi ' + (g.eta ? f.months(g.eta) : 'belum dapat dihitung') + ' (target ' + f.months(g.months) + ').' });
      }
    });
    if (!out.length) out.push({ type: 'ok', text: 'Alokasi sudah seimbang. Pertahankan konsistensinya setiap bulan.' });
    return out;
  }

  /**
   * @param {object} state
   * @param {object} f formatter {rp, pct, months, dec}
   */
  function analyze(state, f) {
    f = f || {
      rp: function (n) { return 'Rp ' + Math.round(n); },
      pct: function (t) { return (t / 10) + '%'; },
      months: function (m) { return m + ' bulan'; },
      dec: function (n) { return n.toFixed(1); }
    };
    var p = state.profile, goals = state.goals || [];
    var oneTime = p.incomeType === 'oneTime';
    var income = Math.round(pos(p.income));
    var shares = state.allocation.shares;
    var amounts = toAmounts(income, shares, CAT_KEYS);
    var mIncome = monthlyIncome(p);
    var expTotal = expensesTotal(p);

    var groups = {};
    Object.keys(GROUPS).forEach(function (g) { groups[g] = { share: 0, amount: 0 }; });
    CATEGORIES.forEach(function (c) { groups[c.group].share += shares[c.key]; groups[c.group].amount += amounts[c.key]; });

    var budgetIssues = [];
    if (!oneTime && income > 0) {
      EXPENSE_FIELDS.forEach(function (fd) {
        var actual = pos(p.expenses && p.expenses[fd.key]);
        var b = amounts[fd.cat];
        if (actual > b + 0.5) budgetIssues.push({ key: fd.cat, name: CAT[fd.cat].name, actual: actual, budget: b, gap: actual - b });
      });
    }

    var emTarget = emergencyTarget(p), emCurrent = pos(p.emergencyCurrent);
    var emGap = Math.max(0, emTarget - emCurrent);
    var emRatio = emergencyRatio(p);
    var emMonths = expTotal > 0 ? emCurrent / expTotal : null;
    var emETA = emGap <= 0 ? 0 : amounts.darurat > 0
      ? (oneTime ? (amounts.darurat >= emGap ? 0 : null) : Math.ceil(emGap / amounts.darurat))
      : null;

    var invShares = state.investMix.shares;
    var invAmounts = toAmounts(amounts.investasi, invShares, INST_KEYS);
    var expReturn = 0, riskScore = 0;
    INSTRUMENTS.forEach(function (i) {
      expReturn += invShares[i.key] / TOTAL * i.ret;
      riskScore += invShares[i.key] / TOTAL * i.risk;
    });
    var invCurrent = pos(p.investCurrent), invTarget = pos(p.investTarget);
    var invProgress = invTarget > 0 ? Math.min(1, invCurrent / invTarget) : null;
    var monthlyInvest = oneTime ? 0 : amounts.investasi;
    var invStart = invCurrent + (oneTime ? amounts.investasi : 0);
    var invETA = invTarget > 0 ? monthsToTarget(invStart, monthlyInvest, expReturn, invTarget) : null;

    var goalsRes = analyzeGoals(goals, amounts, oneTime);

    var x = {
      income: income, incomeType: p.incomeType, mIncome: mIncome, oneTime: oneTime,
      shares: shares, amounts: amounts, groups: groups,
      expTotal: expTotal, expRatio: mIncome > 0 ? expTotal / mIncome : null,
      leftover: oneTime ? income : income - expTotal,
      futureAmount: amounts.darurat + amounts.investasi + amounts.tabungan,
      futureShare: shares.darurat + shares.investasi + shares.tabungan,
      lifestyleAmount: amounts.hiburan + amounts.lifestyle,
      lifestyleShare: shares.hiburan + shares.lifestyle,
      budgetIssues: budgetIssues,
      emTarget: emTarget, emCurrent: emCurrent, emGap: emGap, emRatio: emRatio, emMonths: emMonths, emETA: emETA,
      emAfter: emCurrent + (oneTime ? amounts.darurat : 0),
      invShares: invShares, invAmounts: invAmounts, expReturn: expReturn, riskScore: riskScore,
      invCurrent: invCurrent, invTarget: invTarget, invProgress: invProgress, invETA: invETA,
      monthlyInvest: monthlyInvest, invStart: invStart,
      savingsCurrent: pos(p.savingsCurrent),
      goals: goalsRes, risk: p.risk, rp: f.rp
    };
    x.health = healthScore(x);
    x.focus = pickFocus(x, f.rp);
    x.priorities = buildPriorities(x);
    x.insights = buildInsights(x, f);
    x.totalAllocated = CAT_KEYS.reduce(function (s, k) { return s + amounts[k]; }, 0);
    x.totalShare = sumKeys(shares, CAT_KEYS);
    return x;
  }

  /* ---------- Simulasi ---------- */

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function simulate(state, sim, f) {
    var s = clone(state);
    var fi = 1 + num(sim.incomeChange) / 100, fe = 1 + num(sim.expenseChange) / 100;
    s.profile.income = Math.round(pos(s.profile.income) * fi);
    s.profile.regularIncome = Math.round(pos(s.profile.regularIncome) * fi);
    EXPENSE_FIELDS.forEach(function (fd) { s.profile.expenses[fd.key] = Math.round(pos(s.profile.expenses[fd.key]) * fe); });
    if (sim.autoRealloc || s.allocation.mode === 'smart') s.allocation.shares = smartAllocation(s.profile, s.goals);
    if (sim.investOverride) {
      s.allocation.shares = setShare(s.allocation.shares, sim.autoRealloc ? {} : s.allocation.locks, 'investasi', Math.round(num(sim.investPct) * 10), CAT_KEYS, PROTECTED_CATS);
    }
    if (s.investMix.mode === 'auto') s.investMix.shares = autoInvestMix(s.profile);
    return { state: s, result: analyze(s, f) };
  }

  /* ---------- State default & sanitasi ---------- */

  function defaultState() {
    return {
      version: 1,
      theme: 'auto',
      meta: { demo: true, locked: false },
      profile: {
        incomeType: 'monthly', income: 8500000, regularIncome: 0,
        expenses: { kos: 1500000, makan: 1800000, transportasi: 500000, tagihan: 450000, lainnya: 300000 },
        emergencyCurrent: 15000000, emergencyMonths: 6, emergencyTargetCustom: 0,
        savingsCurrent: 4000000, investCurrent: 7500000, investTarget: 250000000,
        risk: 'moderat'
      },
      goals: [
        { id: 'g1', name: 'Laptop kerja baru', type: 'short', target: 15000000, current: 3000000, months: 10 },
        { id: 'g2', name: 'DP rumah', type: 'long', target: 120000000, current: 10000000, months: 60 }
      ],
      allocation: { mode: 'smart', preset: 'smart', shares: null, locks: {} },
      investMix: { mode: 'auto', shares: null, locks: {} },
      sim: { incomeChange: 0, expenseChange: 0, autoRealloc: true, investOverride: false, investPct: 20 },
      ui: { projYears: 10 }
    };
  }

  function emptyState() {
    var s = defaultState();
    s.meta.demo = false;
    var p = s.profile;
    p.income = 0; p.regularIncome = 0;
    Object.keys(p.expenses).forEach(function (k) { p.expenses[k] = 0; });
    p.emergencyCurrent = 0; p.emergencyTargetCustom = 0; p.savingsCurrent = 0; p.investCurrent = 0; p.investTarget = 0;
    s.goals = [];
    return finalize(s);
  }

  function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
  function merge(def, raw) {
    if (!isObj(def)) {
      if (Array.isArray(def)) return Array.isArray(raw) ? raw : def;
      if (def === null) return raw === undefined ? null : raw;
      return typeof raw === typeof def ? raw : def;
    }
    var out = {};
    Object.keys(def).forEach(function (k) { out[k] = isObj(raw) && k in raw ? merge(def[k], raw[k]) : def[k]; });
    if (isObj(raw)) Object.keys(raw).forEach(function (k) { if (!(k in out)) out[k] = raw[k]; });
    return out;
  }

  function finalize(s) {
    if (['monthly', 'oneTime'].indexOf(s.profile.incomeType) < 0) s.profile.incomeType = 'monthly';
    if (!RISK_PROFILES[s.profile.risk]) s.profile.risk = 'moderat';
    if (['smart', 'preset', 'custom'].indexOf(s.allocation.mode) < 0) s.allocation.mode = 'smart';
    if (['auto', 'manual'].indexOf(s.investMix.mode) < 0) s.investMix.mode = 'auto';
    if (!validShares(s.allocation.shares, CAT_KEYS)) {
      if (s.allocation.mode === 'preset' && PRESETS[s.allocation.preset]) s.allocation.shares = toShares(PRESETS[s.allocation.preset].pct);
      else { s.allocation.mode = 'smart'; s.allocation.preset = 'smart'; s.allocation.shares = smartAllocation(s.profile, s.goals); }
    }
    if (!validShares(s.investMix.shares, INST_KEYS)) { s.investMix.mode = 'auto'; s.investMix.shares = autoInvestMix(s.profile); }
    if (!isObj(s.allocation.locks)) s.allocation.locks = {};
    if (!isObj(s.investMix.locks)) s.investMix.locks = {};
    return s;
  }

  function sanitize(raw) {
    var d = defaultState();
    if (!isObj(raw)) return finalize(d);
    var s = merge(d, raw);
    var p = s.profile;
    ['income', 'regularIncome', 'emergencyCurrent', 'emergencyMonths', 'emergencyTargetCustom', 'savingsCurrent', 'investCurrent', 'investTarget']
      .forEach(function (k) { p[k] = Math.round(pos(p[k])); });
    if (!p.emergencyMonths) p.emergencyMonths = 6;
    EXPENSE_FIELDS.forEach(function (fd) { p.expenses[fd.key] = Math.round(pos(p.expenses[fd.key])); });
    s.goals = (Array.isArray(s.goals) ? s.goals : []).filter(isObj).map(function (g, i) {
      return {
        id: String(g.id || 'g' + Date.now() + i), name: String(g.name || 'Tujuan'),
        type: g.type === 'long' ? 'long' : 'short',
        target: Math.round(pos(g.target)), current: Math.round(pos(g.current)),
        months: Math.max(1, Math.round(pos(g.months)) || 12)
      };
    });
    return finalize(s);
  }

  var Engine = {
    TOTAL: TOTAL, CATEGORIES: CATEGORIES, CAT_KEYS: CAT_KEYS, CAT: CAT, PROTECTED_CATS: PROTECTED_CATS, GROUPS: GROUPS,
    EXPENSE_FIELDS: EXPENSE_FIELDS, PRESETS: PRESETS, INSTRUMENTS: INSTRUMENTS, INST_KEYS: INST_KEYS, INST: INST,
    RISK_PROFILES: RISK_PROFILES,
    apportion: apportion, toShares: toShares, validShares: validShares, setShare: setShare, toAmounts: toAmounts,
    expensesTotal: expensesTotal, monthlyIncome: monthlyIncome, emergencyTarget: emergencyTarget,
    smartAllocation: smartAllocation, autoInvestMix: autoInvestMix,
    project: project, monthsToTarget: monthsToTarget,
    analyze: analyze, simulate: simulate,
    defaultState: defaultState, emptyState: emptyState, sanitize: sanitize, clone: clone
  };

  root.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : this);
