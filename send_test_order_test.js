const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');

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

async function sendTestOrder() {
    console.log('⏳ Enviando pedido de teste...');
    const order = {
        items: [{ id: "test-prod", name: "🥟 Pastel de Teste (Bot)", price: 1.0, qty: 1 }],
        total: 1.0,
        tipo: "retirada",
        pagamento: "Dinheiro",
        contato: "Robô de Teste - (11) 98888-8888",
        nome: "Robô de Teste",
        whatsapp: "11988888888",
        status: "pendente",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        const ref = await db.collection('orders').add(order);
        console.log('✅ Pedido de teste enviado com ID:', ref.id);
        process.exit(0);
    } catch (e) {
        console.error('❌ Erro ao enviar pedido:', e.message);
        process.exit(1);
    }
}

sendTestOrder();
