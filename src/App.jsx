import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './store/Store';
import PDV from './pages/PDV';
import TVDisplay from './pages/TVDisplay';

function App() {
  return (
    <AppProvider>
      <Routes>
        {/* PDV Main Route - Handles all internal tabs like Pos, Inventory, etc. */}
        <Route path="/" element={<PDV />} />
        
        {/* TV Display Route - Cinematic TV Screen */}
        <Route path="/tv" element={<TVDisplay />} />
      </Routes>
    </AppProvider>
  );
}

export default App;
