const CACHE_NAME = 'lacasa-cache-v1';
const ASSETS = [
    '/cliente/index.html',
    '/cliente/app.js',
    '/style.css',
    '/firebase-config.js',
    '/icons/LogoLaCasa.jpg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});
