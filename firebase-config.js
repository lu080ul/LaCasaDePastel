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
