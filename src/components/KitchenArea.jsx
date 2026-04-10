import React, { useState } from 'react';
import { useAppContext } from '../store/Store';
import { ChefHat, Check, Trash2, ArrowRight, CheckCircle2, BellRing } from 'lucide-react';

const KitchenArea = () => {
  const { salesHistory, setSalesHistory } = useAppContext();
  const [calling, setCalling] = useState(false);

  const changeStatus = (id, newStatus) => {
    setSalesHistory(salesHistory.map(sale => 
      sale.senha === id ? { ...sale, status: newStatus } : sale
    ));
  };

  const callAllPending = () => {
    const pendingCount = (salesHistory || []).filter(s => s.status === 'preparando').length;
    if (pendingCount === 0) return;
    setCalling(true);
    setSalesHistory((salesHistory || []).map(sale =>
      sale.status === 'preparando' ? { ...sale, status: 'pronto' } : sale
    ));
    setTimeout(() => setCalling(false), 1200);
  };

  const pendingCount = (salesHistory || []).filter(s => s.status === 'preparando').length;

  const activeOrders = (salesHistory || [])
    .filter(s => s.status === 'preparando' || s.status === 'pronto')
    .sort((a,b) => (a.timestamp||0) - (b.timestamp||0));

  return (
    <div className="glass-panel p-10 rounded-[1.5rem] h-[calc(100vh-140px)] flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-lacasa-primary/20 rounded-2xl flex justify-center items-center border border-lacasa-primary/50">
            <ChefHat className="text-lacasa-primary w-8 h-8" />
          </div>
          <div>
            <h2 className="text-4xl font-bold tracking-tight">Pedidos & Despacho</h2>
            <span className="text-gray-400 font-medium">Controle da Fila de Preparo</span>
          </div>
        </div>
        
        <button 
          onClick={callAllPending}
          disabled={pendingCount === 0}
          className={`magnetic-btn relative px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all border 
            ${pendingCount === 0 
              ? 'bg-white/5 text-gray-600 border-white/5 cursor-not-allowed' 
              : calling
                ? 'bg-lacasa-success text-white border-emerald-400/50 scale-95'
                : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white border-amber-500/30'
            }`}
        >
          <BellRing className={`w-5 h-5 ${calling ? 'animate-bounce' : ''}`} />
          {calling ? 'Chamando...' : 'Chamar Pedidos'}
          {pendingCount > 0 && !calling && (
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 text-white text-xs font-black rounded-full flex items-center justify-center shadow-lg shadow-amber-500/50">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-lacasa-bg/50 border border-white/5 rounded-2xl relative">
         {activeOrders.length === 0 ? (
           <div className="flex flex-col items-center justify-center p-20 text-gray-400 opacity-50">
             <ChefHat className="w-16 h-16 mb-4" />
             <span className="font-bold tracking-widest uppercase">Nenhum Pedido na Fila</span>
           </div>
         ) : (
           <table className="w-full text-left border-collapse">
              <thead className="bg-white/5 text-sm font-bold text-gray-400 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="px-6 py-4 w-24">Senha</th>
                  <th className="px-6 py-4">Itens</th>
                  <th className="px-6 py-4 w-32">Status</th>
                  <th className="px-6 py-4 w-48 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map(order => (
                  <tr key={order.senha} className={`border-t border-white/5 transition-colors ${order.status === 'pronto' ? 'bg-lacasa-success/5 hover:bg-lacasa-success/10' : 'hover:bg-white/5'}`}>
                    <td className="px-6 py-4 font-mono font-black text-2xl">#{String(order.senha).padStart(3, '0')}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {(order.items || []).map((item, index) => (
                           <div key={index} className="flex flex-col mb-2">
                              <div className="text-md font-bold text-white">
                                 <span className="text-lacasa-primary font-mono mr-2">{item.qty}x</span>{item.name}
                              </div>
                              {(item.observation || (item.addons && item.addons.length > 0)) && (
                                 <div className="text-xs text-amber-500 ml-6 flex flex-col gap-0.5 mt-1 border-l-2 border-amber-500/30 pl-2">
                                    {item.observation && <div>Obs: {item.observation}</div>}
                                    {(item.addons||[]).map((ad, i) => <div key={i}>+ {ad.name}</div>)}
                                 </div>
                              )}
                           </div>
                        ))}
                        {order.observation && (
                           <div className="mt-2 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-amber-500 text-sm font-bold">
                             <span className="block text-xs uppercase tracking-wider text-amber-500/70 mb-1">Obs. Geral</span>
                             {order.observation}
                           </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs rounded-md font-bold uppercase tracking-widest border ${order.status === 'preparando' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-lacasa-success/20 text-lacasa-success border-lacasa-success/30'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       {order.status === 'preparando' ? (
                         <button onClick={() => changeStatus(order.senha, 'pronto')} className="bg-lacasa-success hover:bg-emerald-400 text-white font-bold py-2 px-4 rounded-xl shadow-lg border border-emerald-300/50 flex items-center gap-2 transition-all ml-auto">
                           <CheckCircle2 className="w-5 h-5"/> Pronto
                         </button>
                       ) : (
                         <button onClick={() => changeStatus(order.senha, 'entregue')} className="bg-lacasa-bg border border-white/10 hover:bg-white/10 text-gray-300 font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-all ml-auto">
                           <ArrowRight className="w-5 h-5"/> Despachar
                         </button>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
           </table>
         )}
      </div>

    </div>
  );
};
export default KitchenArea;
