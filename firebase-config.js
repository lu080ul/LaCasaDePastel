// ============================================================
// Firebase Config — La Casa de Pastel
// ============================================================
// INSTRUÇÕES:
// 1. Acesse https://console.firebase.google.com
// 2. Crie um projeto (ex: "la-casa-pdv")
// 3. Vá em Project Settings > General > Add App > Web
// 4. Copie o objeto firebaseConfig e substitua abaixo
// 5. No console, ative:
//    - Firestore Database (modo produção)
//    - Authentication > Email/Password
// ============================================================

const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "123456789",
    appId: "SEU_APP_ID"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ============================================================
// Helpers Firestore
// ============================================================

const FireDB = {
    // --- Products ---
    async loadProducts() {
        const snap = await db.collection('products').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    onProductsChange(callback) {
        return db.collection('products').onSnapshot(snap => {
            const prods = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(prods);
        });
    },

    async saveProduct(product) {
        const { id, ...data } = product;
        await db.collection('products').doc(String(id)).set(data);
    },

    async deleteProduct(id) {
        await db.collection('products').doc(String(id)).delete();
    },

    async saveAllProducts(products) {
        const batch = db.batch();
        products.forEach(p => {
            const { id, ...data } = p;
            batch.set(db.collection('products').doc(String(id)), data);
        });
        await batch.commit();
    },

    // --- Settings ---
    async loadSettings() {
        const doc = await db.collection('settings').doc('store').get();
        return doc.exists ? doc.data() : null;
    },

    onSettingsChange(callback) {
        return db.collection('settings').doc('store').onSnapshot(doc => {
            callback(doc.exists ? doc.data() : null);
        });
    },

    async saveSettings(settings) {
        await db.collection('settings').doc('store').set(settings, { merge: true });
    },

    // --- Orders ---
    async createOrder(order) {
        const ref = await db.collection('orders').add({
            ...order,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return ref.id;
    },

    onNewOrders(callback) {
        return db.collection('orders')
            .where('status', 'in', ['pendente', 'aprovado', 'preparando', 'pronto'])
            .orderBy('createdAt', 'desc')
            .onSnapshot(snap => {
                const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(orders);
            });
    },

    async updateOrderStatus(orderId, status) {
        await db.collection('orders').doc(orderId).update({ status });
    },

    onOrderStatus(orderId, callback) {
        return db.collection('orders').doc(orderId).onSnapshot(doc => {
            if (doc.exists) callback(doc.data());
        });
    },

    // --- Shift (turno) ---
    async saveShift(shiftData) {
        await db.collection('settings').doc('shift').set(shiftData);
    },

    async loadShift() {
        const doc = await db.collection('settings').doc('shift').get();
        return doc.exists ? doc.data() : null;
    }
};
