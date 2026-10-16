/* ============================================================
   老師練習頁
   ============================================================ */
(function () {
  const $app = document.getElementById("app");
  const CFG = window.APP_CONFIG || {};
  const SC = window.SCENARIOS, M = window.METHODS, CK = window.CHECKLIST, JW = window.JUDGMENT_WORDS;
  const SUBJ = { "數學": "math", "語文": "lang", "社會": "soc", "自然": "sci", "綜合": "gen" };
  const MICON = { sandwich: "🥪", sbi: "🔍", interactive: "💬", free: "✍️" };
  const STEP_NAMES = ["1 閱讀情境", "2 寫下回饋", "3 自我檢核", "4 對照與修改", "5 完成"];

  document.getElementById("siteTitle").textContent = CFG.SITE_TITLE || "有意義的回饋｜情境練習";
  document.getElementById("siteSub").textContent = CFG.SITE_SUBTITLE || "";
  document.title = CFG.SITE_TITLE || document.title;
  if (Store.mode === "local") document.getElementById("modeBanner").classList.remove("hidden");

  /* ---------- 工具 ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  function findJudgment(text) {
    const t = String(text || "");
    return JW.filter(w => t.includes(w));
  }
  function hitsOf(obj) {
    const set = new Set();
    Object.values(obj || {}).forEach(v => findJudgment(v).forEach(w => set.add(w)));
    return [...set];
  }
  function compose(method, obj) {
    obj = obj || {};
    const f = M[method].fields;
    if (method === "interactive") {
      return f.filter(x => obj[x.key]).map(x => (x.key.startsWith("t") ? "師：" : "生：") + obj[x.key]).join("\n");
    }
    return joinParts(f.map(x => (obj[x.key] || "").trim()).filter(Boolean), method === "sbi" ? "，" : "。");
  }
  function joinParts(parts, sep) {
    return parts.reduce((acc, p) => !acc ? p : acc + (/[，。！？；、：」）…,.!?]$/.test(acc) ? "" : sep) + p, "");
  }
  function filled(method, obj) {
    return M[method].fields.every(f => f.optional || (obj[f.key] || "").trim().length > 0);
  }

  /* ---------- 狀態 ---------- */
  let profile = ls.get("fbp_profile", null);
  let cur = null; // 目前練習

  function progressKey() { return profile ? profile.name + "|" + (profile.school || "") : ""; }
  function getDone() { return (ls.get("fbp_done_v1", {})[progressKey()]) || {}; }
  function addDone(id) {
    const all = ls.get("fbp_done_v1", {});
    const mine = all[progressKey()] || {};
    mine[id] = (mine[id] || 0) + 1;
    all[progressKey()] = mine;
    ls.set("fbp_done_v1", all);
  }

  function setWho() {
    const el = document.getElementById("who");
    if (!profile) { el.innerHTML = ""; return; }
    el.innerHTML = `${esc(profile.name)}${profile.school ? "（" + esc(profile.school) + "）" : ""}
      <button class="btn ghost sm" id="changeMe">更換</button>`;
    el.querySelector("#changeMe").onclick = () => { if (confirm("要更換練習者姓名嗎？")) { profile = null; ls.set("fbp_profile", null); render(); } };
  }

  /* ---------- 畫面：輸入姓名 ---------- */
  function renderLogin() {
    $app.innerHTML = `
      <div class="welcome">
        <div class="welcome-text">
          <span class="eyebrow">教師增能｜課堂情境練習</span>
          <h1>練習說出<br><em>有意義的回饋</em></h1>
          <p>${SC.length} 個真實課堂情境。選一種方法寫下你會怎麼對學生說，再由 AI 教練陪你修改得更好。</p>
          <ol class="flow">
            <li><b>1</b>閱讀情境</li><li><b>2</b>寫下回饋</li><li><b>3</b>自我檢核</li><li><b>4</b>AI 回饋與修改</li>
          </ol>
        </div>
        <div class="card login-card">
          <h2>開始練習</h2>
          <label class="field"><span>你的姓名</span><input type="text" id="nm" maxlength="40" autocomplete="name" placeholder="例：王小明"></label>
          <label class="field"><span>學校（選填）</span><input type="text" id="sc" maxlength="60" placeholder="例：竹仁國小"></label>
          <div class="notice small">練習內容會提供給研習講師查看，回饋裡請勿寫出真實學生的姓名。</div>
          <div class="btn-row"><button class="btn primary block" id="go">開始練習 →</button></div>
        </div>
      </div>`;
    const go = () => {
      const name = document.getElementById("nm").value.trim();
      if (!name) { document.getElementById("nm").focus(); return; }
      profile = { name, school: document.getElementById("sc").value.trim(), session_id: Store.uuid() };
      ls.set("fbp_profile", profile);
      render();
    };
    document.getElementById("go").onclick = go;
    document.getElementById("nm").onkeydown = e => { if (e.key === "Enter") go(); };
  }

  /* ---------- 畫面：情境列表 ---------- */
  function renderHome() {
    const done = getDone();
    const n = SC.filter(s => done[s.id]).length;
    $app.innerHTML = `
      <div class="home-hero">
        <div class="home-hero-text">
          <span class="eyebrow">歡迎回來</span>
          <h1>${esc(profile.name)}，你好！</h1>
          <p>選一個情境開始練習。可以依順序，也可以挑你最常遇到的。</p>
        </div>
        <div class="ring" role="img" aria-label="已完成 ${n} / ${SC.length}">
          <svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15.9"/><circle class="fg" cx="18" cy="18" r="15.9" stroke-dasharray="${Math.round(n / SC.length * 100)} 100"/></svg>
          <div class="ring-txt"><b>${n}</b><span>/ ${SC.length}</span><small>已完成</small></div>
        </div>
      </div>
      <h2 class="section-title">課堂情境</h2>
      <div class="grid">
        ${SC.map(s => `
          <button class="sc-card ${done[s.id] ? "done" : ""}" data-id="${s.id}">
            <span class="sc-top"><span class="num">${s.id}</span>${done[s.id] ? `<span class="done-mark" title="已練習 ${done[s.id]} 次">✓ ${done[s.id]} 次</span>` : ""}</span>
            <span class="ttl">${esc(s.title)}</span>
            <span class="meta">
              <span class="subj subj-${SUBJ[s.subject] || "gen"}">${esc(s.subject)}</span>
              <span class="go">${done[s.id] ? "再練一次" : "開始練習"} →</span>
            </span>
          </button>`).join("")}
      </div>`;
    $app.querySelectorAll(".sc-card").forEach(b => b.onclick = () => startPractice(+b.dataset.id));
  }

  function startPractice(id) {
    cur = { sc: SC.find(s => s.id === id), step: 1, method: null, d1: {}, check: [], d2: null, reflection: "", started: Date.now(), modelTab: null };
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- 畫面：練習 ---------- */
  function stepsBar() {
    return `<div class="steps">${STEP_NAMES.map((n, i) =>
      `<div class="st ${i + 1 === cur.step ? "on" : i + 1 < cur.step ? "done" : ""}"><span class="n">${i + 1}</span><span class="t">${n.replace(/^\d+\s*/, "")}</span></div>`).join("")}</div>`;
  }
  function scenarioBox(compact) {
    const s = cur.sc;
    return `<div class="scenario-box">
      <span class="eyebrow">模擬教學情境 ${s.id}・${esc(s.subject)}</span>
      <h2>${esc(s.title)}</h2>
      <div class="sb-sec"><div class="lbl"><i>📖</i>情境描述</div><p>${esc(s.description)}</p></div>
      <div class="sb-sec"><div class="lbl"><i>🎯</i>教師目標</div>${s.goals.length > 1 ? `<ul>${s.goals.map(g => `<li>${esc(g)}</li>`).join("")}</ul>` : `<p>${esc(s.goals[0])}</p>`}</div>
      ${compact ? "" : `<div class="sb-sec quote"><div class="lbl"><i>💬</i>學生反應</div><p>${esc(s.reaction)}</p></div>`}
    </div>`;
  }
  /* 精簡情境條：第 3、4 步固定顯示在最上方，可收合 */
  function scenarioMini() {
    const s = cur.sc;
    return `<div class="scenario-mini">
      <div class="sm-head">
        <b>情境 ${s.id}：${esc(s.title)}</b>
        <button class="btn ghost sm" id="scToggle">${cur.scHide ? "展開題目 ▾" : "收合 ▴"}</button>
      </div>
      ${cur.scHide ? "" : `
        <div class="sm-row"><span class="lbl">情境描述</span><span>${esc(s.description)}</span></div>
        <div class="sm-row"><span class="lbl">教師目標</span><span>${s.goals.map(esc).join("<br>")}</span></div>
        <div class="sm-row"><span class="lbl">學生反應</span><span>${esc(s.reaction)}</span></div>`}
    </div>`;
  }
  function fieldsHtml(prefix, obj) {
    return M[cur.method].fields.map(f => `
      <label class="field">
        <span>${esc(f.label)}</span>
        <div class="hint">${esc(f.hint)}</div>
        <textarea data-k="${f.key}" data-p="${prefix}" placeholder="${esc(f.placeholder)}" maxlength="600">${esc(obj[f.key] || "")}</textarea>
        <div class="jw" data-for="${prefix}-${f.key}"></div>
      </label>`).join("");
  }
  function jwHtml(words) {
    if (!words.length) return "";
    return `<div class="notice warn small">⚠ 這句話裡有「${words.map(esc).join("」「")}」，聽起來可能像是在評價學生。試著改成描述你看到的具體行為。</div>`;
  }
  function bindFields(prefix, obj, onChange) {
    $app.querySelectorAll(`textarea[data-p="${prefix}"]`).forEach(t => {
      const box = $app.querySelector(`.jw[data-for="${prefix}-${t.dataset.k}"]`);
      const upd = () => { obj[t.dataset.k] = t.value; box.innerHTML = jwHtml(findJudgment(t.value)); onChange && onChange(); };
      t.addEventListener("input", upd);
      box.innerHTML = jwHtml(findJudgment(t.value));
    });
  }

  function renderPractice() {
    const s = cur.sc;
    let body = "";

    if (cur.step === 1) {
      body = `
        ${scenarioBox()}
        <div class="card" style="margin-top:16px">
          <h2>你想用哪一種方法回饋這位學生？</h2>
          <div class="methods">
            ${Object.entries(M).map(([k, m]) => `
              <button class="method ${cur.method === k ? "sel" : ""}" data-m="${k}">
                <i class="m-ico">${MICON[k] || "✍️"}</i><b>${esc(m.name)}</b><span>${esc(m.desc)}</span>
              </button>`).join("")}
          </div>
          <div class="btn-row end">
            <button class="btn" id="back">回情境列表</button>
            <button class="btn primary" id="next" ${cur.method ? "" : "disabled"}>下一步：寫下回饋</button>
          </div>
        </div>`;
    }

    if (cur.step === 2) {
      body = `
        ${scenarioBox()}
        <div class="card" style="margin-top:16px">
          <h2>用「${esc(M[cur.method].name)}」寫下你會對學生說的話</h2>
          <p class="hint" style="margin-bottom:14px">想像學生就在你面前，用你平常說話的口吻寫。</p>
          ${fieldsHtml("d1", cur.d1)}
          <h3>完整說法預覽</h3>
          <div class="preview" id="pv">${esc(compose(cur.method, cur.d1)) || '<span class="muted">（開始輸入後會出現在這裡）</span>'}</div>
          <div class="btn-row end">
            <button class="btn" id="prev">上一步</button>
            <button class="btn primary" id="next">下一步：自我檢核</button>
          </div>
        </div>`;
    }

    if (cur.step === 3) {
      body = `
        ${scenarioMini()}
        <div class="card">
          <h2>自我檢核</h2>
          <p class="muted">重新讀一次你寫的回饋，勾選你覺得<strong>有做到</strong>的項目。</p>
          <div class="preview" style="margin-bottom:16px">${esc(compose(cur.method, cur.d1))}</div>
          ${CK.map(c => `
            <label class="check"><input type="checkbox" value="${c.key}" ${cur.check.includes(c.key) ? "checked" : ""}><span>${esc(c.text)}</span></label>`).join("")}
          <p class="hint">沒有勾到的項目沒關係，下一步對照示範後可以再修改。</p>
          <div class="btn-row end">
            <button class="btn" id="prev">上一步</button>
            <button class="btn primary" id="next">${aiRequired() ? "下一步：AI 回饋與修改" : "下一步：對照示範說法"}</button>
          </div>
        </div>`;
    }

    if (cur.step === 4) {
      if (!cur.d2) cur.d2 = Object.assign({}, cur.d1);
      if (!cur.modelTab) cur.modelTab = AI.available() ? "ai" : (s.models[cur.method] ? cur.method : "sandwich");
      const mdl = s.models[cur.modelTab] || {};
      body = `
        ${scenarioMini()}
        <div class="two-col">
          <div>
            <div class="card">
              <h2>${cur.modelTab === "ai" ? "AI 教練回饋" : "示範說法"}</h2>
              <div class="tabs">
                ${AI.available() ? `<button class="tab ${cur.modelTab === "ai" ? "on" : ""}" data-tab="ai">AI 教練</button>` : ""}
                ${Object.entries(M).filter(([k]) => s.models[k]).map(([k, m]) => `<button class="tab ${cur.modelTab === k ? "on" : ""}" data-tab="${k}">${esc(m.short)}</button>`).join("")}
              </div>
              ${cur.modelTab === "ai" ? aiPanel() : `
                <p class="hint">${esc(M[cur.modelTab].name)}的示範。示範只是其中一種說法，不是標準答案。看看有什麼可以借用的地方。</p>
                ${M[cur.modelTab].fields.filter(f => mdl[f.key]).map(f =>
                  `<p class="model-line"><b>${esc(f.label)}</b>${esc(mdl[f.key])}</p>`).join("")}`}
            </div>
            <div class="card">
              <h3>你的第一版</h3>
              <div class="preview">${esc(compose(cur.method, cur.d1))}</div>            </div>
          </div>
          <div class="card">
            <h2>修改你的回饋</h2>
            <p class="hint" style="margin-bottom:14px">已經幫你帶入第一版，直接修改即可；覺得不用改也可以直接送出。</p>
            ${fieldsHtml("d2", cur.d2)}
            <label class="field">
              <span>這次你修改了什麼？為什麼？（選填）</span>
              <textarea id="refl" maxlength="1000" placeholder="例：我把「你又在發呆」改成描述我看到的行為……">${esc(cur.reflection)}</textarea>
            </label>
            <div id="err"></div>
            <div class="btn-row end">
              <button class="btn" id="prev">上一步</button>
              ${AI.available() && cur.ai1 ? `<button class="btn" id="askAi2" ${cur.aiBusy ? "disabled" : ""}>請 AI 再看修改版</button>` : ""}
              <button class="btn primary" id="submit" ${submitLocked() ? "disabled" : ""}>${cur.aiBusy && aiRequired() ? "等待 AI 回饋…" : "送出這次練習"}</button>
            </div>
          </div>
        </div>`;
    }

    if (cur.step === 5) {
      const nextSc = SC.find(x => x.id > s.id && !getDone()[x.id]) || SC.find(x => !getDone()[x.id]);
      const h1 = hitsOf(cur.d1), h2 = hitsOf(cur.d2);
      body = `
        <div class="card">
          <h1>完成情境 ${s.id} 的練習 🎉</h1>
          <p class="muted">已經送出。以下是你最後的說法：</p>
          <div class="preview">${esc(compose(cur.method, cur.d2))}</div>
          ${cur.ai1 && cur.ai1.stars ? `<div class="star-sum">
            <span>AI 評分　第一版 ${AI.starsHtml(cur.ai1.stars)}</span>
            ${cur.ai2 && cur.ai2.stars ? `<span>→　修改版 ${AI.starsHtml(cur.ai2.stars)}</span>` : ""}
            ${cur.ai2 && cur.ai2.stars > cur.ai1.stars ? `<span class="badge ok">進步了 ${cur.ai2.stars - cur.ai1.stars} 顆星！</span>` : ""}
          </div>` : ""}
          ${h1.length && !h2.length ? `<div class="notice ok">你把第一版裡的判斷式用語都改掉了，很棒！</div>` : ""}
          ${h2.length ? `<div class="notice warn small">最後版本仍有「${h2.map(esc).join("」「")}」，下次可以留意。</div>` : ""}
          <div class="btn-row">
            <button class="btn" id="again">用別的方法再練一次</button>
            ${nextSc ? `<button class="btn primary" id="nextSc">下一個情境：${esc(nextSc.title)}</button>` : ""}
            <button class="btn" id="home">回情境列表</button>
          </div>
        </div>`;
      setTimeout(() => {
        document.getElementById("again").onclick = () => startPractice(s.id);
        document.getElementById("home").onclick = () => { cur = null; render(); };
        if (nextSc) document.getElementById("nextSc").onclick = () => startPractice(nextSc.id);
      });
    }

    $app.innerHTML = stepsBar() + body;
    bindStep();
  }

  function go(step) {
    // 第一版內容改過了，舊的 AI 回饋就作廢
    if (cur.ai1 && cur.ai1Sig !== sig1()) { cur.ai1 = null; cur.ai2 = null; cur.aiErr = null; }
    cur.step = step; render(); window.scrollTo(0, 0);
    const ready = aiRequired() && !(Store.mode === "local" && AI.needsLocalKey());
    // 加速：老師在第 3 步自我檢核時，就先在背景請 AI 看第一版
    // 進入第 4 步時通常已經有結果，不用再等
    if (ready && (step === 3 || step === 4) && !cur.ai1 && !(cur.aiBusy && cur.aiBusySig === sig1()) && !(step === 4 && cur.aiErr)) askAI(1, { silent: step === 3 });
  }
  function sig1() { return JSON.stringify([cur.method, cur.d1]); }
  function aiRequired() { return AI.available() && (window.APP_CONFIG || {}).AI_REQUIRED !== false; }
  // 必填 AI 時：AI 還沒回覆前不能送出（AI 服務失敗時仍可送出，避免卡住老師）
  function submitLocked() {
    if (!aiRequired()) return false;
    if (cur.aiBusy) return true;
    if (Store.mode === "local" && AI.needsLocalKey()) return false;
    return !cur.ai1 && !cur.aiErr;
  }

  function bindStep() {
    const q = id => document.getElementById(id);
    if (q("scToggle")) q("scToggle").onclick = () => { cur.scHide = !cur.scHide; renderPractice(); };
    if (cur.step === 1) {
      $app.querySelectorAll(".method").forEach(b => b.onclick = () => {
        if (cur.method && cur.method !== b.dataset.m && Object.values(cur.d1).some(v => v)) cur.d1 = {};
        cur.method = b.dataset.m; renderPractice();
      });
      q("back").onclick = () => { cur = null; render(); };
      q("next").onclick = () => go(2);
    }
    if (cur.step === 2) {
      bindFields("d1", cur.d1, () => {
        const t = compose(cur.method, cur.d1);
        q("pv").innerHTML = t ? esc(t) : '<span class="muted">（開始輸入後會出現在這裡）</span>';
      });
      q("prev").onclick = () => go(1);
      q("next").onclick = () => {
        if (!filled(cur.method, cur.d1)) { alertBox("請把每一格都寫完（標示「選填」的除外）。"); return; }
        go(3);
      };
    }
    if (cur.step === 3) {
      $app.querySelectorAll(".check input").forEach(c => c.onchange = () => {
        cur.check = [...$app.querySelectorAll(".check input:checked")].map(x => x.value);
      });
      q("prev").onclick = () => go(2);
      q("next").onclick = () => go(4);
    }
    if (cur.step === 4) {
      bindFields("d2", cur.d2);
      $app.querySelectorAll(".tab").forEach(t => t.onclick = () => { cur.modelTab = t.dataset.tab; renderPractice(); });
      q("refl").oninput = e => cur.reflection = e.target.value;
      if (q("askAi1")) q("askAi1").onclick = () => askAI(1);
      if (q("askAi2")) q("askAi2").onclick = () => askAI(2);
      if (q("aiRetry")) q("aiRetry").onclick = () => askAI(cur.aiErrVer || 1);
      if (q("aiSetOpen")) q("aiSetOpen").onclick = () => { cur.showAiSettings = true; renderPractice(); };
      if (q("aiSave")) q("aiSave").onclick = () => {
        AI.setLocalSettings({ provider: q("aiProv").value, model: q("aiModel").value.trim(), key: q("aiKey").value.replace(/[\s"'「」]/g, "") });
        cur.showAiSettings = false; cur.aiErr = null; renderPractice();
        if (aiRequired() && !cur.ai1 && !AI.needsLocalKey()) askAI(1);
      };
      if (q("aiProv")) q("aiProv").onchange = e => { q("aiModel").placeholder = "預設：" + AI.DEFAULTS[e.target.value]; };
      q("prev").onclick = () => go(3);
      q("submit").onclick = submit;
    }
  }

  /* ---------- AI 教練 ---------- */
  function aiPanel() {
    const note = `<p class="ai-tag">AI 建議僅供參考，請搭配你對學生的了解來判斷。${Store.mode === "local" ? ` <button class="btn ghost sm" id="aiSetOpen">AI 測試設定</button>` : ""}</p>`;
    if (Store.mode === "local" && (cur.showAiSettings || AI.needsLocalKey())) {
      const st = AI.getLocalSettings();
      return `
        <div class="notice small">本地測試用：請貼上您自己的 AI API 金鑰。金鑰只會存在這台電腦的瀏覽器裡，不會寫進任何檔案。正式上線後老師不需要設定。</div>
        <label class="field"><span>AI 服務</span>
          <select id="aiProv">
            <option value="gemini" ${st.provider === "gemini" ? "selected" : ""}>Google Gemini</option>
            <option value="anthropic" ${st.provider === "anthropic" ? "selected" : ""}>Anthropic Claude</option>
          </select></label>
        <label class="field"><span>模型（選填）</span><input type="text" id="aiModel" value="${esc(st.model)}" placeholder="預設：${esc(AI.DEFAULTS[st.provider])}"></label>
        <label class="field"><span>API 金鑰</span><input type="password" id="aiKey" value="${esc(st.key)}" autocomplete="off"></label>
        <div class="btn-row end" style="margin-top:0"><button class="btn primary" id="aiSave">儲存</button></div>`;
    }
    if (cur.aiBusy) return `<p><span class="spinner"></span> AI 正在閱讀你的回饋，大約需要 5～15 秒…</p>`;
    let html = "";
    if (cur.aiErr) html += `<div class="notice warn small">AI 回饋暫時無法取得：${esc(cur.aiErr)}</div><button class="btn sm" id="aiRetry">再試一次</button>`;
    if (cur.ai2) {
      html += `<span class="badge accent">修改版</span>${AI.render(cur.ai2)}
        <details style="margin-top:12px"><summary class="small muted">看第一版的 AI 回饋</summary>${AI.render(cur.ai1, { noRewrite: true })}</details>`;
    } else if (cur.ai1) {
      html += `<span class="badge">第一版</span>${AI.render(cur.ai1)}
        <p class="hint" style="margin-top:12px">參考建議修改右邊的內容後，可以按「請 AI 再看修改版」。</p>`;
    } else if (!cur.aiErr) {
      html += `<p class="muted">AI 教練會依照研習內容（三明治、SBI、描述式、互動提問、教師目標）看你的第一版，告訴你做得好的地方和可以調整的方向。</p>
        <button class="btn primary" id="askAi1">請 AI 看看我的第一版</button>`;
    }
    return html + note;
  }

  function aiPayload(version) {
    const m = M[cur.method], s = cur.sc;
    const toF = obj => m.fields.map(f => ({ label: f.label.replace(/^[①②③]\s*/, ""), value: (obj[f.key] || "").trim() }));
    return {
      scenario: { title: s.title, description: s.description, goals: s.goals, reaction: s.reaction },
      method_name: m.name, method_desc: m.desc,
      fields: toF(version === 2 ? cur.d2 : cur.d1),
      previous: version === 2 ? toF(cur.d1) : null,
      session_id: profile.session_id
    };
  }

  async function askAI(version, opts) {
    opts = opts || {};
    if (Store.mode === "local" && AI.needsLocalKey()) { cur.modelTab = "ai"; renderPractice(); return; }
    if (version === 2 && !filled(cur.method, cur.d2)) { document.getElementById("err").innerHTML = `<div class="notice warn">修改版每一格都要有內容（選填除外）。</div>`; return; }
    const me = cur, req = (cur.aiReq || 0) + 1, s1 = sig1();
    cur.aiReq = req; cur.aiBusy = true; cur.aiBusySig = version === 1 ? s1 : null; cur.aiErr = null; cur.modelTab = "ai";
    if (!opts.silent) renderPractice();
    let fb = null, err = null;
    try { fb = await AI.getFeedback(aiPayload(version)); } catch (e) { err = e.message; }
    if (cur !== me || me.aiReq !== req) return;   // 已經換題或有更新的請求，丟棄這次結果
    if (fb) { me["ai" + version] = fb; if (version === 1) { me.ai2 = null; me.ai1Sig = s1; } }
    else { me.aiErr = err; me.aiErrVer = version; }
    me.aiBusy = false;
    if (me.step === 4) renderPractice();
  }

  function alertBox(msg) {
    let el = document.getElementById("tmpAlert");
    if (!el) {
      el = document.createElement("div"); el.id = "tmpAlert"; el.className = "notice warn";
      const row = $app.querySelector(".btn-row"); row.parentNode.insertBefore(el, row);
    }
    el.textContent = msg;
  }

  async function submit() {
    if (!filled(cur.method, cur.d2)) { document.getElementById("err").innerHTML = `<div class="notice warn">修改版每一格都要有內容（選填除外）。</div>`; return; }
    const btn = document.getElementById("submit");
    btn.disabled = true; btn.textContent = "送出中…";
    const rec = {
      session_id: profile.session_id,
      teacher_name: profile.name,
      school: profile.school || null,
      scenario_id: cur.sc.id,
      method: cur.method,
      draft1: cur.d1,
      draft2: cur.d2,
      checklist: cur.check,
      judgment_hits1: hitsOf(cur.d1),
      judgment_hits2: hitsOf(cur.d2),
      reflection: cur.reflection || null,
      ai1: cur.ai1 || null,
      ai2: cur.ai2 || null,
      duration_sec: Math.round((Date.now() - cur.started) / 1000)
    };
    try {
      await Store.saveAttempt(rec);
      addDone(cur.sc.id);
      go(5);
    } catch (e) {
      btn.disabled = false; btn.textContent = "送出這次練習";
      document.getElementById("err").innerHTML = `<div class="notice warn">送出失敗：${esc(e.message)}。請稍後再按一次，你寫的內容還在。</div>`;
    }
  }

  /* ---------- 主控 ---------- */
  function render() {
    setWho();
    // 第 4 步左右兩欄，在電腦上使用較寬的版面
    $app.classList.toggle("narrow", !!(cur && cur.step !== 4));
    if (!profile) return renderLogin();
    if (!cur) return renderHome();
    renderPractice();
  }
  render();
})();
