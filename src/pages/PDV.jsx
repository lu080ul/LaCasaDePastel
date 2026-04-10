import React, { useState } from 'react';
import Navigation from '../components/Navigation';
// Placeholder parts
import PosArea from '../components/PosArea';
import InventoryArea from '../components/InventoryArea';
import KitchenArea from '../components/KitchenArea';
import SettingsArea from '../components/SettingsArea';
import UpdateNotifier from '../components/UpdateNotifier';

const PDV = () => {
  const [activeTab, setActiveTab] = useState('caixa');

  return (
    <div className="min-h-[100dvh] w-full flex flex-col pt-28 pb-10 px-6 max-w-[1600px] mx-auto">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 w-full relative">
        {activeTab === 'caixa' && <PosArea />}
        {activeTab === 'estoque' && <InventoryArea />}
        {activeTab === 'cozinha' && <KitchenArea />}
        {activeTab === 'gerenciamento' && <SettingsArea />}
      </main>

      {/* Notificador de atualizações automáticas — aparece em qualquer aba */}
      <UpdateNotifier />
    </div>
  );
};

export default PDV;
