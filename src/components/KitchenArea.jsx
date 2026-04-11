import React, { useState } from 'react';
import { useAppContext } from '../store/Store';
import { ChefHat, Check, Trash2, ArrowRight, CheckCircle2, BellRing, PackageCheck, Edit } from 'lucide-react';
import OrderEditModal from './OrderEditModal';

const KitchenArea = () => {
  const { salesHistory, setSalesHistory } = useAppContext();
  const [dispatching, setDispatching] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  const changeStatus = (id, newStatus) => {
    setSalesHistory(salesHistory.map(sale => 
      sale.senha === id ? { ...sale, status: newStatus } : sale
    ));
  };

  const callAgain = (id) => {
    setSalesHistory((salesHistory || []).map(sale =>
      sale.senha === id ? { ...sale, callAgainAt: Date.now() } : sale
    ));
  };

  // Despachar TODOS os pedidos que estão "pronto"
  const dispatchAllReady = () => {
    const readyCount = (salesHistory || []).filter(s => s.status === 'pronto').length;
    if (readyCount === 0) return;
    setDispatching(true);
    setSalesHistory((salesHistory || []).map(sale =>
      sale.status === 'pronto' ? { ...sale, status: 'entregue' } : sale
    ));
    setTimeout(() => setDispatching(false), 1200);
  };

  const readyCount = (salesHistory || []).filter(s => s.status === 'pronto').length;

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
        
        {/* Botão Despachar Todos os Prontos */}
        <button 
          onClick={dispatchAllReady}
          disabled={readyCount === 0}
          className={`magnetic-btn relative px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all border 
            ${readyCount === 0 
              ? 'bg-white/5 text-gray-600 border-white/5 cursor-not-allowed' 
              : dispatching
                ? 'bg-lacasa-success text-white border-emerald-400/50 scale-95'
                : 'bg-lacasa-success/20 text-lacasa-success hover:bg-lacasa-success hover:text-white border-lacasa-success/30'
            }`}
        >
          <PackageCheck className={`w-5 h-5 ${dispatching ? 'animate-bounce' : ''}`} />
          {dispatching ? 'Despachando...' : 'Despachar Todos'}
          {readyCount > 0 && !dispatching && (
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-lacasa-success text-white text-xs font-black rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/50">
              {readyCount}
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
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-2xl">#{String(order.senha).padStart(3, '0')}</span>
                        <button onClick={() => setEditingOrder(order)} title="Editar pedido" className="p-1.5 text-gray-500 hover:text-lacasa-primary hover:bg-white/5 rounded-lg transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
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
                         <button onClick={() => callAgain(order.senha)} title="Chamar novamente na TV" className="bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white border border-amber-500/30 font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-all ml-auto">
                           <BellRing className="w-4 h-4"/> Chamar
                         </button>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
           </table>
         )}
      </div>

      {/* Modal de edição de pedido */}
      {editingOrder && (
        <OrderEditModal order={editingOrder} onClose={() => setEditingOrder(null)} />
      )}
    </div>
  );
};
export default KitchenArea;
