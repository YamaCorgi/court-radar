/* 場地雷達 - 書籤版 v7
 *
 * 這段程式跑在 teamweb.sporetrofit.com 這一頁裡面，用你自己的登入去查。
 * 沒有伺服器、沒有共用帳號、沒有排程，每次點都是當下最新的。
 *
 * 它只讀不寫：只呼叫查詢用的 API，不會預約、不會付款、不會取消任何東西。
 */
(async function () {
  'use strict';

  if (document.getElementById('cr-root')) {
    document.getElementById('cr-root').remove();
  }
  if (!location.host.includes('sporetrofit')) {
    alert('請先在運動中心的網站上登入，再點這個書籤。');
    return;
  }

  const VENUES = [
    { lid: 'TMEGS', name: '鼓山運動中心', short: '鼓山' },
    { lid: 'TMENZ', name: '楠仔坑運動中心', short: '楠仔坑' },
  ];
  const SPORTS = [
    { name: '羽球', cat: 'Badminton', accent: '#E6FA4B' },
    { name: '匹克球', cat: 'Pickleball', accent: '#46D0E8' },
  ];
  const DAYS = 8;
  const SLOTS = Array.from({ length: 16 }, (_, i) =>
    String(i + 6).padStart(2, '0') + ':00');
  const WD = ['日', '一', '二', '三', '四', '五', '六'];
  // 這個伺服器的查詢狀態存在 session 裡，同時發多個請求會互相覆蓋，
  // 導致回來的全是同一天的資料。只能一次問一個。
  const CONCURRENCY = 1;

  /* ---------- 畫面骨架 ---------- */
  const css = `
  #cr-root{position:fixed;inset:0;z-index:2147483647;background:#08211E;
    color:#E8EFEA;font-family:-apple-system,"PingFang TC","Noto Sans TC",sans-serif;
    overflow-y:auto;-webkit-overflow-scrolling:touch}
  #cr-root *{box-sizing:border-box}
  .cr-wrap{padding:14px 12px 40px;max-width:900px;margin:0 auto}
  .cr-top{display:flex;align-items:center;gap:10px;padding-bottom:10px;
    border-bottom:1px solid rgba(232,239,234,.14)}
  .cr-top h1{margin:0;font-size:17px;letter-spacing:.12em;font-weight:600}
  .cr-time{font-size:11px;color:#6F918A;font-family:ui-monospace,monospace}
  .cr-x{margin-left:auto;appearance:none;border:1px solid rgba(232,239,234,.2);
    background:transparent;color:#E8EFEA;width:32px;height:32px;border-radius:16px;
    font-size:17px;line-height:1;cursor:pointer;flex:none}
  .cr-tabs{display:flex;gap:6px;margin:12px 0 4px;flex-wrap:wrap}
  .cr-tab{appearance:none;border:1px solid rgba(232,239,234,.16);background:transparent;
    color:#6F918A;padding:7px 15px;font:inherit;font-size:13px;border-radius:2px;
    cursor:pointer;letter-spacing:.1em}
  .cr-tab[data-on="1"]{color:#06201C;font-weight:600;border-color:transparent}
  .cr-status{margin:14px 0;color:#6F918A;font-size:13px;line-height:1.7}
  .cr-bar{height:3px;background:rgba(232,239,234,.1);border-radius:2px;margin-top:8px}
  .cr-bar i{display:block;height:100%;width:0;background:#E6FA4B;border-radius:2px;
    transition:width .2s}
  .cr-panel{margin-top:16px}
  .cr-panel h2{margin:0 0 2px;font-size:15px;font-weight:600;letter-spacing:.06em}
  .cr-meta{margin:0 0 10px;color:#6F918A;font-size:12px}
  .cr-row{display:grid;grid-template-columns:42px repeat(8,1fr);gap:2px;margin-bottom:2px}
  .cr-h{text-align:center;line-height:1.1;padding-bottom:3px;
    border-bottom:1px solid rgba(232,239,234,.14)}
  .cr-h b{display:block;font-size:11px;font-weight:600}
  .cr-h span{font-size:9px;color:#6F918A}
  .cr-t{font-size:10px;color:#6F918A;display:flex;align-items:center;
    font-family:ui-monospace,monospace}
  .cr-c{appearance:none;border:0;border-radius:2px;height:22px;padding:0;
    font-size:11px;font-weight:600;font-family:ui-monospace,monospace;cursor:pointer}
  .cr-detail{position:sticky;bottom:0;background:rgba(8,33,30,.97);
    border-top:1px solid rgba(232,239,234,.14);padding:11px 12px;font-size:13px;
    margin:16px -12px -40px;min-height:44px;display:flex;align-items:center;
    gap:10px;flex-wrap:wrap}
  .cr-detail .cr-courts{color:#6F918A;font-size:11px}
  .cr-err{color:#E6FA4B;font-size:13px;line-height:1.8}
  .cr-none{color:#6F918A;font-size:13px;line-height:1.8;margin-top:14px}
  .cr-warn{color:#E6FA4B}
  .cr-diag{margin-top:16px;color:#6F918A;font-size:12px}
  .cr-diag summary{cursor:pointer;padding:6px 0}
  .cr-h.cr-off b,.cr-h.cr-off span{color:#3E5B55}
  .cr-offcell{background:repeating-linear-gradient(45deg,#0C2622,#0C2622 3px,
    #102B27 3px,#102B27 6px);cursor:default}
  .cr-dbg{background:#0E2E29;border:1px solid rgba(232,239,234,.14);border-radius:3px;
    padding:10px;font-size:10px;line-height:1.6;color:#8FB0A8;white-space:pre-wrap;
    word-break:break-all;max-height:300px;overflow:auto;font-family:ui-monospace,monospace}
  `;
  const root = document.createElement('div');
  root.id = 'cr-root';
  root.innerHTML = `<style>${css}</style><div class="cr-wrap">
    <div class="cr-top">
      <div><h1>場地雷達</h1><div class="cr-time" id="cr-time"></div></div>
      <button class="cr-x" id="cr-close">✕</button>
    </div>
    <div id="cr-body"><div class="cr-status" id="cr-status">準備中…
      <div class="cr-bar"><i id="cr-bar"></i></div></div></div>
  </div>`;
  document.body.appendChild(root);
  document.getElementById('cr-close').onclick = () => root.remove();

  const $ = (id) => document.getElementById(id);
  const setStatus = (t) => { const e = $('cr-status'); if (e) e.firstChild.textContent = t; };
  const setBar = (p) => { const e = $('cr-bar'); if (e) e.style.width = (p * 100) + '%'; };

  /* ---------- 跟伺服器講話 ---------- */
  async function post(path, data) {
    const r = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: new URLSearchParams(data),
    });
    return r.text();
  }

  async function loggedIn() {
    try {
      const r = await fetch('/login/ajax/get_session.php', { method: 'POST' });
      return (await r.json()).success === true;
    } catch (e) { return false; }
  }

  function baseForm(venue, sport) {
    return {
      LID: venue.lid,
      LIDName: venue.name,
      CategoryID: sport.cat,
      CategoryName: sport.name,
      CategoryArrayStr: JSON.stringify([{
        LID: venue.lid, ItemID: sport.cat,
        Name: sport.name, ListOrder: '0',
      }]),
      redirectFromIndex: 'false',
      redirectFromSearch: 'false',
      redirectFromFilter: '',
    };
  }

  /* 關鍵：先讓伺服器把「目前選的場館與運動」切過去。
     不做這步的話，查到的永遠是你點書籤時所在那一頁的場館。 */
  async function setContext(venue, sport) {
    // 真實操作是兩段：先選場館，再選運動。只做第二段的話伺服器狀態不會動。
    await post('/Location/', {
      LID: venue.lid,
      LIDName: venue.name,
      redirectFromIndex: 'false',
      redirectFromSearch: 'false',
    });
    await post('/Location/LocationSubList/', baseForm(venue, sport));
  }

  let lastRaw = '';
  async function getCourts(venue, sport) {
    const html = await post('/Location/LocationSubList/ajax/createTable/',
      baseForm(venue, sport));
    lastRaw = html;
    const ids = [...html.matchAll(/name=['"]LSID['"]\s*value=['"]([^'"]+)['"]/g)]
      .map((m) => m[1]);
    const nms = [...html.matchAll(/name=['"]LSIDName['"]\s*value=['"]([^'"]+)['"]/g)]
      .map((m) => m[1]);
    const seen = new Set(), out = [];
    ids.forEach((id, i) => {
      if (seen.has(id)) return;
      seen.add(id);
      out.push({ lsid: id, name: nms[i] || id });
    });
    return out;
  }

  async function getDay(lid, lsid, day) {
    const raw = await post('/api/getRequestData.php', {
      serviceName: 'getResLocationAvailableData',
      LID: lid, LSID: lsid, QueryDate: day,
    });
    let j;
    try { j = JSON.parse(raw.trim()); } catch (e) { return { free: [], window: null }; }
    const rd = j.ResultData || {};
    let rows = ((rd.AvailableData || {}).DataTable || {}).DataRow || [];
    if (!Array.isArray(rows)) rows = [rows];
    // allowBooking=Y 且沒被標成已預約，才算真的空著
    // 只看有沒有被預約。allowBooking 是「現在能不能按下去訂」的操作旗標，
    // 對比較遠的日期可能是 N，但那個時段其實空著——拿它當「有沒有空」會漏掉一堆。
    const free = rows.filter((r) => !r.Status)
      .map((r) => String(r.Time || '').split(' ')[0]);
    // 伺服器自己講的「開放預約區間」，用來區分「訂滿了」和「還沒開放」
    const window = (rd.ReservingStart && rd.ReservingEnd)
      ? [String(rd.ReservingStart).slice(0, 10), String(rd.ReservingEnd).slice(0, 10)]
      : null;
    // 伺服器有沒有回應我們問的日期？把它自己講的日期抓出來比對
    const echoed = rd.QueryDate || rd.Date || rd.ReserveDate || '';
    return {
      free: free, window: window,
      rowCount: rows.length,
      echoed: String(echoed).slice(0, 10),
      keys: Object.keys(rd).join(','),
      firstTime: rows.length ? String(rows[0].Time || '') : '',
      sample: JSON.stringify(rows.slice(0, 2)),
    };
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* 場地清單存在瀏覽器本機，純粹是場館名稱與代碼，沒有個人資料。 */
  function cacheKey(venue, sport) {
    return 'court-radar:courts:' + venue.lid + ':' + sport.cat;
  }
  function saveCourts(venue, sport, courts) {
    try { localStorage.setItem(cacheKey(venue, sport), JSON.stringify(courts)); }
    catch (e) { /* 無痕模式之類的存不了，不影響主流程 */ }
  }
  function loadCourts(venue, sport) {
    try { return JSON.parse(localStorage.getItem(cacheKey(venue, sport)) || 'null'); }
    catch (e) { return null; }
  }

  async function pool(jobs, n, fn, onTick) {
    let i = 0, done = 0;
    await Promise.all(Array.from({ length: n }, async () => {
      while (i < jobs.length) {
        const k = i++;
        try { await fn(jobs[k]); } catch (e) { /* 單筆失敗就跳過 */ }
        done++;
        if (onTick) onTick(done / jobs.length);
      }
    }));
  }

  /* ---------- 開始抓 ---------- */
  setStatus('確認登入狀態…');
  if (!await loggedIn()) {
    $('cr-body').innerHTML = `<p class="cr-err">看起來還沒登入。<br><br>
      請先在這個網站登入（LINE 或其他方式都可以），登入完成後再點一次書籤。</p>`;
    return;
  }

  const today = new Date();
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() + i);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  });

  const data = {};
  const groups = [];
  for (const v of VENUES) {
    data[v.lid] = {};
    for (const s of SPORTS) groups.push({ v, s });
  }

  // 一組一組做完再換下一組。session 狀態是全域的，混著併發會互相蓋掉。
  let gi = 0;
  for (const g of groups) {
    const v = g.v, s = g.s;
    gi++;
    setStatus(`(${gi}/${groups.length}) ${v.short}・${s.name} — 查場地清單…`);
    setBar((gi - 1) / groups.length);

    // 這個端點時好時壞，原因未明，所以多試幾次，每次之間停一下
    let courts = [];
    for (let attempt = 1; attempt <= 3 && !courts.length; attempt++) {
      if (attempt > 1) {
        setStatus(`(${gi}/${groups.length}) ${v.short}・${s.name} — 重試 ${attempt}/3…`);
        await sleep(600);
      }
      await setContext(v, s);
      await sleep(250);               // 給伺服器一點時間把狀態寫進 session
      courts = await getCourts(v, s);
    }

    let fromCache = false;
    if (courts.length) {
      saveCourts(v, s, courts);       // 成功就記起來
    } else {
      const cached = loadCourts(v, s);
      if (cached && cached.length) {  // 抓不到就用上次記住的，場地代碼幾乎不會變
        courts = cached;
        fromCache = true;
      }
    }

    data[v.lid][s.name] = { total: courts.length, slots: {}, fromCache: fromCache };
    days.forEach((d) => { data[v.lid][s.name].slots[d] = {}; });
    if (!courts.length) {
      // 查不到就把伺服器的原話留著，顯示在畫面上，不用再靠猜的
      data[v.lid][s.name].debug =
        `送出 CategoryID=${s.cat} / LID=${v.lid}\n` +
        `伺服器回應長度 ${lastRaw.length}\n\n` +
        lastRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
      continue;
    }

    const jobs = [];
    for (const c of courts) for (const d of days) jobs.push({ c, d });

    setStatus(`(${gi}/${groups.length}) ${v.short}・${s.name} — ${courts.length} 面場地，查詢中…`);
    await pool(jobs, CONCURRENCY, async (job) => {
      const res = await getDay(v.lid, job.c.lsid, job.d);
      if (res.window && !data[v.lid][s.name].window) {
        data[v.lid][s.name].window = res.window;
      }
      const blk = data[v.lid][s.name];
      if (!blk.probe) blk.probe = [];
      if (blk.probe.length < 6) {
        blk.probe.push(
          `問 ${job.d} ${job.c.name}` +
          ` → 回 ${res.echoed || '(沒回日期)'}` +
          ` 筆數 ${res.rowCount}` +
          ` 首筆 ${res.firstTime || '(無)'}`);
        if (blk.probe.length === 1) {
          blk.probe.push('ResultData 欄位: ' + res.keys);
          blk.probe.push('原始樣本: ' + res.sample);
        }
      }
      const bucket = data[v.lid][s.name].slots[job.d];
      for (const t of res.free) {
        if (!bucket[t]) bucket[t] = { free: 0, courts: [] };
        bucket[t].free++;
        bucket[t].courts.push(job.c.name);
      }
    }, (p) => setBar((gi - 1 + p) / groups.length));
  }

  /* ---------- 畫熱力圖 ---------- */
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
  function mixc(a, b, t) {
    const A = hex(a), B = hex(b);
    return '#' + A.map((c, i) => {
      const va = (c / 255) ** 2.2, vb = (B[i] / 255) ** 2.2;
      const v = Math.round((((1 - t) * va + t * vb) ** (1 / 2.2)) * 255);
      return v.toString(16).padStart(2, '0');
    }).join('');
  }

  let curSport = SPORTS[0].name, curVenue = VENUES[0].lid;

  function tabsHtml() {
    return `
      <div class="cr-tabs">${SPORTS.map((s) =>
        `<button class="cr-tab" data-sport="${s.name}" data-on="${s.name === curSport ? 1 : 0}"
          style="${s.name === curSport ? 'background:' + s.accent : ''}">${s.name}</button>`).join('')}
      </div>
      <div class="cr-tabs">${VENUES.map((v) =>
        `<button class="cr-tab" data-venue="${v.lid}" data-on="${v.lid === curVenue ? 1 : 0}"
          style="${v.lid === curVenue ? 'background:#E8EFEA' : ''}">${v.short}</button>`).join('')}
      </div>`;
  }

  function bindTabs() {
    $('cr-body').querySelectorAll('[data-sport]').forEach((b) => {
      b.onclick = () => { curSport = b.dataset.sport; draw(); };
    });
    $('cr-body').querySelectorAll('[data-venue]').forEach((b) => {
      b.onclick = () => { curVenue = b.dataset.venue; draw(); };
    });
  }

  function draw() {
    const sport = SPORTS.find((s) => s.name === curSport);
    const venue = VENUES.find((v) => v.lid === curVenue);
    const block = data[venue.lid][sport.name] || { total: 0, slots: {} };
    const total = block.total;

    if (!total) {
      $('cr-body').innerHTML = tabsHtml() + `
        <div class="cr-panel"><h2>${venue.name}</h2>
        <p class="cr-none">查不到${sport.name}場地。下面是伺服器實際回的內容，
        截圖給我看就能知道原因：</p>
        <pre class="cr-dbg">${(block.debug || '（沒有記錄）')
          .replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre></div>`;
      bindTabs();
      return;
    }

    const win = block.window;
    const outside = (d) => win && (d < win[0] || d > win[1]);

    let head = '<div class="cr-row"><div class="cr-t"></div>';
    for (const d of days) {
      const dt = new Date(d + 'T00:00:00');
      head += `<div class="cr-h${outside(d) ? ' cr-off' : ''}"><b>${dt.getMonth() + 1}/${dt.getDate()}</b>
        <span>${outside(d) ? '未開放' : WD[dt.getDay()]}</span></div>`;
    }
    head += '</div>';

    let rows = '', sum = 0;
    for (const t of SLOTS) {
      rows += `<div class="cr-row"><div class="cr-t">${t}</div>`;
      for (const d of days) {
        if (outside(d)) {
          rows += '<button class="cr-c cr-offcell" disabled></button>';
          continue;
        }
        const cell = block.slots[d][t];
        const free = cell ? cell.free : 0;
        sum += free;
        const ratio = total ? free / total : 0;
        const bg = mixc('#12332E', sport.accent, Math.pow(ratio, 0.75));
        const fg = ratio > 0.42 ? '#06201C' : '#6F918A';
        const glow = free ? `box-shadow:0 0 ${Math.round(ratio * 11)}px ${bg}` : '';
        const payload = free
          ? ` data-d="${d}" data-t="${t}" data-f="${free}" data-c="${(cell.courts || []).join(' · ')}"`
          : '';
        rows += `<button class="cr-c" style="background:${bg};color:${fg};${glow}"${payload}>${free || ''}</button>`;
      }
      rows += '</div>';
    }

    $('cr-body').innerHTML = tabsHtml() + `
      <div class="cr-panel">
        <h2>${venue.name}</h2>
        <p class="cr-meta">${total} 面${sport.name}場 · ${
          win ? '開放預約 ' + win[0].slice(5).replace('-', '/') + ' 至 '
                + win[1].slice(5).replace('-', '/') : '未來 ' + DAYS + ' 天'
        } · 共 ${sum} 個空檔${block.fromCache
          ? ' <span class="cr-warn">（場地清單取自上次記錄）</span>' : ''}</p>
        ${head}${rows}
      </div>
      <details class="cr-diag"><summary>診斷：問的日期 vs 伺服器回的日期</summary>
        <pre class="cr-dbg">${((block.probe || ['（沒有記錄）']).join('\n'))
          .replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre></details>
      <div class="cr-detail" id="cr-detail">點一格亮起來的時段看細節</div>`;

    bindTabs();
    $('cr-body').querySelectorAll('.cr-c[data-f]').forEach((b) => {
      b.onclick = () => {
        const end = String(Number(b.dataset.t.slice(0, 2)) + 1).padStart(2, '0') + ':00';
        $('cr-detail').innerHTML =
          `<b>${b.dataset.d} ${b.dataset.t}–${end}</b>
           <span>剩 ${b.dataset.f} / ${total} 面</span>
           <span class="cr-courts">${b.dataset.c}</span>`;
      };
    });
  }

  const now = new Date();
  $('cr-time').textContent = '查詢於 ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0');
  draw();
})();
