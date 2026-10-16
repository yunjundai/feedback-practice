/* ============================================================
   AI 教練回饋
   ------------------------------------------------------------
   ● 本地測試模式：在練習頁的「AI 測試設定」貼上自己的 API 金鑰，
     金鑰只存在這台電腦的瀏覽器，不會寫進任何檔案。
   ● 雲端模式：網頁呼叫 Supabase Edge Function「ai-feedback」，
     金鑰放在 Supabase 的 Secrets，不會出現在網頁裡。
   ※ 正式版的提示詞在 supabase/functions/ai-feedback/index.ts，
     修改這裡的 SYSTEM_PROMPT 後，請一併複製過去。
   ============================================================ */
window.AI = (function () {
  const SYSTEM_PROMPT = `你是一位溫暖、專業的師資培育講師，正在協助國中小老師練習「有意義的回饋」。
老師會提供：一個課堂模擬情境、老師選用的回饋方法，以及老師打算對學生說的話。請你針對「老師的說法」給予指導建議。

【評估依據（研習內容）】
- 回饋是工具，不是武器；是溝通，不是指控；以信賴為基礎；提出有脈絡的觀察，而不是缺乏根據的評價；目的是幫助學生進步；要具體、不冗長。
- 兩觀念：及時、尊重。
- 三明治回饋法：先具體肯定 → 再提出具體可行的建議 → 最後表達鼓勵或信任。
- SBI 回饋法：S 情境（時間、地點、情況）→ B 行為（學生說了什麼、做了什麼，只描述不評價）→ I 影響（行為帶來的影響或感受）。
- 描述式而非判斷式：描述看得到的行為與事實，避免「總是、不認真、你就是……」這類評價人格的說法。
- 分享互動式：用開放式提問代替指正，接住學生的回答，引導學生自己找到下一步。
- 社會情緒學習（SEL）：同理學生的感受、維持良好關係、引導學生做出負責任的決定。
- 是否回應了情境中的「學生反應」，並能達成「教師目標」。
- 若老師選擇「其他（自由回饋）」，不要求特定格式，請依上述有意義回饋的共同原則（具體、描述式、尊重、以解決方案為導向、回應學生反應與教師目標）評估與評分；如果適合，也可以建議他參考某一種方法。

【你給回饋的原則（你自己也要示範有意義的回饋）】
- 先具體肯定老師做得好的地方（1～3 點），再給最多 3 點最重要的建議。
- 一定要給建議：即使老師寫得很好，也至少提供 1 點具體、可以更好的地方（suggestions 不可是空陣列，除非內容空白或與情境無關）。
- 每點建議都要具體、可操作，並附上一句老師可以直接替換使用的說法。
- 語氣像資深的同事夥伴：溫暖、尊重、不說教；使用台灣常用的繁體中文。
- 只評這段說法，不評價老師這個人。

【星等評分（1～5 顆星，整數）】依老師「這一版」的說法評分：
- 5 星：完整運用所選方法，描述具體行為、不帶評價，回應了學生的感受與反應，給出明確可行的下一步，能達成教師目標，幾乎可以直接對學生說。
- 4 星：大致完整，只有一處小地方可以更好（例如下一步不夠具體）。
- 3 星：方向正確，但缺少所選方法中的一個要素，或內容偏籠統。
- 2 星：出現明顯的判斷式或指責語句，或沒有回應學生反應、偏離教師目標。
- 1 星：以責備、貼標籤為主，可能讓學生更退縮；或內容空白、與情境無關。
評分要公正一致，不要因為鼓勵而灌水；stars_reason 用一句話說明給這個星等的主要原因。
- 「改寫參考」保留老師原本的想法與口吻，只做必要修改；要適合直接對學生說、學生聽得懂；不超過 150 字。若為分享互動式，請用「師：」「生：」「師：」的對話格式。
- 如果老師提供了第一版和修改版，請特別具體指出修改版進步的地方。
- 如果老師的內容空白、與情境無關或無法理解，請在 summary 溫和說明，其他欄位給空陣列或空字串。

【長度】回覆要精簡：每個欄位一到兩句，整份回饋（不含改寫參考）控制在 300 字以內。

【輸出格式】只輸出 JSON，不要有任何其他文字或程式碼區塊標記：
{"stars":3,"stars_reason":"一句話說明星等原因","summary":"一到兩句整體回饋","strengths":["做得好的地方"],"suggestions":[{"point":"建議重點","why":"為什麼這樣調整","try":"可以試著這樣說的一句話"}],"goal_check":"對照教師目標與學生反應的簡短說明","rewrite":"改寫參考"}`;

  const LS_KEY = "fbp_ai_local_v1";
  const DEFAULTS = {
    gemini: "gemini-flash-latest",
    anthropic: "claude-haiku-4-5"
  };

  function getLocalSettings() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "null") || { provider: "gemini", model: "", key: "" }; }
    catch (e) { return { provider: "gemini", model: "", key: "" }; }
  }
  function setLocalSettings(s) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {} }

  /* 整理成給 AI 的文字（雲端版 Edge Function 內有相同邏輯） */
  function buildUserMessage(p) {
    const lines = [];
    lines.push(`【情境】${p.scenario.title}`);
    lines.push(`情境描述：${p.scenario.description}`);
    lines.push(`教師目標：${p.scenario.goals.join("；")}`);
    lines.push(`學生反應：${p.scenario.reaction}`);
    lines.push("");
    lines.push(`【老師選用的方法】${p.method_name}（${p.method_desc}）`);
    if (p.previous && p.previous.length) {
      lines.push("");
      lines.push("【第一版】");
      p.previous.forEach(f => lines.push(`${f.label}：${f.value || "（空白）"}`));
      lines.push("");
      lines.push("【修改版（請針對這一版給回饋，並指出進步之處）】");
    } else {
      lines.push("");
      lines.push("【老師的說法】");
    }
    p.fields.forEach(f => lines.push(`${f.label}：${f.value || "（空白）"}`));
    return lines.join("\n").slice(0, 6000);
  }

  function parse(text) {
    let t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a >= 0 && b > a) t = t.slice(a, b + 1);
    const o = JSON.parse(t);
    return {
      stars: [1, 2, 3, 4, 5].includes(Math.round(Number(o.stars))) ? Math.round(Number(o.stars)) : null,
    stars_reason: String(o.stars_reason || ""),
    summary: String(o.summary || ""),
      strengths: Array.isArray(o.strengths) ? o.strengths.map(String).slice(0, 3) : [],
      suggestions: Array.isArray(o.suggestions) ? o.suggestions.slice(0, 3).map(s => ({ point: String(s.point || ""), why: String(s.why || ""), try: String(s.try || "") })) : [],
      goal_check: String(o.goal_check || ""),
      rewrite: String(o.rewrite || "")
    };
  }

  async function callLocal(userMsg) {
    const s = getLocalSettings();
    if (!s.key) throw new Error("尚未設定 AI 測試金鑰");
    const model = s.model || DEFAULTS[s.provider];
    if (s.provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json", "x-api-key": s.key, "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({ model, max_tokens: 1000, temperature: 0.4, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userMsg }] })
      });
      const j = await r.json();
      if (!r.ok) throw new Error((j.error && j.error.message) || ("HTTP " + r.status));
      return (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    }
    // 主要模型忙碌時，自動重試並改用備用模型
    const chain = [model, ...GEMINI_FALLBACKS.filter(m => m !== model)];
    let lastErr;
    for (const m of chain) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (NO_FAST.has(m)) return await callGemini(s.key, m, userMsg, false);
          try { return await callGemini(s.key, m, userMsg, true); }
          catch (e) {
            // 若模型不支援「關閉思考」的設定，記住並改用一般設定
            if (e.status === 400 && !/API key/i.test(e.message)) { NO_FAST.add(m); return await callGemini(s.key, m, userMsg, false); }
            throw e;
          }
        }
        catch (e) {
          lastErr = e;
          if (!e.busy) throw e;
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
    }
    throw lastErr;
  }

  const NO_FAST = new Set();
  const GEMINI_FALLBACKS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash"];

  async function callGemini(key, model, userMsg, fast) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userMsg }] }],
        generationConfig: Object.assign({ temperature: 0.4, maxOutputTokens: 1200, responseMimeType: "application/json" },
          fast ? { thinkingConfig: { thinkingBudget: 0 } } : {})
      })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error((j.error && j.error.message) || ("HTTP " + r.status));
      err.status = r.status;
      // 503 忙碌、500 暫時錯誤、404 模型不存在 → 換下一個模型
      err.busy = r.status === 503 || r.status === 500 || r.status === 404 || /high demand|overloaded|UNAVAILABLE/i.test(err.message);
      throw err;
    }
    const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
    return parts.filter(p => p.text && !p.thought).map(p => p.text).join("");
  }

  async function callCloud(payload) {
    const c = await Store.getClient();
    const { data, error } = await c.functions.invoke("ai-feedback", { body: payload });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) {}
      throw new Error(msg);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  }

  /* payload: { scenario, method_name, method_desc, fields:[{label,value}], previous? } */
  function friendly(msg) {
    const m = String(msg || "");
    if (/API key not valid|API_KEY_INVALID|invalid x-api-key|authentication_error/i.test(m))
      return "金鑰無效。請確認有完整複製（Gemini 金鑰以 AIza 開頭、共 39 個字元，前後不能有空白），或重新建立一把金鑰。";
    if (/high demand|overloaded|UNAVAILABLE|503/i.test(m)) return "Google 的 AI 服務目前使用的人很多，已自動重試和換用備用模型仍然忙碌。請等 1～2 分鐘再按一次。";
    if (/quota|RESOURCE_EXHAUSTED|rate limit|429/i.test(m)) return "已達到 AI 服務的使用額度上限，請稍後再試。";
    if (/not found|is not supported|NOT_FOUND/i.test(m)) return "找不到這個模型，請在 AI 測試設定把「模型」欄位清空，改用預設值。";
    if (/Failed to fetch|NetworkError/i.test(m)) return "無法連線到 AI 服務，請檢查網路。";
    return m;
  }

  async function getFeedback(payload) {
    try {
      if (Store.mode === "cloud") return parse(JSON.stringify(await callCloud(payload)));
      return parse(await callLocal(buildUserMessage(payload)));
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error("AI 回傳的格式不完整，請再按一次。");
      throw new Error(friendly(e.message));
    }
  }

  function available() {
    const cfg = window.APP_CONFIG || {};
    if (cfg.AI_ENABLED === false) return false;
    return true;
  }
  function needsLocalKey() { return Store.mode === "local" && !getLocalSettings().key; }

  /* 畫出 AI 回饋（練習頁與後台共用） */
  function render(fb, opts) {
    opts = opts || {};
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    if (!fb) return "";
    return `<div class="ai-fb">
      ${fb.stars ? `<div class="ai-stars">${starsHtml(fb.stars)}<b>${fb.stars} / 5</b>${fb.stars_reason ? `<div class="small muted">${esc(fb.stars_reason)}</div>` : ""}</div>` : ""}
      ${fb.summary ? `<p class="ai-sum">${esc(fb.summary)}</p>` : ""}
      ${fb.strengths.length ? `<h4>👍 做得好的地方</h4><ul>${fb.strengths.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
      ${fb.suggestions.length ? `<h4>💡 可以再調整</h4>${fb.suggestions.map(s => `
        <div class="ai-sug"><b>${esc(s.point)}</b>${s.why ? `<div class="small muted">${esc(s.why)}</div>` : ""}${s.try ? `<div class="ai-try">${esc(s.try)}</div>` : ""}</div>`).join("")}` : ""}
      ${fb.goal_check ? `<h4>🎯 對照教師目標</h4><p class="small">${esc(fb.goal_check)}</p>` : ""}
      ${fb.rewrite && !opts.noRewrite ? `<h4>✏️ 改寫參考</h4><div class="preview small">${esc(fb.rewrite)}</div>` : ""}
    </div>`;
  }

  function starsHtml(n, small) {
    if (!n) return "";
    return `<span class="stars${small ? " sm" : ""}" aria-label="${n} 顆星">${"★".repeat(n)}<span class="off">${"★".repeat(5 - n)}</span></span>`;
  }

  return { starsHtml, getFeedback, render, available, needsLocalKey, getLocalSettings, setLocalSettings, DEFAULTS, SYSTEM_PROMPT, buildUserMessage, parse };
})();
