const CACHE_NAME = "coroom-shell-v1";
const SUPABASE_JS_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js";

const SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./pwa.js",
  "./config.js",
  "./supabaseClient.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/favicon-16.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isShellAsset = url.origin === self.location.origin || req.url.startsWith(SUPABASE_JS_CDN);
  if (!isShellAsset) return; // supabase 데이터/인증 요청은 그대로 네트워크로 보낌다

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          if (cached) return cached;
          // 페이지 이동(navigation) 요청만 오프라인 쁘로 대체한다.
          // JS/CSS 등 다른 자산까지 index.html로 대체하면 잘못된 타입의 응답이 되어 스크립트 에러가 난다.
          if (req.mode === "navigate") return caches.match("./index.html");
          return Response.error();
        });
      return cached || networkFetch;
    })
  );
});
