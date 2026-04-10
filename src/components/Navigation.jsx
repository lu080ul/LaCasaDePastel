import React from 'react';
import { ShoppingCart, Box, Settings, ClipboardList } from 'lucide-react';

const Navigation = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'caixa', label: 'Caixa', icon: ShoppingCart },
    { id: 'cozinha', label: 'Pedidos', icon: ClipboardList },
    { id: 'estoque', label: 'Estoque', icon: Box },
    { id: 'gerenciamento', label: 'Ajustes', icon: Settings },
  ];

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-40">
      <nav className="glass-panel rounded-full px-4 py-2 flex items-center gap-2 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] backdrop-blur-md bg-lacasa-panel/80">
        


        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`magnetic-btn flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors ${
                isActive 
                  ? 'bg-lacasa-primary text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}

      </nav>
    </div>
  );
};

export default Navigation;
