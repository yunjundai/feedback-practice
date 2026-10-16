/* ============================================================
   資料存取層：自動切換「本地模式」與「Supabase 雲端模式」
   ============================================================ */
window.Store = (function () {
  const cfg = window.APP_CONFIG || {};
  const cloud = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const LS_KEY = "fbp_attempts_v1";
  const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  let client = null;

  function uuid() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  function lsGet() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; }
  }
  function lsSet(arr) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch (e) { alertOnce(); }
  }
  let warned = false;
  function alertOnce() {
    if (!warned) { warned = true; console.warn("此瀏覽器無法使用本地儲存，資料不會被保留。"); }
  }
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("無法載入 Supabase 程式庫，請檢查網路"));
      document.head.appendChild(s);
    });
  }
  async function getClient() {
    if (client) return client;
    if (!window.supabase) await loadScript(SDK_URL);
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    return client;
  }

  /* ---------- 老師端：送出一筆練習 ---------- */
  async function saveAttempt(rec) {
    if (!cloud) {
      const arr = lsGet();
      arr.push(Object.assign({ id: uuid(), created_at: new Date().toISOString(), featured: false, hidden: false }, rec));
      lsSet(arr);
      return;
    }
    const c = await getClient();
    const { error } = await c.from("attempts").insert(rec);
    if (error) throw new Error(error.message);
  }

  /* ---------- 後台：讀取全部紀錄 ---------- */
  async function listAttempts() {
    if (!cloud) return lsGet().sort((a, b) => b.created_at.localeCompare(a.created_at));
    const c = await getClient();
    let all = [], from = 0, step = 1000;
    while (true) {
      const { data, error } = await c.from("attempts").select("*")
        .order("created_at", { ascending: false }).range(from, from + step - 1);
      if (error) throw new Error(error.message);
      all = all.concat(data);
      if (data.length < step) break;
      from += step;
    }
    return all;
  }

  async function setFeatured(id, value) {
    if (!cloud) {
      const arr = lsGet(); const r = arr.find(x => x.id === id);
      if (r) r.featured = value; lsSet(arr); return;
    }
    const c = await getClient();
    const { error } = await c.from("attempts").update({ featured: value }).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async function setHidden(id, value) {
    if (!cloud) {
      const arr = lsGet(); const r = arr.find(x => x.id === id);
      if (r) r.hidden = value; lsSet(arr); return;
    }
    const c = await getClient();
    const { error } = await c.from("attempts").update({ hidden: value }).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async function deleteAttempt(id) {
    if (!cloud) { lsSet(lsGet().filter(x => x.id !== id)); return; }
    const c = await getClient();
    const { error } = await c.from("attempts").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  /* ---------- 後台登入（雲端模式才需要） ---------- */
  async function currentAdmin() {
    if (!cloud) return { email: "本地測試模式" };
    const c = await getClient();
    const { data } = await c.auth.getSession();
    if (!data.session) return null;
    const { data: ok, error } = await c.rpc("is_admin");
    if (error || !ok) return { email: data.session.user.email, denied: true };
    return { email: data.session.user.email };
  }
  async function signIn(email, password) {
    const c = await getClient();
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === "Invalid login credentials" ? "帳號或密碼錯誤" : error.message);
  }
  async function signOut() {
    if (!cloud) return;
    const c = await getClient();
    await c.auth.signOut();
  }

  /* ---------- 本地模式專用 ---------- */
  function clearLocal() { lsSet([]); }

  return { mode: cloud ? "cloud" : "local", uuid, getClient, saveAttempt, listAttempts, setFeatured, setHidden, deleteAttempt,
           currentAdmin, signIn, signOut, clearLocal, _lsSet: lsSet, _lsGet: lsGet };
})();
