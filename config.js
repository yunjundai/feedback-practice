/* ============================================================
   網站設定
   ------------------------------------------------------------
   ● 目前兩個欄位都是空的 → 「本地測試模式」
     資料只存在這台電腦的瀏覽器，方便您先確認內容。
   ● 確認完成、要上線時，填入 Supabase 專案的
     Project URL 與 anon public key，網站就會改用雲端資料庫。
     （在 Supabase：Project Settings → API 可以找到）
   ※ 只能填 anon public key，絕對不要填 service_role key！
   ============================================================ */
window.APP_CONFIG = {
  SUPABASE_URL: "https://tihxrudcwviwoxyimapg.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpaHhydWRjd3Zpd294eWltYXBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNjMyOTIsImV4cCI6MjEwNzczOTI5Mn0.d0YdF4nBcKK-mrp34elPVfrY_sIcuZ51JBI_SdAtaSI",

  // 是否開啟「AI 教練回饋」（false = 關閉，練習頁不會出現 AI 按鈕）
  AI_ENABLED: true,

  // 是否「必須」取得 AI 回饋（true = 進入第 4 步自動請 AI 給建議，AI 回覆前不能送出）
  AI_REQUIRED: true,

  // 網站標題（顯示在頁面上方）
  SITE_TITLE: "有意義的回饋｜情境練習",
  SITE_SUBTITLE: "竹仁國小 戴宇君老師"
};
