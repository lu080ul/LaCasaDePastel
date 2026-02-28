const CACHE_NAME = 'lacasa-pwa-v2';
const ASSETS_TO_CACHE = [
    '/pdv/',
    '/pdv/index.html',
    '/pdv/style.css',
    '/pdv/app.js',
    '/cliente/',
    '/cliente/index.html',
    '/cliente/style.css',
    '/cliente/app.js',
    '/icons/LogoLaCasa.jpg',
    '/firebase-config.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Cache aberto');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Limpando cache antigo:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Estratégia: Stale-While-Revalidate
self.addEventListener('fetch', event => {
    // Ignorar requisições do Firebase Firestore e Auth (que têm suas próprias lógicas)
    if (event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('identitytoolkit.googleapis.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(response => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                // Atualiza o cache com a resposta da rede se for válida
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Se falhar rede e não tiver no cache, pode retornar fallback para offline
                console.log('[SW] Falha na rede ao buscar:', event.request.url);
            });

            return response || fetchPromise;
        })
    );
});
