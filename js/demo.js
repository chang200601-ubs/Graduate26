// 藥你管|互動示範(資料只存在瀏覽器的 localStorage,沒有後端)
(function () {
  'use strict';

  var KEY = 'yaonigan_demo_v1';
  var SPECIES = [
    { n: '兔子', e: '🐰', u: 'g' },
    { n: '天竺鼠', e: '🐹', u: 'g' },
    { n: '倉鼠', e: '🐹', u: 'g' },
    { n: '龍貓', e: '🐭', u: 'g' },
    { n: '鳥類', e: '🦜', u: 'g' },
    { n: '爬蟲類(鬃獅蜥、守宮等)', e: '🦎', u: 'g' },
    { n: '烏龜・陸龜', e: '🐢', u: 'g' },
    { n: '雪貂', e: '🦦', u: 'g' },
    { n: '刺蝟', e: '🦔', u: 'g' },
    { n: '貓', e: '🐱', u: 'kg' },
    { n: '狗', e: '🐶', u: 'kg' },
    { n: '其他', e: '🐾', u: 'g' }
  ];
  var DEFAULT_TIMES = {
    1: ['08:00'],
    2: ['08:00', '20:00'],
    3: ['08:00', '14:00', '20:00'],
    4: ['07:00', '12:00', '17:00', '22:00']
  };
  var METRIC = { weight: '體重', temp: '體溫' };

  var state = load();
  var chartMetric = 'weight';

  /* ---------- 工具函式 ---------- */
  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ds(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return ds(new Date()); }
  function nowHM() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function addDays(str, n) {
    var p = str.split('-');
    return ds(new Date(+p[0], +p[1] - 1, +p[2] + n));
  }
  function dateNum(str) {
    var p = str.split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }
  function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function blank() { return { pets: [], meds: [], doses: {}, records: [], current: null }; }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.pets) return s;
    } catch (e) { /* 無痕模式等情況:改用記憶體暫存 */ }
    return blank();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 忽略 */ }
  }
  function speciesInfo(name) {
    for (var i = 0; i < SPECIES.length; i++) if (SPECIES[i].n === name) return SPECIES[i];
    return SPECIES[SPECIES.length - 1];
  }
  function curPet() {
    for (var i = 0; i < state.pets.length; i++) if (state.pets[i].id === state.current) return state.pets[i];
    return null;
  }
  function ageText(b) {
    if (!b) return '未填';
    var p = b.split('-'), now = new Date();
    var months = (now.getFullYear() - +p[0]) * 12 + (now.getMonth() + 1 - +p[1]);
    if (now.getDate() < +p[2]) months--;
    if (months < 0) return '未填';
    var y = Math.floor(months / 12), m = months % 12;
    return (y ? y + ' 歲 ' : '') + m + ' 個月';
  }
  function fmtVal(key, v, pet) {
    if (v == null) return '—';
    if (key === 'temp') return v.toFixed(1) + ' °C';
    return (pet.unit === 'kg' ? (Math.round(v * 100) / 100) : Math.round(v * 10) / 10) + ' ' + pet.unit;
  }
  function activeMeds(petId, d) {
    return state.meds.filter(function (m) {
      return m.petId === petId && m.start <= d && (!m.end || m.end >= d);
    });
  }
  function petMeds(petId) {
    return state.meds.filter(function (m) { return m.petId === petId; })
      .sort(function (a, b) { return a.start < b.start ? 1 : -1; });
  }
  function petRecords(petId) {
    return state.records.filter(function (r) { return r.petId === petId; });
  }
  function adherence(m) {
    var t = today(), hm = nowHM(), done = 0, total = 0;
    for (var i = 0; i < 7; i++) {
      var d = addDays(t, -i);
      if (d < m.start || (m.end && d > m.end)) continue;
      m.times.forEach(function (tm) {
        if (i === 0 && tm > hm) return;
        total++;
        if (state.doses[m.id + '|' + d + '|' + tm]) done++;
      });
    }
    return { done: done, total: total };
  }
  function sortedAsc(list) {
    return list.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  /* ---------- 繪製:寵物列與基本資訊 ---------- */
  function renderPets() {
    var html = '';
    state.pets.forEach(function (p) {
      html += '<button type="button" class="chip' + (p.id === state.current ? ' active' : '') +
        '" data-pet="' + p.id + '">' + speciesInfo(p.species).e + ' ' + esc(p.name) + '</button>';
    });
    html += '<button type="button" class="chip add" id="addPetBtn">＋ 新增寵物</button>';
    $('petBar').innerHTML = html;

    var has = state.pets.length > 0;
    $('empty').hidden = has;
    $('app').hidden = !has;
    if (!has) return;

    var pet = curPet();
    $('petInfo').innerHTML =
      '<div class="who"><span class="face">' + speciesInfo(pet.species).e + '</span><div><b>' + esc(pet.name) +
      '</b><small>' + esc(pet.species) + '・年齡 ' + ageText(pet.birthday) + '・體重單位 ' + pet.unit + '</small></div></div>' +
      '<button type="button" class="link-btn" id="delPetBtn">刪除這隻寵物</button>';
    $('wLabel').textContent = '體重(' + pet.unit + ')';
    $('petQuestion').value = pet.question || '';
  }

  /* ---------- 繪製:今日用藥 ---------- */
  function renderToday() {
    var pet = curPet(); if (!pet) return;
    var t = today(), hm = nowHM(), items = [];
    activeMeds(pet.id, t).forEach(function (m) {
      m.times.forEach(function (tm) {
        items.push({ m: m, time: tm, key: m.id + '|' + t + '|' + tm });
      });
    });
    items.sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; });

    var done = items.filter(function (i) { return state.doses[i.key]; }).length;
    var total = items.length;
    $('todayLabel').textContent = total ? '今日進度:' + done + ' / ' + total + ' 次已完成' : '';
    $('todayBar').style.width = (total ? Math.round(done / total * 100) : 0) + '%';

    if (!total) {
      $('todayList').innerHTML = '<li class="empty-tip" style="display:block">今天沒有排定的用藥,可以到「用藥排程」新增。</li>';
      return;
    }
    $('todayList').innerHTML = items.map(function (i) {
      var ok = !!state.doses[i.key];
      var pill = ok ? '<span class="pill">已完成</span>'
        : (i.time < hm ? '<span class="pill warn">已超過時間</span>' : '<span class="pill warn">待餵藥</span>');
      return '<li class="' + (ok ? 'done' : '') + '"><input type="checkbox" data-key="' + esc(i.key) + '"' + (ok ? ' checked' : '') +
        ' aria-label="標示已餵藥"><span class="t">' + i.time + '</span><span class="m">' + esc(i.m.name) +
        '<small>' + esc(i.m.dose || '') + (i.m.note ? '・' + esc(i.m.note) : '') + '</small></span>' + pill + '</li>';
    }).join('');
  }

  /* ---------- 繪製:用藥排程 ---------- */
  function renderMeds() {
    var pet = curPet(); if (!pet) return;
    var list = petMeds(pet.id), t = today();
    if (!list.length) {
      $('medList').innerHTML = '<li class="empty-tip" style="display:block">還沒有用藥紀錄。</li>';
      return;
    }
    $('medList').innerHTML = list.map(function (m) {
      var ended = m.end && m.end < t, ad = adherence(m);
      return '<li><div class="info"><b>' + esc(m.name) + '</b>' +
        '<small>' + esc(m.dose || '未填劑量') + '・每日 ' + m.times.length + ' 次(' + m.times.join('、') + ')</small>' +
        '<small>' + m.start + ' ~ ' + (m.end || '持續中') + (m.note ? '・' + esc(m.note) : '') + '</small>' +
        '<div class="pills">' + (ended ? '<span class="pill">已結束</span>' : '<span class="pill">使用中</span>') +
        (ad.total ? '<span class="pill' + (ad.done < ad.total ? ' warn' : '') + '">近 7 日完成 ' + ad.done + '/' + ad.total + '</span>' : '') +
        '</div></div><button type="button" class="link-btn" data-del-med="' + m.id + '">刪除</button></li>';
    }).join('');
  }

  function buildTimeInputs(n, values) {
    var vals = values || DEFAULT_TIMES[n] || DEFAULT_TIMES[1], html = '';
    for (var i = 0; i < n; i++) {
      html += '<input type="time" required value="' + (vals[i] || '08:00') + '" aria-label="第 ' + (i + 1) + ' 次餵藥時間">';
    }
    $('medTimes').innerHTML = html;
  }

  /* ---------- 繪製:健康紀錄 ---------- */
  function renderRecords() {
    var pet = curPet(); if (!pet) return;
    drawChart(pet);

    var asc = sortedAsc(petRecords(pet.id)), prevW = null, deltaMap = {};
    asc.forEach(function (r) {
      if (r.weight != null) {
        if (prevW != null && prevW > 0) deltaMap[r.id] = (r.weight - prevW) / prevW * 100;
        prevW = r.weight;
      }
    });
    var rows = asc.slice().reverse();
    var head = '<tr><th>日期</th><th>體重</th><th>體溫</th><th>食慾</th><th>活動力</th><th>排便</th><th>備註</th><th></th></tr>';
    if (!rows.length) {
      $('recTable').innerHTML = head + '<tr><td colspan="8" class="empty-tip">還沒有紀錄。</td></tr>';
      return;
    }
    $('recTable').innerHTML = head + rows.map(function (r) {
      var d = deltaMap[r.id], dHtml = '';
      if (d != null) {
        dHtml = '<span class="delta' + (d <= -5 ? ' down' : '') + '">' + (d > 0 ? '↑' : d < 0 ? '↓' : '＝') + Math.abs(d).toFixed(1) + '%</span>';
      }
      return '<tr><td>' + r.date + '</td><td>' + fmtVal('weight', r.weight, pet) + dHtml + '</td><td>' +
        fmtVal('temp', r.temp, pet) + '</td><td>' + esc(r.appetite || '—') + '</td><td>' + esc(r.activity || '—') +
        '</td><td>' + esc(r.stool || '—') + '</td><td>' + esc(r.note || '') +
        '</td><td><button type="button" class="link-btn" data-del-rec="' + r.id + '">刪除</button></td></tr>';
    }).join('');
  }

  function drawChart(pet) {
    var key = chartMetric, label = METRIC[key];
    var pts = sortedAsc(petRecords(pet.id).filter(function (r) { return r[key] != null; }));
    var box = $('chart');
    if (pts.length < 2) {
      box.innerHTML = '<p class="empty-tip">至少需要 2 筆「' + label + '」紀錄才會畫出趨勢圖。</p>';
      return;
    }
    var W = 640, H = 240, L = 58, R = 20, T = 20, B = 36;
    var vals = pts.map(function (p) { return p[key]; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) { min -= 1; max += 1; }
    var padv = (max - min) * 0.15; min -= padv; max += padv;
    var t0 = dateNum(pts[0].date), t1 = dateNum(pts[pts.length - 1].date), span = (t1 - t0) || 1;
    function X(p) { return L + (dateNum(p.date) - t0) / span * (W - L - R); }
    function Y(v) { return T + (1 - (v - min) / (max - min)) * (H - T - B); }

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + label + '趨勢圖">';
    [0, 0.5, 1].forEach(function (f) {
      var v = min + (max - min) * f, y = Y(v);
      svg += '<line class="grid-line" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text class="axis-text" x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + fmtAxis(key, v, pet) + '</text>';
    });
    svg += '<polyline class="line" points="' + pts.map(function (p) { return X(p).toFixed(1) + ',' + Y(p[key]).toFixed(1); }).join(' ') + '"/>';
    pts.forEach(function (p, i) {
      svg += '<circle class="dot' + (i === pts.length - 1 ? ' last' : '') + '" cx="' + X(p).toFixed(1) + '" cy="' + Y(p[key]).toFixed(1) +
        '" r="5"><title>' + p.date + ':' + fmtVal(key, p[key], pet) + '</title></circle>';
    });
    svg += '<text class="axis-text" x="' + L + '" y="' + (H - 10) + '">' + pts[0].date + '</text>' +
      '<text class="axis-text" x="' + (W - R) + '" y="' + (H - 10) + '" text-anchor="end">' + pts[pts.length - 1].date + '</text></svg>';
    box.innerHTML = svg;
  }
  function fmtAxis(key, v, pet) {
    if (key === 'temp') return v.toFixed(1);
    return pet.unit === 'kg' ? v.toFixed(2) : String(Math.round(v));
  }

  /* ---------- 繪製:看診摘要 ---------- */
  function renderSummary() {
    var pet = curPet(); if (!pet) return;
    var L = [], t = today();
    L.push('【藥你管・看診摘要(示範)】');
    L.push('產生日期:' + t);
    L.push('');
    L.push('寵物:' + pet.name + '(' + pet.species + ')');
    L.push('生日 / 年齡:' + (pet.birthday || '未填') + ' / ' + ageText(pet.birthday));

    var recs = sortedAsc(petRecords(pet.id));
    var ws = recs.filter(function (r) { return r.weight != null; });
    var ts = recs.filter(function (r) { return r.temp != null; });
    L.push('');
    if (ws.length) {
      var lw = ws[ws.length - 1], line = '最新體重:' + fmtVal('weight', lw.weight, pet) + '(' + lw.date + ')';
      if (ws.length > 1) {
        var pw = ws[ws.length - 2], dp = (lw.weight - pw.weight) / pw.weight * 100;
        line += ',較上次(' + pw.date + ')' + (dp > 0 ? '增加 ' : dp < 0 ? '減少 ' : '持平 ') + (dp === 0 ? '' : Math.abs(dp).toFixed(1) + '%');
      }
      L.push(line);
    } else { L.push('最新體重:尚無紀錄'); }
    if (ts.length) {
      var lt = ts[ts.length - 1];
      L.push('最新體溫:' + fmtVal('temp', lt.temp, pet) + '(' + lt.date + ')');
    }

    L.push('');
    L.push('使用中藥物:');
    var act = activeMeds(pet.id, t);
    if (!act.length) L.push('  (目前無排定中的藥物)');
    act.forEach(function (m) {
      var ad = adherence(m);
      L.push('  ‧ ' + m.name + (m.dose ? ' ' + m.dose : '') + ',每日 ' + m.times.length + ' 次(' + m.times.join('、') + ')');
      L.push('    期間:' + m.start + ' ~ ' + (m.end || '持續中') + (m.note ? '|備註:' + m.note : ''));
      if (ad.total) L.push('    近 7 日給藥紀錄:完成 ' + ad.done + ' / ' + ad.total + ' 次');
    });

    L.push('');
    L.push('近期紀錄(最近 5 筆):');
    var last = recs.slice(-5).reverse();
    if (!last.length) L.push('  (尚無紀錄)');
    last.forEach(function (r) {
      var parts = [];
      if (r.weight != null) parts.push('體重 ' + fmtVal('weight', r.weight, pet));
      if (r.temp != null) parts.push('體溫 ' + fmtVal('temp', r.temp, pet));
      if (r.appetite) parts.push('食慾' + r.appetite);
      if (r.activity) parts.push('活動力' + r.activity);
      if (r.stool) parts.push('排便' + r.stool);
      if (r.note) parts.push('備註:' + r.note);
      L.push('  ‧ ' + r.date + '|' + (parts.join(',') || '—'));
    });

    if (pet.question) { L.push(''); L.push('這次想請教獸醫:'); L.push('  ' + pet.question); }
    L.push('');
    L.push('※ 本摘要由飼主自行記錄整理,僅供看診參考,不構成醫療建議。');
    $('summaryOut').textContent = L.join('\n');
  }

  function renderAll() {
    renderPets();
    if (!curPet()) return;
    renderToday(); renderMeds(); renderRecords(); renderSummary();
  }

  /* ---------- 操作 ---------- */
  function showTab(name) {
    document.querySelectorAll('.maintabs .tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    document.querySelectorAll('.tabpanel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'tab-' + name);
    });
    if (name === 'summary') renderSummary();
  }

  function openPetDialog() {
    $('petForm').reset();
    $('petUnit').value = speciesInfo($('petSpecies').value).u;
    var d = $('petDialog');
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  function closePetDialog() {
    var d = $('petDialog');
    if (d.close) d.close(); else d.removeAttribute('open');
  }

  function loadSample() {
    var t = today(), a = uid(), b = uid(), m1 = uid();
    state = blank();
    state.pets = [
      { id: a, name: '麻糬', species: '兔子', unit: 'g', birthday: addDays(t, -400), question: '最近挑食,想問是否需要檢查牙齒?' },
      { id: b, name: '小綠', species: '爬蟲類(鬃獅蜥、守宮等)', unit: 'g', birthday: addDays(t, -700), question: '' }
    ];
    state.current = a;
    state.meds = [{ id: m1, petId: a, name: '藥物 A(示範)', dose: '口服 0.3 ml', times: ['08:00', '20:00'], start: addDays(t, -3), end: addDays(t, 4), note: '範例資料' }];
    [-3, -2, -1].forEach(function (off) {
      state.doses[m1 + '|' + addDays(t, off) + '|08:00'] = true;
      if (off !== -2) state.doses[m1 + '|' + addDays(t, off) + '|20:00'] = true;
    });
    var rw = [1520, 1515, 1490, 1480, 1450], rt = [38.7, null, 38.9, null, 39.0];
    rw.forEach(function (w, i) {
      state.records.push({ id: uid(), petId: a, date: addDays(t, -28 + i * 7), weight: w, temp: rt[i],
        appetite: i >= 3 ? '減少' : '正常', activity: '正常', stool: i === 4 ? '偏硬或量少' : '正常', note: i === 4 ? '範例資料' : '' });
    });
    [420, 410, 395, 380].forEach(function (w, i) {
      state.records.push({ id: uid(), petId: b, date: addDays(t, -21 + i * 7), weight: w, temp: null,
        appetite: i >= 2 ? '減少' : '正常', activity: '', stool: '', note: i === 3 ? '缸內白天溫度 28°C(範例)' : '' });
    });
    save(); renderAll();
  }

  /* ---------- 網頁內提醒(只在這個網頁開著時有效) ---------- */
  var REMIND_WINDOW = 60 * 60 * 1000;   // 到點後 60 分鐘內才會跳提醒,避免晚點開網頁被舊提醒洗版
  var SNOOZE_MS = 10 * 60 * 1000;       // 「稍後提醒」= 10 分鐘後再跳
  var alertState = {};                  // key -> { s: 'shown' | 'snoozed' | 'dismissed', until }
  var toastEls = {};                    // key -> 畫面上的提醒卡
  var baseTitle = document.title;
  var soundOn = false;
  var audioCtx = null;
  try { soundOn = localStorage.getItem(KEY + '_sound') === '1'; } catch (e) { /* 忽略 */ }

  function dueMs(d, tm) {
    var p = d.split('-'), q = tm.split(':');
    return new Date(+p[0], +p[1] - 1, +p[2], +q[0], +q[1]).getTime();
  }
  function updateSoundBtn() {
    $('soundBtn').textContent = soundOn ? '🔔 提示音:開' : '🔕 提示音:關';
  }
  function updateTitle() {
    var n = Object.keys(toastEls).length;
    document.title = n ? '🔔(' + n + ') 該餵藥囉|藥你管' : baseTitle;
  }
  function beep() {
    if (!soundOn) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      [0, 0.22].forEach(function (off, i) {
        var t0 = audioCtx.currentTime + off, o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = i ? 988 : 784;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.15, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t0); o.stop(t0 + 0.22);
      });
    } catch (err) { /* 忽略 */ }
  }
  function showToast(key, pet, med, tm) {
    if (toastEls[key]) return;
    var k = esc(key), el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'alert');
    el.innerHTML =
      '<div class="pic">' + speciesInfo(pet.species).e + '</div>' +
      '<div class="body"><b>' + esc(pet.name) + ' 該餵藥囉!</b>' +
      '<small>' + tm + '・' + esc(med.name) + (med.dose ? '・' + esc(med.dose) : '') + '</small>' +
      '<div class="acts">' +
      '<button type="button" class="btn small" data-toast-done="' + k + '">✅ 已餵藥</button>' +
      '<button type="button" class="btn small ghost" data-toast-snooze="' + k + '">⏰ 10 分鐘後再提醒</button>' +
      '</div></div>' +
      '<button type="button" class="x" data-toast-close="' + k + '" aria-label="關閉提醒">✕</button>';
    $('toasts').appendChild(el);
    toastEls[key] = el;
    updateTitle();
    beep();
  }
  function removeToast(key) {
    var el = toastEls[key];
    if (!el) return;
    delete toastEls[key];
    el.classList.add('leaving');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    updateTitle();
  }
  function checkReminders() {
    var now = Date.now(), t = today(), valid = {};
    state.pets.forEach(function (pet) {
      activeMeds(pet.id, t).forEach(function (m) {
        m.times.forEach(function (tm) {
          var key = m.id + '|' + t + '|' + tm;
          if (state.doses[key]) return;                 // 已餵藥,不需要提醒
          valid[key] = true;
          var due = dueMs(t, tm), st = alertState[key];
          if (now < due || now - due > REMIND_WINDOW) return;
          if (!st || (st.s === 'snoozed' && now >= st.until)) {
            alertState[key] = { s: 'shown' };
            showToast(key, pet, m, tm);
          }
        });
      });
    });
    // 已完成、已刪除的項目,把畫面上殘留的提醒卡收掉(測試提醒除外)
    Object.keys(toastEls).forEach(function (k) {
      if (k.indexOf('test|') !== 0 && !valid[k]) removeToast(k);
    });
  }
  function toastAction(kind, key) {
    var isTest = key.indexOf('test|') === 0;
    if (kind === 'done' && !isTest) {
      state.doses[key] = true; save();
      renderToday(); renderMeds(); renderSummary();
    } else if (kind === 'snooze' && !isTest) {
      alertState[key] = { s: 'snoozed', until: Date.now() + SNOOZE_MS };
    } else if (kind === 'close' && !isTest) {
      alertState[key] = { s: 'dismissed' };
    }
    removeToast(key);
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target;
    var chip = el.closest ? el.closest('[data-pet]') : null;
    if (chip) { state.current = chip.dataset.pet; save(); renderAll(); return; }
    if (el.dataset && el.dataset.toastDone) { toastAction('done', el.dataset.toastDone); return; }
    if (el.dataset && el.dataset.toastSnooze) { toastAction('snooze', el.dataset.toastSnooze); return; }
    if (el.dataset && el.dataset.toastClose) { toastAction('close', el.dataset.toastClose); return; }
    if (el.id === 'testRemindBtn') {
      var tp = curPet();
      if (!tp) { alert('請先新增一隻寵物'); return; }
      showToast('test|' + Date.now(), tp, { name: '藥物 A(測試提醒)', dose: '口服 0.3 ml' }, nowHM());
      return;
    }
    if (el.id === 'soundBtn') {
      soundOn = !soundOn;
      try { localStorage.setItem(KEY + '_sound', soundOn ? '1' : '0'); } catch (err) { /* 忽略 */ }
      updateSoundBtn();
      if (soundOn) beep();
      return;
    }
    if (el.id === 'addPetBtn' || el.id === 'addPetBtn2') { openPetDialog(); return; }
    if (el.id === 'petCancel') { closePetDialog(); return; }
    if (el.id === 'sampleBtn') { loadSample(); return; }

    if (el.id === 'delPetBtn') {
      var pet = curPet();
      if (pet && confirm('確定刪除「' + pet.name + '」與其所有資料嗎?')) {
        var removed = {};
        state.meds.forEach(function (m) { if (m.petId === pet.id) removed[m.id] = true; });
        state.meds = state.meds.filter(function (m) { return m.petId !== pet.id; });
        state.records = state.records.filter(function (r) { return r.petId !== pet.id; });
        Object.keys(state.doses).forEach(function (k) { if (removed[k.split('|')[0]]) delete state.doses[k]; });
        state.pets = state.pets.filter(function (p) { return p.id !== pet.id; });
        state.current = state.pets.length ? state.pets[0].id : null;
        save(); renderAll();
      }
      return;
    }
    if (el.dataset && el.dataset.delMed) {
      if (confirm('確定刪除這個用藥排程嗎?')) {
        var id = el.dataset.delMed;
        state.meds = state.meds.filter(function (m) { return m.id !== id; });
        Object.keys(state.doses).forEach(function (k) { if (k.split('|')[0] === id) delete state.doses[k]; });
        save(); renderAll();
      }
      return;
    }
    if (el.dataset && el.dataset.delRec) {
      if (confirm('確定刪除這筆紀錄嗎?')) {
        var rid = el.dataset.delRec;
        state.records = state.records.filter(function (r) { return r.id !== rid; });
        save(); renderAll();
      }
      return;
    }
    if (el.classList && el.classList.contains('tab') && el.dataset.tab) { showTab(el.dataset.tab); return; }
    if (el.classList && el.classList.contains('seg-btn')) {
      chartMetric = el.dataset.metric;
      document.querySelectorAll('.seg-btn').forEach(function (b) { b.classList.toggle('active', b === el); });
      drawChart(curPet());
      return;
    }
    if (el.id === 'copyBtn') {
      var text = $('summaryOut').textContent;
      var done = function () { el.textContent = '✅ 已複製'; setTimeout(function () { el.textContent = '📋 複製摘要'; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { alert('複製失敗,請手動選取文字複製'); });
      } else {
        var r = document.createRange(); r.selectNodeContents($('summaryOut'));
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        try { document.execCommand('copy'); done(); } catch (err) { alert('請手動選取文字複製'); }
      }
      return;
    }
    if (el.id === 'printBtn') { showTab('summary'); window.print(); return; }
    if (el.id === 'resetBtn') {
      if (confirm('確定清除所有示範資料嗎?此動作無法復原。')) { state = blank(); save(); renderAll(); }
    }
  });

  // 勾選已餵藥
  $('todayList').addEventListener('change', function (e) {
    var key = e.target.dataset && e.target.dataset.key;
    if (!key) return;
    if (e.target.checked) state.doses[key] = true; else delete state.doses[key];
    save(); renderToday(); renderMeds(); renderSummary(); checkReminders();
  });

  // 新增寵物
  $('petSpecies').innerHTML = SPECIES.map(function (s) { return '<option>' + s.n + '</option>'; }).join('');
  $('petSpecies').addEventListener('change', function () { $('petUnit').value = speciesInfo(this.value).u; });
  $('petForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('petName').value.trim();
    if (!name) return;
    var p = { id: uid(), name: name, species: $('petSpecies').value, birthday: $('petBirth').value, unit: $('petUnit').value, question: '' };
    state.pets.push(p); state.current = p.id;
    save(); closePetDialog(); renderAll();
  });

  // 新增用藥排程
  $('medFreq').addEventListener('change', function () { buildTimeInputs(+this.value); });
  $('medForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var pet = curPet(); if (!pet) return;
    var times = [];
    $('medTimes').querySelectorAll('input').forEach(function (i) { if (i.value && times.indexOf(i.value) < 0) times.push(i.value); });
    times.sort();
    if (!times.length) { alert('請至少設定一個餵藥時間'); return; }
    var start = $('medStart').value, end = $('medEnd').value;
    if (end && end < start) { alert('結束日期不能早於開始日期'); return; }
    var newMed = { id: uid(), petId: pet.id, name: $('medName').value.trim(), dose: $('medDose').value.trim(),
      times: times, start: start, end: end || '', note: $('medNote').value.trim() };
    state.meds.push(newMed);
    // 剛新增時,今天已經過去的時間點不要立刻跳提醒
    var hmNow = nowHM();
    times.forEach(function (tm) {
      if (tm <= hmNow) alertState[newMed.id + '|' + today() + '|' + tm] = { s: 'dismissed' };
    });
    save();
    $('medForm').reset(); $('medStart').value = today(); $('medFreq').value = '2'; buildTimeInputs(2);
    renderAll();
  });

  // 新增健康紀錄
  $('recForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var pet = curPet(); if (!pet) return;
    var w = $('recWeight').value, tmp = $('recTemp').value;
    var rec = {
      id: uid(), petId: pet.id, date: $('recDate').value,
      weight: w !== '' ? parseFloat(w) : null, temp: tmp !== '' ? parseFloat(tmp) : null,
      appetite: $('recAppetite').value, activity: $('recActivity').value, stool: $('recStool').value,
      note: $('recNote').value.trim()
    };
    if (rec.weight == null && rec.temp == null && !rec.appetite && !rec.activity && !rec.stool && !rec.note) {
      alert('請至少填寫一個項目'); return;
    }
    state.records.push(rec); save();
    $('recForm').reset(); $('recDate').value = today();
    renderAll();
  });

  // 摘要的「想問獸醫的事」
  $('petQuestion').addEventListener('input', function () {
    var pet = curPet(); if (!pet) return;
    pet.question = this.value; save(); renderSummary();
  });

  /* ---------- 初始化 ---------- */
  $('medStart').value = today();
  $('recDate').value = today();
  buildTimeInputs(2);
  if (state.pets.length && !curPet()) state.current = state.pets[0].id;
  renderAll();

  // 提醒:每 10 秒檢查一次;切回此分頁時也立即檢查
  updateSoundBtn();
  checkReminders();
  setInterval(checkReminders, 10000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkReminders(); });
})();
