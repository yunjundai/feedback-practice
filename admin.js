/* ============================================================
   練習後台
   ============================================================ */
(function () {
  const $app = document.getElementById("app");
  const CFG = window.APP_CONFIG || {};
  const SC = window.SCENARIOS, M = window.METHODS, CK = window.CHECKLIST;
  const MCOLOR = { sandwich: "#1f7a99", sbi: "#e0a030", interactive: "#8a5cc2", free: "#7d8f9b" };
  document.getElementById("siteSub").textContent = CFG.SITE_TITLE || "";
  if (Store.mode === "local") document.getElementById("modeBanner").classList.remove("hidden");

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const scName = id => { const s = SC.find(x => x.id === id); return s ? `${s.id}. ${s.title}` : `情境 ${id}`; };
  const fmtTime = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }); };
  const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "—";
  const teacherKey = r => r.teacher_name + "｜" + (r.school || "");
  function compose(method, obj) {
    obj = obj || {}; const m = M[method]; if (!m) return "";
    if (method === "interactive") return m.fields.filter(f => obj[f.key]).map(f => (f.key.startsWith("t") ? "師：" : "生：") + obj[f.key]).join("\n");
    const sep = method === "sbi" ? "，" : "。";
    return m.fields.map(f => (obj[f.key] || "").trim()).filter(Boolean)
      .reduce((acc, p) => !acc ? p : acc + (/[，。！？；、：」）…,.!?]$/.test(acc) ? "" : sep) + p, "");
  }
  const hits = (r, n) => (r["judgment_hits" + n] || []);
  const st = (r, n) => (r["ai" + n] && r["ai" + n].stars) || null;
  const avg = arr => { const v = arr.filter(x => x); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const f1 = x => x == null ? "—" : x.toFixed(1);
  function starCell(r) {
    const a = st(r, 1), b = st(r, 2);
    if (!a && !b) return `<span class="small muted">—</span>`;
    return `${a ? AI.starsHtml(a, true) : ""}${b ? ` → ${AI.starsHtml(b, true)}` : ""}`;
  }
  function scenarioBlock(s, fallbackId) {
    s = s || {};
    return `<div class="scenario-mini">
      <div class="sm-head"><b>情境 ${esc(s.id || fallbackId)}：${esc(s.title || "")}</b></div>
      <div class="sm-row"><span class="lbl">情境描述</span><span>${esc(s.description || "")}</span></div>
      <div class="sm-row"><span class="lbl">教師目標</span><span>${(s.goals || []).map(esc).join("<br>")}</span></div>
      <div class="sm-row"><span class="lbl">學生反應</span><span>${esc(s.reaction || "")}</span></div>
    </div>`;
  }

  let data = [];
  let tab = "overview";
  let filt = { sc: "", school: "", q: "", teacher: "" };
  let wallSc = "";

  /* ---------- 登入 ---------- */
  async function boot() {
    $app.innerHTML = `<div class="empty">載入中…</div>`;
    let admin;
    try { admin = await Store.currentAdmin(); } catch (e) { return fatal(e); }
    if (!admin) return renderLogin();
    if (admin.denied) return renderDenied(admin.email);
    document.getElementById("who").innerHTML = `${esc(admin.email)} ${Store.mode === "cloud" ? '<button class="btn ghost sm" id="logout">登出</button>' : ""}`;
    const lo = document.getElementById("logout");
    if (lo) lo.onclick = async () => { await Store.signOut(); location.reload(); };
    await load();
  }
  function fatal(e) { $app.innerHTML = `<div class="card"><div class="notice warn">發生錯誤：${esc(e.message)}</div></div>`; }
  function renderLogin() {
    $app.innerHTML = `
      <div class="card" style="max-width:420px;margin:40px auto">
        <h2>管理者登入</h2>
        <label class="field"><span>Email</span><input type="email" id="em" autocomplete="username"></label>
        <label class="field"><span>密碼</span><input type="password" id="pw" autocomplete="current-password"></label>
        <div id="err"></div>
        <div class="btn-row end"><button class="btn primary" id="login">登入</button></div>
      </div>`;
    const doLogin = async () => {
      try { await Store.signIn(document.getElementById("em").value.trim(), document.getElementById("pw").value); boot(); }
      catch (e) { document.getElementById("err").innerHTML = `<div class="notice warn">${esc(e.message)}</div>`; }
    };
    document.getElementById("login").onclick = doLogin;
    document.getElementById("pw").onkeydown = e => { if (e.key === "Enter") doLogin(); };
  }
  function renderDenied(email) {
    $app.innerHTML = `<div class="card" style="max-width:480px;margin:40px auto"><h2>沒有後台權限</h2>
      <p class="muted">${esc(email)} 不在管理者名單中。</p><button class="btn" id="lo">登出</button></div>`;
    document.getElementById("lo").onclick = async () => { await Store.signOut(); location.reload(); };
  }

  async function load() {
    try { data = await Store.listAttempts(); } catch (e) { return fatal(e); }
    render();
  }

  /* ---------- 主畫面 ---------- */
  function render() {
    const tabs = [["overview", "總覽"], ["matrix", "完成度"], ["records", "練習紀錄"], ["wall", "作品牆"]];
    $app.innerHTML = `
      <div class="hide-proj admin-bar">
        <div class="tabs admin-tabs">
          ${tabs.map(([k, n]) => `<button class="tab ${tab === k ? "on" : ""}" data-t="${k}">${n}</button>`).join("")}
        </div>
        <div class="admin-actions">
        <button class="btn sm" id="refresh">↻ 重新整理</button>
        <button class="btn sm" id="csv">匯出 Excel (CSV)</button>
        ${Store.mode === "local" ? `<button class="btn sm" id="demo">產生測試資料</button><button class="btn sm danger" id="clear">清除本地資料</button>` : ""}
        </div>
      </div>
      <div id="view"></div>`;
    $app.querySelectorAll(".tab").forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
    document.getElementById("refresh").onclick = load;
    document.getElementById("csv").onclick = exportCsv;
    if (Store.mode === "local") {
      document.getElementById("demo").onclick = () => { makeDemo(); load(); };
      document.getElementById("clear").onclick = () => { if (confirm("確定清除這台電腦上所有練習資料？")) { Store.clearLocal(); load(); } };
    }
    if (tab !== "wall" && proj) { proj = false; document.body.classList.remove("projector"); }
    const v = document.getElementById("view");
    if (!data.length && tab !== "wall") { v.innerHTML = `<div class="card empty">目前還沒有練習紀錄。${Store.mode === "local" ? "<br>可以先到練習頁做幾題，或按「產生測試資料」看看後台的樣子。" : ""}</div>`; return; }
    ({ overview: viewOverview, matrix: viewMatrix, records: viewRecords, wall: viewWall })[tab](v);
  }

  /* ---------- 總覽 ---------- */
  function viewOverview(v) {
    const teachers = new Map();
    data.forEach(r => { const k = teacherKey(r); if (!teachers.has(k)) teachers.set(k, new Set()); teachers.get(k).add(r.scenario_id); });
    const full = [...teachers.values()].filter(s => s.size >= SC.length).length;
    const withHits1 = data.filter(r => hits(r, 1).length);
    const fixed = withHits1.filter(r => !hits(r, 2).length).length;

    const rows = SC.map(s => {
      const rs = data.filter(r => r.scenario_id === s.id);
      const cnt = k => rs.filter(r => r.method === k).length;
      const avgCk = rs.length ? (rs.reduce((a, r) => a + (r.checklist || []).length, 0) / rs.length).toFixed(1) : "—";
      const bar = rs.length ? Object.keys(M).map(k => `<i style="width:${cnt(k) / rs.length * 100}%;background:${MCOLOR[k]}" title="${M[k].short} ${cnt(k)}"></i>`).join("") : "";
      return `<tr class="click" data-sc="${s.id}">
        <td data-label="情境" class="cell-title">${esc(scName(s.id))}</td>
        <td data-label="練習次數" class="c">${rs.length}</td>
        <td data-label="老師數" class="c">${new Set(rs.map(teacherKey)).size}</td>
        <td data-label="選用方法"><div><div class="bar">${bar}</div><div class="small muted">${Object.keys(M).map(k => `${M[k].short} ${cnt(k)}`).join("・")}</div></div></td>
        <td data-label="初稿有判斷式" class="c">${pct(rs.filter(r => hits(r, 1).length).length, rs.length)}</td>
        <td data-label="平均自評" class="c">${avgCk} / ${CK.length}</td>
        <td data-label="AI 平均星等" class="c">${f1(avg(rs.map(r => st(r, 1))))} → ${f1(avg(rs.map(r => st(r, 2))))}</td>
      </tr>`;
    }).join("");

    v.innerHTML = `
      <div class="stats">
        <div class="stat"><div class="v">${teachers.size}</div><div class="k">參與老師</div></div>
        <div class="stat"><div class="v">${data.length}</div><div class="k">練習次數</div></div>
        <div class="stat"><div class="v">${full}</div><div class="k">完成全部 ${SC.length} 個情境</div></div>
        <div class="stat"><div class="v">${pct(withHits1.length, data.length)}</div><div class="k">初稿出現判斷式用語</div></div>
        <div class="stat"><div class="v">${pct(fixed, withHits1.length)}</div><div class="k">其中修改後已改掉</div></div>
        <div class="stat"><div class="v">${pct(data.filter(r => r.ai1).length, data.length)}</div><div class="k">有使用 AI 教練回饋</div></div>
        <div class="stat"><div class="v">${f1(avg(data.map(r => st(r, 1))))}<small> → ${f1(avg(data.map(r => st(r, 2))))}</small></div><div class="k">AI 平均星等（第一版 → 修改版）</div></div>
      </div>
      <div class="card">
        <h2>各情境概況</h2>
        <div class="legend">${Object.keys(M).map(k => `<span><i style="background:${MCOLOR[k]}"></i>${M[k].name}</span>`).join("")}</div>
        <div class="table-wrap"><table class="cards">
          <thead><tr><th>情境</th><th class="c">練習次數</th><th class="c">老師數</th><th>選用方法</th><th class="c">初稿有判斷式</th><th class="c">平均自評</th><th class="c">AI 星等<br><small>第一版→修改版</small></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <p class="hint">點一列可以看該情境的所有練習紀錄。</p>
      </div>`;
    v.querySelectorAll("tr[data-sc]").forEach(tr => tr.onclick = () => { filt = { sc: tr.dataset.sc, school: "", q: "", teacher: "" }; tab = "records"; render(); });
  }

  /* ---------- 完成度 ---------- */
  function viewMatrix(v) {
    const map = new Map();
    data.forEach(r => {
      const k = teacherKey(r);
      if (!map.has(k)) map.set(k, { name: r.teacher_name, school: r.school || "", cnt: {}, last: r.created_at, total: 0 });
      const t = map.get(k); t.cnt[r.scenario_id] = (t.cnt[r.scenario_id] || 0) + 1; t.total++;
      if (r.created_at > t.last) t.last = r.created_at;
    });
    const list = [...map.entries()].sort((a, b) => (a[1].school + a[1].name).localeCompare(b[1].school + b[1].name, "zh-Hant"));
    v.innerHTML = `
      <div class="card">
        <h2>老師完成度</h2>
        <p class="hint">格子裡的數字是練習次數。點老師姓名可以看他的所有紀錄。</p>
        <div class="table-wrap"><table class="matrix">
          <thead><tr><th>老師</th><th>學校</th>${SC.map(s => `<th class="c" title="${esc(s.title)}">${s.id}</th>`).join("")}<th class="c">完成</th><th>最後練習</th></tr></thead>
          <tbody>${list.map(([k, t]) => {
            const n = SC.filter(s => t.cnt[s.id]).length;
            return `<tr class="click" data-k="${esc(k)}"><td><b>${esc(t.name)}</b></td><td>${esc(t.school)}</td>
              ${SC.map(s => t.cnt[s.id] ? `<td class="c cell-done">${t.cnt[s.id] > 1 ? t.cnt[s.id] : "✓"}</td>` : `<td class="c cell-none">・</td>`).join("")}
              <td class="c"><span class="badge ${n === SC.length ? "ok" : ""}">${n}/${SC.length}</span></td>
              <td class="small">${fmtTime(t.last)}</td></tr>`;
          }).join("")}</tbody>
        </table></div>
      </div>`;
    v.querySelectorAll("tr[data-k]").forEach(tr => tr.onclick = () => { filt = { sc: "", school: "", q: "", teacher: tr.dataset.k }; tab = "records"; render(); });
  }

  /* ---------- 練習紀錄 ---------- */
  function viewRecords(v) {
    const schools = [...new Set(data.map(r => r.school).filter(Boolean))].sort();
    v.innerHTML = `
      <div class="card">
        <div class="filters">
          <select id="fSc"><option value="">全部情境</option>${SC.map(s => `<option value="${s.id}" ${String(filt.sc) === String(s.id) ? "selected" : ""}>${esc(scName(s.id))}</option>`).join("")}</select>
          <select id="fSch"><option value="">全部學校</option>${schools.map(s => `<option ${filt.school === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
          <input type="text" id="fQ" placeholder="搜尋姓名或內容" value="${esc(filt.q)}">
        </div>
        ${filt.teacher ? `<div class="notice small">只顯示：${esc(filt.teacher)} <button class="btn ghost sm" id="clrT">顯示全部</button></div>` : ""}
        <div id="list"></div>
      </div>`;
    const draw = () => {
      const q = filt.q.trim();
      const rs = data.filter(r =>
        (!filt.sc || String(r.scenario_id) === String(filt.sc)) &&
        (!filt.school || r.school === filt.school) &&
        (!filt.teacher || teacherKey(r) === filt.teacher) &&
        (!q || (r.teacher_name + compose(r.method, r.draft1) + compose(r.method, r.draft2) + (r.reflection || "")).includes(q)));
      document.getElementById("list").innerHTML = rs.length ? `
        <p class="small muted">共 ${rs.length} 筆</p>
        <div class="table-wrap"><table class="cards">
          <thead><tr><th>時間</th><th>老師</th><th>學校</th><th>情境</th><th>方法</th><th class="c">自評</th><th>判斷式用語</th><th>AI 星等</th><th class="c">作品牆</th></tr></thead>
          <tbody>${rs.map(r => `<tr class="click" data-id="${esc(r.id)}">
            <td data-label="時間" class="small">${fmtTime(r.created_at)}</td><td data-label="老師" class="cell-title">${esc(r.teacher_name)}</td><td data-label="學校" class="small">${esc(r.school || "")}</td>
            <td data-label="情境">${esc(scName(r.scenario_id))}</td><td data-label="方法"><span class="badge" style="color:${MCOLOR[r.method]}">${esc(M[r.method] ? M[r.method].short : r.method)}</span></td>
            <td data-label="自評" class="c">${(r.checklist || []).length}/${CK.length}</td>
            <td data-label="判斷式用語">${hits(r, 1).length ? (hits(r, 2).length ? `<span class="badge warn">仍有 ${hits(r, 2).length}</span>` : `<span class="badge ok">已改掉</span>`) : `<span class="small muted">無</span>`}</td>
            <td data-label="AI 星等" class="nowrap">${starCell(r)}</td>
            <td data-label="作品牆" class="c">${r.hidden ? `<span class="badge warn">已隱藏</span>` : `<span class="small muted">顯示</span>`}</td></tr>`).join("")}</tbody>
        </table></div>` : `<div class="empty">沒有符合條件的紀錄</div>`;
      document.querySelectorAll("#list tr[data-id]").forEach(tr => tr.onclick = () => openDetail(tr.dataset.id));
    };
    document.getElementById("fSc").onchange = e => { filt.sc = e.target.value; draw(); };
    document.getElementById("fSch").onchange = e => { filt.school = e.target.value; draw(); };
    document.getElementById("fQ").oninput = e => { filt.q = e.target.value; draw(); };
    const ct = document.getElementById("clrT"); if (ct) ct.onclick = () => { filt.teacher = ""; render(); };
    draw();
  }

  function openDetail(id) {
    const r = data.find(x => String(x.id) === String(id)); if (!r) return;
    const s = SC.find(x => x.id === r.scenario_id) || {};
    const hl = (txt, words) => { let t = esc(txt); (words || []).forEach(w => { t = t.split(esc(w)).join(`<mark>${esc(w)}</mark>`); }); return t; };
    const bg = document.createElement("div"); bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal">
      <div style="display:flex;gap:10px;align-items:flex-start">
        <div style="flex:1"><h2 style="margin:0">${esc(r.teacher_name)}${r.school ? "（" + esc(r.school) + "）" : ""}</h2>
        <div class="small muted">${esc(scName(r.scenario_id))}・${esc(M[r.method] ? M[r.method].name : r.method)}・${fmtTime(r.created_at)}${r.duration_sec ? "・用時 " + (r.duration_sec < 60 ? r.duration_sec + " 秒" : Math.round(r.duration_sec / 60) + " 分鐘") : ""}</div></div>
        <button class="btn sm" id="x">關閉</button>
      </div>
      <div style="margin-top:14px">${scenarioBlock(s, r.scenario_id)}</div>
      <div class="two-col" style="margin-top:16px">
        <div><h3>第一版</h3><div class="preview">${hl(compose(r.method, r.draft1), hits(r, 1))}</div></div>
        <div><h3>修改版</h3><div class="preview">${hl(compose(r.method, r.draft2), hits(r, 2))}</div></div>
      </div>
      <h3 style="margin-top:16px">自我檢核（${(r.checklist || []).length}/${CK.length}）</h3>
      <div class="small">${CK.map(c => `<div>${(r.checklist || []).includes(c.key) ? "✅" : "⬜"} ${esc(c.text)}</div>`).join("")}</div>
      ${r.reflection ? `<h3 style="margin-top:16px">修改心得</h3><div class="preview">${esc(r.reflection)}</div>` : ""}
      ${r.ai1 || r.ai2 ? `<h3 style="margin-top:16px">AI 教練回饋</h3>
        <div class="two-col">
          <div>${r.ai1 ? `<span class="badge">第一版</span>${AI.render(r.ai1)}` : `<span class="small muted">第一版未使用 AI</span>`}</div>
          <div>${r.ai2 ? `<span class="badge accent">修改版</span>${AI.render(r.ai2)}` : `<span class="small muted">修改版未使用 AI</span>`}</div>
        </div>` : ""}
      <div class="btn-row">
        <button class="btn" id="feat">${r.hidden ? "在作品牆恢復顯示" : "從作品牆隱藏"}</button>
        <div class="spacer"></div>
        <button class="btn danger" id="del">刪除這筆</button>
      </div>
    </div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.onclick = e => { if (e.target === bg) close(); };
    bg.querySelector("#x").onclick = close;
    bg.querySelector("#feat").onclick = async () => {
      try { await Store.setHidden(r.id, !r.hidden); r.hidden = !r.hidden; close(); render(); } catch (e) { alert("失敗：" + e.message); }
    };
    bg.querySelector("#del").onclick = async () => {
      if (!confirm("確定刪除這筆練習紀錄？無法復原。")) return;
      try { await Store.deleteAttempt(r.id); data = data.filter(x => x !== r); close(); render(); } catch (e) { alert("失敗：" + e.message); }
    };
  }

  /* ---------- 作品牆（所有練習自動出現；投影模式＋抽籤） ---------- */
  let proj = false;
  let noRepeat = true;
  const drawn = new Set();

  function wallRows() {
    return data.filter(r => !r.hidden && r.draft2 && (!wallSc || String(r.scenario_id) === String(wallSc)));
  }

  function viewWall(v) {
    const rs = wallRows();
    document.body.classList.toggle("projector", proj);
    v.innerHTML = `
      <div class="wall-toolbar">
        <select id="wSc"><option value="">全部情境</option>${SC.map(s => `<option value="${s.id}" ${String(wallSc) === String(s.id) ? "selected" : ""}>${esc(scName(s.id))}</option>`).join("")}</select>
        <label class="chk"><input type="checkbox" id="noRep" ${noRepeat ? "checked" : ""}> 不重複抽</label>
        <button class="btn draw-btn" id="draw" ${rs.length ? "" : "disabled"}>🎲 抽籤</button>
        ${proj ? `<button class="btn" id="exitProj">離開投影</button>` : `<button class="btn primary" id="proj">投影模式</button>`}
      </div>
      <p class="hint hide-proj">所有老師送出的練習都會自動出現在這裡。點任一張卡片可以看 AI 回饋建議；不想公開的可以到「練習紀錄」設為隱藏。</p>
      ${rs.length ? SC.filter(s => rs.some(r => r.scenario_id === s.id)).map(s => `
        <section class="wall-group">
          ${scenarioBlock(s)}
          <div class="wall">${rs.filter(r => r.scenario_id === s.id).map(r => `
            <button class="wall-card ${drawn.has(r.id) ? "drawn" : ""}" data-id="${esc(r.id)}">
              <span class="wc-top">
                <span class="badge" style="color:${MCOLOR[r.method]}">${esc(M[r.method] ? M[r.method].name : "")}</span>
                ${st(r, 2) || st(r, 1) ? AI.starsHtml(st(r, 2) || st(r, 1), true) : ""}
                ${drawn.has(r.id) ? `<span class="badge accent">已抽</span>` : ""}
              </span>
              <span class="txt">${esc(compose(r.method, r.draft2))}</span>
              <span class="by">— ${esc(r.teacher_name)}${r.school ? "，" + esc(r.school) : ""}<span class="peek">看 AI 回饋 →</span></span>
            </button>`).join("")}</div>
        </section>`).join("")
        : `<div class="card empty">還沒有練習紀錄。<br>老師送出練習後，回應會自動出現在這裡。</div>`}`;
    document.getElementById("wSc").onchange = e => { wallSc = e.target.value; render(); };
    document.getElementById("noRep").onchange = e => { noRepeat = e.target.checked; };
    document.getElementById("draw").onclick = drawOne;
    if (proj) document.getElementById("exitProj").onclick = () => {
      proj = false; try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {} render();
    };
    else document.getElementById("proj").onclick = () => {
      proj = true; try { document.documentElement.requestFullscreen(); } catch (e) {} render();
    };
    v.querySelectorAll(".wall-card").forEach(c => c.onclick = () => {
      const r = data.find(x => String(x.id) === c.dataset.id); if (r) spotlight(r, { showAi: true });
    });
  }

  /* 大字聚焦卡：顯示老師回應與 AI 回饋 */
  function spotlight(r, opts) {
    const s = SC.find(x => x.id === r.scenario_id) || {};
    const fb = r.ai2 || r.ai1;
    const bg = document.createElement("div");
    bg.className = "spot-bg";
    const aiHtml = fb ? `${r.ai2 ? `<span class="badge accent">修改版的 AI 回饋</span>` : `<span class="badge">AI 回饋</span>`}${AI.render(fb)}`
      : `<p class="muted">這筆練習沒有 AI 回饋。</p>`;
    bg.innerHTML = `<div class="spot">
      <div class="spot-head">
        <span class="eyebrow">情境 ${esc(s.id || r.scenario_id)}・${esc(s.title || "")}</span>
        <button class="btn sm" data-close>關閉 ✕</button>
      </div>
      <h2 class="spot-name">${esc(r.teacher_name)}${r.school ? `<small>${esc(r.school)}</small>` : ""}</h2>
      <span class="badge" style="color:${MCOLOR[r.method]}">${esc(M[r.method] ? M[r.method].name : "")}</span>
      <div class="spot-txt">${esc(compose(r.method, r.draft2))}</div>
      <div class="spot-ai ${opts.showAi ? "" : "hidden"}">${aiHtml}</div>
      ${opts.showAi ? "" : `<div class="btn-row"><button class="btn primary" data-show>💡 顯示 AI 回饋建議</button></div>`}
    </div>`;
    document.body.appendChild(bg);
    const close = () => { bg.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    bg.onclick = e => { if (e.target === bg) close(); };
    bg.querySelector("[data-close]").onclick = close;
    const sh = bg.querySelector("[data-show]");
    if (sh) sh.onclick = () => { bg.querySelector(".spot-ai").classList.remove("hidden"); sh.parentNode.remove(); };
  }

  /* 抽籤：名字快速輪播後停在抽中的人 */
  function drawOne() {
    let pool = wallRows();
    if (noRepeat) {
      const left = pool.filter(r => !drawn.has(r.id));
      if (!left.length) {
        if (!confirm("這個範圍的回應都抽過了，要重新開始嗎？")) return;
        pool.forEach(r => drawn.delete(r.id));
      } else pool = left;
    }
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const bg = document.createElement("div");
    bg.className = "spot-bg";
    bg.innerHTML = `<div class="spot draw-box"><span class="eyebrow">抽籤中…</span><div class="draw-name" id="dn"></div><div class="draw-sub" id="ds"></div></div>`;
    document.body.appendChild(bg);
    const dn = bg.querySelector("#dn"), ds = bg.querySelector("#ds");
    let i = 0, delay = 50;
    const tick = () => {
      const r = pool[Math.floor(Math.random() * pool.length)];
      dn.textContent = r.teacher_name; ds.textContent = scName(r.scenario_id);
      i++; delay *= 1.12;
      if (i < 26) setTimeout(tick, delay);
      else {
        dn.textContent = pick.teacher_name; ds.textContent = scName(pick.scenario_id);
        bg.querySelector(".eyebrow").textContent = "🎉 抽中了！";
        dn.classList.add("hit");
        drawn.add(pick.id);
        setTimeout(() => { bg.remove(); render(); spotlight(pick, { showAi: false }); }, 1100);
      }
    };
    tick();
  }

  /* ---------- 匯出 CSV ---------- */
  function exportCsv() {
    const head = ["時間", "老師", "學校", "情境編號", "情境", "方法", "第一版", "修改版", "自評項數", "自評勾選", "第一版判斷式用語", "修改版判斷式用語", "修改心得", "用時(秒)", "作品牆", "AI 第一版回饋", "AI 修改版回饋", "AI 第一版星等", "AI 修改版星等"];
    const aiText = fb => fb ? [fb.summary, ...(fb.suggestions || []).map((s, i) => `建議${i + 1}：${s.point}`)].filter(Boolean).join("\n") : "";
    const q = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const rows = data.map(r => [
      new Date(r.created_at).toLocaleString("zh-TW", { hour12: false }), r.teacher_name, r.school || "", r.scenario_id,
      (SC.find(s => s.id === r.scenario_id) || {}).title || "", M[r.method] ? M[r.method].name : r.method,
      compose(r.method, r.draft1), compose(r.method, r.draft2), (r.checklist || []).length,
      (r.checklist || []).map(k => (CK.find(c => c.key === k) || {}).text || k).join("；"),
      hits(r, 1).join("、"), hits(r, 2).join("、"), r.reflection || "", r.duration_sec || "", r.hidden ? "隱藏" : "顯示", aiText(r.ai1), aiText(r.ai2), st(r, 1) || "", st(r, 2) || ""
    ].map(q).join(","));
    const csv = "﻿" + [head.map(q).join(","), ...rows].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `回饋練習紀錄_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- 本地測試資料 ---------- */
  function makeDemo() {
    const names = ["測試老師A", "測試老師B", "測試老師C", "測試老師D", "測試老師E", "測試老師F"];
    const schools = ["竹仁國小", "竹仁國小", "示範國小", "示範國小", "測試國小", "測試國小"];
    const methods = Object.keys(M).filter(k => !M[k].noModel);
    const bad = ["你總是不專心，", "怎麼又這樣？", "你就是不認真。", ""];
    const arr = Store._lsGet();
    names.forEach((n, i) => {
      const howMany = 2 + Math.floor(Math.random() * 6);
      const ids = SC.map(s => s.id).sort(() => Math.random() - .5).slice(0, i === 0 ? 7 : howMany);
      ids.forEach(id => {
        const s = SC.find(x => x.id === id);
        const m = methods[Math.floor(Math.random() * 3)];
        const d2 = Object.assign({}, s.models[m]);
        const d1 = Object.assign({}, d2);
        const b = bad[Math.floor(Math.random() * bad.length)];
        const firstKey = M[m].fields[0].key;
        if (b) d1[firstKey] = b + d1[firstKey];
        const words = window.JUDGMENT_WORDS.filter(w => compose(m, d1).includes(w));
        arr.push({
          id: Store.uuid(), created_at: new Date(Date.now() - Math.random() * 3 * 864e5).toISOString(),
          session_id: "demo-" + i, teacher_name: n, school: schools[i], scenario_id: id, method: m,
          draft1: d1, draft2: d2, checklist: CK.map(c => c.key).filter(() => Math.random() > .35),
          judgment_hits1: words, judgment_hits2: [], reflection: b ? "把評價學生的說法改成描述看到的行為。" : null,
          duration_sec: 120 + Math.floor(Math.random() * 300), hidden: false,
          ai1: Math.random() > .4 ? {
            stars: b ? 2 : 3, stars_reason: b ? "有評價學生的用語。" : "方向正確，下一步可以更具體。",
            summary: "（測試資料）你有接住學生的感受，整體方向很好。",
            strengths: ["有回應學生當下的反應", "語氣溫和"],
            suggestions: b ? [{ point: "把評價改成描述行為", why: "「" + b.replace(/[，。？]/g, "") + "」容易讓學生覺得被指責。", try: "我看到你剛剛……" }] : [{ point: "給一個更具體的下一步", why: "學生比較知道接下來怎麼做。", try: "我們先試試看第一步……" }],
            goal_check: "大致能達成教師目標。", rewrite: compose(m, d2)
          } : null,
          ai2: Math.random() > .5 ? { stars: b ? 4 : 5, stars_reason: "（測試資料）改成描述行為，並給了下一步。", summary: "修改版進步很多。", strengths: ["描述具體行為"], suggestions: [{ point: "可再加一句鼓勵", why: "", try: "我相信你做得到。" }], goal_check: "", rewrite: "" } : null
        });
      });
    });
    Store._lsSet(arr);
  }

  boot();
})();
