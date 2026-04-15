import { useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc, getDocs } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { useAppContext } from '../store/Store';

export const useFirebaseSync = () => {
  const { products, setProducts, salesHistory, setSalesHistory, shiftSales, setShiftSales } = useAppContext();
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isFirebaseConfigured() || isInitialized.current) return;
    isInitialized.current = true;

    const syncToLocal = async () => {
      try {
        const productsSnap = await getDocs(collection(db, 'products'));
        const productsData = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (productsData.length > 0) {
          setProducts(productsData);
          localStorage.setItem('lacasa_products', JSON.stringify(productsData));
        }

        const historySnap = await getDocs(collection(db, 'sales'));
        const historyData = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (historyData.length > 0) {
          setSalesHistory(historyData);
          localStorage.setItem('lacasa_history', JSON.stringify(historyData));
        }

        const settingsSnap = await getDocs(collection(db, 'settings'));
        if (!settingsSnap.empty) {
          const s = settingsSnap.docs[0].data();
          localStorage.setItem('lacasa_pix_key', s.pixKey || '');
          localStorage.setItem('lacasa_merchant_name', s.merchantName || 'La Casa de Pastel');
          localStorage.setItem('lacasa_merchant_city', s.merchantCity || 'SAO PAULO');
        }
      } catch (err) {
        console.error('Erro na sincronização inicial:', err);
      }
    };

    syncToLocal();
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const productsRef = collection(db, 'products');
    const unsubscribe = onSnapshot(productsRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length > 0) {
        localStorage.setItem('lacasa_products', JSON.stringify(data));
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const settingsRef = collection(db, 'settings');
    const unsubscribe = onSnapshot(settingsRef, (snap) => {
      if (!snap.empty) {
        const s = snap.docs[0].data();
        localStorage.setItem('lacasa_pix_key', s.pixKey || '');
        localStorage.setItem('lacasa_merchant_name', s.merchantName || 'La Casa de Pastel');
        localStorage.setItem('lacasa_merchant_city', s.merchantCity || 'SAO PAULO');
      }
    });

    return () => unsubscribe();
  }, []);
};

export default useFirebaseSync;
