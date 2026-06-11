const CACHE = "delivery-rate-checker-v28";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./rates-data.js",
  "./rates.json",
  "./privacy.html",
  "./disclaimer.html",
  "./contact.html",
  "/privacy.html",
  "/disclaimer.html",
  "/contact.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./assets/app-icon-192.png",
  "./assets/app-icon-512.png",
  "./assets/app-icon-v2-192.png",
  "./assets/app-icon-v2-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => {
      if (event.request.mode === "navigate") return caches.match("./index.html");
      throw new Error("Network request failed");
    }))
  );
});
