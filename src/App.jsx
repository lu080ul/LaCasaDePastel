import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './store/Store';
import PDV from './pages/PDV';
import TVDisplay from './pages/TVDisplay';
import DespachoDisplay from './pages/DespachoDisplay';
import AdminPage from './components/admin/AdminPage';
import LoginPage from './pages/LoginPage';

function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<PDV />} />
        <Route path="/tv" element={<TVDisplay />} />
        <Route path="/despacho" element={<DespachoDisplay />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </AppProvider>
  );
}

export default App;
