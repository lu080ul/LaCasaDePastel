import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBBr3FiF8cx6IkmdqOuiiNtYUEtTUbS3wE",
  authDomain: "la-casa-pdv.firebaseapp.com",
  projectId: "la-casa-pdv",
  storageBucket: "la-casa-pdv.firebasestorage.app",
  messagingSenderId: "334343089554",
  appId: "1:334343089554:web:11b0cf48e7498fbb29e54b",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function initFirestore() {
  console.log('🚀 Inicializando Firestore...\n');

  try {
    await setDoc(doc(collection(db, 'products'), 'placeholder'), { temp: true, created: true });
    console.log('✅ Collection "products" criada');

    await setDoc(doc(collection(db, 'sales'), 'placeholder'), { temp: true, created: true });
    console.log('✅ Collection "sales" criada');

    await setDoc(doc(collection(db, 'settings'), 'placeholder'), { temp: true, created: true });
    console.log('✅ Collection "settings" criada');

    console.log('\n✨ Firestore inicializado com sucesso!');
    console.log('\nVocê pode agora deletar os documentos "placeholder" no Firebase Console se quiser.');
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

initFirestore();
