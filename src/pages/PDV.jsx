import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import PosArea from '../components/PosArea';
import InventoryArea from '../components/InventoryArea';
import KitchenArea from '../components/KitchenArea';
import SettingsArea from '../components/SettingsArea';
import UpdateNotifier from '../components/UpdateNotifier';
import { ExternalLink, Lock } from 'lucide-react';

const PDV = () => {
  const [activeTab, setActiveTab] = useState('caixa');

  return (
    <div className="min-h-[100dvh] w-full flex flex-col pt-28 pb-10 px-6 max-w-[1600px] mx-auto">
      <div className="fixed top-6 right-6 z-50">
        <Link 
          to="/admin" 
          className="glass-panel p-3 rounded-full hover:bg-white/10 transition-colors group"
          title="Painel Admin (requer login)"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-gray-400 group-hover:text-lacasa-primary transition-colors" />
            <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-lacasa-primary transition-colors" />
          </div>
        </Link>
      </div>
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
