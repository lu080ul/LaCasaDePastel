import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadFromStorage, saveToStorage } from '../utils/LocalStorage';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [products, setProducts] = useState(() => loadFromStorage('lacasa_products', []));
  const [salesHistory, setSalesHistory] = useState(() => loadFromStorage('lacasa_history', []));
  const [shiftSales, setShiftSales] = useState(() => loadFromStorage('lacasa_shift', { count: 0, total: 0 }));
  const [currentOrderNumber, setCurrentOrderNumber] = useState(() => {
    const num = localStorage.getItem('lacasa_order_num');
    return num ? parseInt(num, 10) : 1;
  });
  
  // Settings / PIX
  const [pixKey, setPixKey] = useState(() => localStorage.getItem('lacasa_pix_key') || '');
  const [merchantName, setMerchantName] = useState(() => localStorage.getItem('lacasa_merchant_name') || 'La Casa de Pastel');
  const [merchantCity, setMerchantCity] = useState(() => localStorage.getItem('lacasa_merchant_city') || 'SAO PAULO');

  // Persistence Effects (Debounced to prevent UI freezing on large arrays)
  useEffect(() => { 
    const t = setTimeout(() => saveToStorage('lacasa_products', products), 100);
    return () => clearTimeout(t);
  }, [products]);
  
  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem('lacasa_history', JSON.stringify(salesHistory));
    }, 150);
    return () => clearTimeout(t);
  }, [salesHistory]);

  // Sincronização Cross-Tab (ex: TV Display)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'lacasa_history' && e.newValue) {
        try {
          setSalesHistory(JSON.parse(e.newValue));
        } catch(err) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  useEffect(() => { 
    const t = setTimeout(() => saveToStorage('lacasa_shift', shiftSales), 100);
    return () => clearTimeout(t);
  }, [shiftSales]);
  
  useEffect(() => { 
    const t = setTimeout(() => saveToStorage('lacasa_order_num', currentOrderNumber.toString()), 100);
    return () => clearTimeout(t);
  }, [currentOrderNumber]);
  
  useEffect(() => { saveToStorage('lacasa_pix_key', pixKey); }, [pixKey]);
  useEffect(() => { saveToStorage('lacasa_merchant_name', merchantName); }, [merchantName]);
  useEffect(() => { saveToStorage('lacasa_merchant_city', merchantCity); }, [merchantCity]);

  // Memoize context value to prevent unnecessary deep re-renders on every slight change
  const contextValue = React.useMemo(() => ({
      products, setProducts,
      salesHistory, setSalesHistory,
      shiftSales, setShiftSales,
      currentOrderNumber, setCurrentOrderNumber,
      pixKey, setPixKey,
      merchantName, setMerchantName,
      merchantCity, setMerchantCity
  }), [products, salesHistory, shiftSales, currentOrderNumber, pixKey, merchantName, merchantCity]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
