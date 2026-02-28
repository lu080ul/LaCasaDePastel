// ============================================================
// Firebase Config — La Casa de Pastel
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyCy3LJvSpLChOhZcywd6k490p8eqdze3Tk",
    authDomain: "la-casa-de-pastel-34cf3.firebaseapp.com",
    projectId: "la-casa-de-pastel-34cf3",
    storageBucket: "la-casa-de-pastel-34cf3.firebasestorage.app",
    messagingSenderId: "1072801934019",
    appId: "1:1072801934019:web:c181746ad42ba4ba45d076",
    measurementId: "G-3KV7DSJME9"
};

var db;
var messaging;

// Inicializa o Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();

    // Tenta inicializar Messaging (só funciona se a importação do script estiver no HTML)
    try {
        if (firebase.messaging.isSupported()) {
            messaging = firebase.messaging();
            console.log('📬 Firebase Cloud Messaging suportado e inicializado.');
        } else {
            console.warn('⚠️ Push Notifications não suportados neste navegador/SO.');
        }
    } catch (e) {
        console.warn('⚠️ Módulo de Messaging não carregado ou erro na inicialização:', e.message);
    }

    console.log('🔥 Firebase inicializado com sucesso');

    // Habilita persistência offline
    db.enablePersistence({ synchronizeTabs: true })
        .then(() => console.log('✅ Modo offline habilitado'))
        .catch(err => {
            if (err.code === 'failed-precondition') {
                console.warn('⚠️ Persistência offline não disponível (múltiplas abas abertas)');
            } else if (err.code === 'unimplemented') {
                console.warn('⚠️ Navegador não suporta persistência offline');
            }
        });
} else {
    console.error('❌ SDK do Firebase não encontrado. Verifique os scripts no HTML.');
}

// ============================================================
// Helpers Firestore
// ============================================================

var FireDB = {
    // --- Notificações ---
    async requestNotificationPermission() {
        if (!messaging) return null;
        try {
            console.log('Solicitando permissão de notificação...');
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('Permissão concedida!');
                // Requer a sua VAPID Key do Firebase Console, se não colocar ele auto-gera mas é melhor amarrar.
                // Como não temos a VAPID, vamos tentar pegar sem passar config.
                const token = await messaging.getToken();
                return token;
            } else {
                console.warn('Permissão de notificação negada pelo usuário.');
                return null;
            }
        } catch (error) {
            console.error('Erro ao pedir permissão de notificação:', error);
            return null;
        }
    },
    // --- Products ---
    async loadProducts() {
        try {
            const snap = await db.collection('products').get();
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error('❌ FireDB: Erro ao carregar produtos:', e.message);
            throw e;
        }
    },

    onProductsChange(callback) {
        return db.collection('products').onSnapshot(snap => {
            const prods = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(prods);
        }, err => console.error('❌ FireDB: Erro em onProductsChange:', err.message));
    },

    async saveProduct(product) {
        try {
            const { id, ...data } = product;
            await db.collection('products').doc(String(id)).set(data);
        } catch (e) {
            console.error('❌ FireDB: Erro ao salvar produto:', e.message);
            throw e;
        }
    },

    async deleteProduct(id) {
        try {
            await db.collection('products').doc(String(id)).delete();
        } catch (e) {
            console.error('❌ FireDB: Erro ao excluir produto:', e.message);
            throw e;
        }
    },

    async saveAllProducts(products) {
        try {
            const batch = db.batch();
            products.forEach(p => {
                const { id, ...data } = p;
                batch.set(db.collection('products').doc(String(id)), data);
            });
            await batch.commit();
        } catch (e) {
            console.error('❌ FireDB: Erro em saveAllProducts:', e.message);
            throw e;
        }
    },

    // --- Settings ---
    async loadSettings() {
        try {
            const doc = await db.collection('settings').doc('store').get();
            return doc.exists ? doc.data() : null;
        } catch (e) {
            console.error('❌ FireDB: Erro ao carregar configurações:', e.message);
            return null;
        }
    },

    onSettingsChange(callback) {
        return db.collection('settings').doc('store').onSnapshot(doc => {
            callback(doc.exists ? doc.data() : null);
        }, err => console.error('❌ FireDB: Erro em onSettingsChange:', err.message));
    },

    async saveSettings(settings) {
        try {
            await db.collection('settings').doc('store').set(settings, { merge: true });
        } catch (e) {
            console.error('❌ FireDB: Erro ao salvar configurações:', e.message);
            throw e;
        }
    },

    // --- Orders ---
    async createOrder(order) {
        try {
            const ref = await db.collection('orders').add({
                ...order,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return ref.id;
        } catch (e) {
            console.error('❌ FireDB: Erro ao criar pedido:', e.message);
            throw e;
        }
    },

    onNewOrders(callback) {
        return db.collection('orders')
            .where('status', 'in', ['pendente', 'aprovado', 'preparando', 'pronto'])
            .onSnapshot(snap => {
                const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                orders.sort((a, b) => {
                    const tA = a.createdAt?.toMillis?.() || 0;
                    const tB = b.createdAt?.toMillis?.() || 0;
                    return tB - tA;
                });
                callback(orders);
            }, error => {
                console.error('❌ FireDB: Erro ao escutar pedidos:', error.message);

                // Alerta prominente para o usuário
                let msg = 'Erro ao carregar pedidos: ' + error.message;
                if (error.code === 'permission-denied') {
                    msg = '⚠️ PERMISSÃO NEGADA: Verifique se o App Check ou as Regras do Firestore estão bloqueando o acesso.';
                } else if (error.message.includes('index')) {
                    msg = '⚠️ ÍNDICE NECESSÁRIO: Clique no link no console (F12) para criar o índice no Firebase.';
                }

                const banner = document.createElement('div');
                banner.style.cssText = 'position:fixed; top:0; left:0; width:100%; background:#e50914; color:white; padding:15px; text-align:center; z-index:10000; font-weight:bold; box-shadow:0 4px 10px rgba(0,0,0,0.5);';
                banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}`;
                document.body.prepend(banner);
            });
    },

    async updateOrderStatus(orderId, status, message = null) {
        try {
            const up = {};
            if (status) up.status = status;
            if (message) {
                up.lastMessage = message;
                up.messageAt = firebase.firestore.FieldValue.serverTimestamp();
            }
            await db.collection('orders').doc(orderId).update(up);
        } catch (e) {
            console.error('❌ FireDB: Erro ao atualizar status do pedido:', e.message);
            throw e;
        }
    },

    onOrderStatus(orderId, callback) {
        return db.collection('orders').doc(orderId).onSnapshot(doc => {
            if (doc.exists) callback(doc.data());
        }, err => console.error('❌ FireDB: Erro ao escutar status do pedido:', err.message));
    },

    // --- Shift (turno) ---
    async saveShift(shiftData) {
        try {
            await db.collection('settings').doc('shift').set(shiftData);
        } catch (e) {
            console.error('❌ FireDB: Erro ao salvar turno:', e.message);
            throw e;
        }
    },

    async loadShift() {
        try {
            const doc = await db.collection('settings').doc('shift').get();
            return doc.exists ? doc.data() : null;
        } catch (e) {
            console.error('❌ FireDB: Erro ao carregar turno:', e.message);
            return null;
        }
    }
};

