// 서비스 워커: 앱 설치(PWA)와 오프라인 실행
// - 앱 파일: 미리 저장(설치 시)
// - 라이브러리·지도 자료·글꼴·국기(CDN): 한 번 받으면 저장해 두고 사용
// - 날씨 API: 항상 새로 받되, 실패하면(오프라인) 마지막으로 받은 값을 사용
const VERSION = "v1";
const APP = `weather-app-${VERSION}`;
const CDN = "weather-cdn-v1";
const API = "weather-api-v1";
const APP_FILES = [
  "./", "./index.html", "./cities.js", "./korea_provinces.js", "./mdl.js", "./world_cities.js",
  "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/favicon-32.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("weather-app-") && k !== APP).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "api.open-meteo.com") {
    e.respondWith(networkFirst(req, API));
  } else if (/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) {
    e.respondWith(cacheFirst(req, CDN));
  } else if (url.origin === location.origin) {
    // 앱 파일: 새 버전을 우선 받고, 오프라인이면 저장본
    e.respondWith(networkFirst(req, APP, true));
  }
});

async function networkFirst(req, cacheName, ignoreSearch = false) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch });
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}
