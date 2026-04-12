import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../store/Store';
import { ChefHat, Check, Trash2, ArrowRight, CheckCircle2, BellRing, PackageCheck, Edit } from 'lucide-react';
import OrderEditModal from './OrderEditModal';

const CALL_COOLDOWN_MS = 15000; // 15 seconds cooldown for "Chamar" button

const KitchenArea = () => {
  const { salesHistory, setSalesHistory } = useAppContext();
  const [editingOrder, setEditingOrder] = useState(null);
  const [callTimers, setCallTimers] = useState({}); // { [senha]: expiresAt }
  const [, forceUpdate] = useState(0); // tick for timer re-render

  // Tick every second to update the call timer progress bars
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 250);
    return () => clearInterval(interval);
  }, []);

  const changeStatus = (id, newStatus) => {
    setSalesHistory(salesHistory.map(sale => 
      sale.senha === id ? { ...sale, status: newStatus } : sale
    ));
  };

  const dispatchOrder = (id) => {
    setSalesHistory(salesHistory.map(sale =>
      sale.senha === id ? { ...sale, status: 'entregue' } : sale
    ));
  };

  const callAgain = (id) => {
    setSalesHistory((salesHistory || []).map(sale =>
      sale.senha === id ? { ...sale, callAgainAt: Date.now() } : sale
    ));
    // Set cooldown timer
    setCallTimers(prev => ({ ...prev, [id]: Date.now() + CALL_COOLDOWN_MS }));
  };

  const getCallProgress = (senha) => {
    const expiresAt = callTimers[senha];
    if (!expiresAt) return null;
    const now = Date.now();
    if (now >= expiresAt) return null;
    return (expiresAt - now) / CALL_COOLDOWN_MS; // 1.0 → 0.0
  };

  const activeOrders = (salesHistory || [])
    .filter(s => (s.status === 'preparando' || s.status === 'pronto') && !s.noSenha)
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
                  <th className="px-6 py-4 w-64 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map(order => {
                  const callProgress = getCallProgress(order.senha);
                  const isCalling = callProgress !== null;

                  return (
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
                         <div className="flex items-center gap-2 justify-end">
                           {/* Chamar novamente com animação de cooldown */}
                           <button 
                             onClick={() => !isCalling && callAgain(order.senha)} 
                             title="Chamar novamente na TV" 
                             disabled={isCalling}
                             className={`relative overflow-hidden font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-all border ${
                               isCalling
                                 ? 'bg-amber-500/10 text-amber-500/60 border-amber-500/20 cursor-not-allowed'
                                 : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white border-amber-500/30'
                             }`}
                           >
                             {/* Progress bar overlay */}
                             {isCalling && (
                               <div 
                                 className="absolute inset-0 bg-amber-500/15 rounded-xl transition-none"
                                 style={{ 
                                   width: `${(callProgress) * 100}%`,
                                   transition: 'width 0.25s linear'
                                 }}
                               />
                             )}
                             <BellRing className={`w-4 h-4 relative z-10 ${isCalling ? 'animate-[ring_0.5s_ease-in-out]' : ''}`}/>
                             <span className="relative z-10">{isCalling ? 'Chamando...' : 'Chamar'}</span>
                           </button>

                           {/* Botão Despachar individual */}
                           <button 
                             onClick={() => dispatchOrder(order.senha)} 
                             className="bg-lacasa-success/20 text-lacasa-success hover:bg-lacasa-success hover:text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-all border border-lacasa-success/30"
                           >
                             <PackageCheck className="w-4 h-4"/> Despachar
                           </button>
                         </div>
                       )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
           </table>
         )}
      </div>

      {/* Modal de edição de pedido */}
      {editingOrder && (
        <OrderEditModal order={editingOrder} onClose={() => setEditingOrder(null)} />
      )}

      {/* Keyframe for bell ring animation */}
      <style>{`
        @keyframes ring {
          0% { transform: rotate(0deg); }
          15% { transform: rotate(14deg); }
          30% { transform: rotate(-14deg); }
          45% { transform: rotate(10deg); }
          60% { transform: rotate(-10deg); }
          75% { transform: rotate(4deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
};
export default KitchenArea;
