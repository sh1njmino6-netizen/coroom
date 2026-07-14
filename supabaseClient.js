// coroom - Supabase 클라이언트 초기화
// 이 파일은 config.js, 그리고 CDN에서 로드된 supabase-js(전역 `supabase`) 이후에 로드되어야 합니다.
(function () {
  if (!window.SUPABASE_CONFIG) {
    console.error("SUPABASE_CONFIG가 없습니다. config.js가 먼저 로드되었는지 확인하세요.");
    return;
  }
  window.supabaseClient = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
  );
})();
