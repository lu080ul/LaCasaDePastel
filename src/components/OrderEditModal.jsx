import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/Store';
import { X, Plus, Minus, Trash2, CreditCard, DollarSign, QrCode, Search, Save, AlertTriangle } from 'lucide-react';

/**
 * Modal para editar um pedido já finalizado.
 * Permite remover/adicionar itens e alterar a forma de pagamento.
 * Recalcula o total automaticamente e ajusta o faturamento do turno.
 *
 * Props:
 *  - order: o objeto do pedido (de salesHistory)
 *  - onClose: fecha o modal
 */
const OrderEditModal = ({ order, onClose }) => {
  const { products, salesHistory, setSalesHistory, shiftSales, setShiftSales } = useAppContext();

  // Cópia editável dos itens
  const [editItems, setEditItems] = useState(() =>
    (order.items || []).map(item => ({ ...item, addons: [...(item.addons || [])] }))
  );
  const [editPayment, setEditPayment] = useState(order.pagamento || 'Dinheiro');
  const [search, setSearch] = useState('');

  const availableProducts = useMemo(() => {
    return (products || []).filter(p =>
      p.active !== false && !p.isAddon && (p.name || '').toLowerCase().includes((search || '').toLowerCase())
    );
  }, [products, search]);

  const getItemUnitPrice = (item) => {
    const addonsTotal = (item.addons || []).reduce((sum, ad) => sum + (parseFloat(ad.price) || 0), 0);
    return (parseFloat(item.price) || 0) + addonsTotal;
  };

  const newTotal = editItems.reduce((acc, item) => acc + (getItemUnitPrice(item) * item.qty), 0);
  const totalDiff = newTotal - (order.total || 0);

  const updateQty = (cartItemId, delta) => {
    const item = editItems.find(i => i.cartItemId === cartItemId);
    if (!item) return;
    const newQty = item.qty + delta;
    if (newQty <= 0) {
      setEditItems(editItems.filter(i => i.cartItemId !== cartItemId));
    } else {
      setEditItems(editItems.map(i => i.cartItemId === cartItemId ? { ...i, qty: newQty } : i));
    }
  };

  const removeItem = (cartItemId) => {
    setEditItems(editItems.filter(i => i.cartItemId !== cartItemId));
  };

  const addProduct = (product) => {
    const existingIndex = editItems.findIndex(i => i.productId === product.id && !i.observation && (!i.addons || i.addons.length === 0));
    if (existingIndex >= 0) {
      const newItems = [...editItems];
      newItems[existingIndex].qty += 1;
      setEditItems(newItems);
    } else {
      setEditItems([...editItems, {
        cartItemId: Date.now() + Math.random(),
        productId: product.id,
        name: product.name,
        price: product.price,
        qty: 1,
        observation: '',
        addons: []
      }]);
    }
  };

  const saveChanges = () => {
    if (editItems.length === 0) {
      if (!window.confirm('O pedido ficará sem itens. Deseja estornar/cancelar este pedido?')) return;
    }

    const updatedOrder = {
      ...order,
      items: editItems,
      total: newTotal,
      pagamento: editPayment,
      // Recalcular troco se dinheiro
      troco: 0,
      editedAt: Date.now()
    };

    setSalesHistory(salesHistory.map(s =>
      s.senha === order.senha && s.timestamp === order.timestamp ? updatedOrder : s
    ));

    // Ajustar faturamento do turno
    if (editItems.length === 0) {
      // Pedido cancelado — remover do turno
      setShiftSales({ count: shiftSales.count - 1, total: shiftSales.total - order.total });
    } else {
      setShiftSales({ ...shiftSales, total: shiftSales.total + totalDiff });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-2xl rounded-[2rem] shadow-2xl scale-in-center overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex justify-between items-center p-6 pb-4 border-b border-white/10 shrink-0">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-3">
              Editar Pedido <span className="text-lacasa-primary font-mono">#{String(order.senha).padStart(3, '0')}</span>
            </h3>
            <span className="text-sm text-gray-500">Altere itens ou forma de pagamento</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Body — scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">

          {/* Itens atuais */}
          <div>
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Itens do Pedido</h4>
            {editItems.length === 0 ? (
              <div className="text-center py-6 text-gray-500 italic flex flex-col items-center gap-2">
                <AlertTriangle className="w-8 h-8 text-amber-500/50" />
                Todos os itens foram removidos. Salvar irá cancelar o pedido.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {editItems.map(item => (
                  <div key={item.cartItemId} className="flex items-center gap-3 p-3 rounded-xl bg-lacasa-bg/50 border border-white/5">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate">{item.name}</div>
                      <div className="text-xs text-gray-400 font-mono">
                        R$ {getItemUnitPrice(item).toFixed(2)} × {item.qty} = R$ {(getItemUnitPrice(item) * item.qty).toFixed(2)}
                      </div>
                      {item.observation && <div className="text-xs text-amber-500 mt-1">Obs: {item.observation}</div>}
                      {(item.addons || []).map((ad, i) => (
                        <div key={i} className="text-xs text-emerald-400 ml-1">+ {ad.name} (R$ {Number(ad.price || 0).toFixed(2)})</div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-lacasa-panel p-1 rounded-full border border-white/5">
                        <button onClick={() => updateQty(item.cartItemId, -1)} className="w-7 h-7 rounded-full bg-white/5 flex justify-center items-center hover:bg-white/10 transition-colors">
                          <Minus className="w-3 h-3 text-gray-300" />
                        </button>
                        <span className="font-mono font-bold w-5 text-center text-sm">{item.qty}</span>
                        <button onClick={() => updateQty(item.cartItemId, 1)} className="w-7 h-7 rounded-full bg-white/5 flex justify-center items-center hover:bg-white/10 transition-colors">
                          <Plus className="w-3 h-3 text-gray-300" />
                        </button>
                      </div>
                      <button onClick={() => removeItem(item.cartItemId)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adicionar produto */}
          <div>
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Adicionar Produto</h4>
            <div className="flex items-center gap-2 bg-lacasa-bg/50 border border-white/10 rounded-xl px-3 py-2 mb-3">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar produto..."
                className="bg-transparent border-none outline-none text-white w-full text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {availableProducts.slice(0, 20).map(p => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3 h-3" /> {p.name} <span className="text-blue-300/60 font-mono">R${Number(p.price).toFixed(2)}</span>
                </button>
              ))}
              {availableProducts.length === 0 && (
                <span className="text-xs text-gray-500 italic">Nenhum produto encontrado</span>
              )}
            </div>
          </div>

          {/* Forma de pagamento */}
          <div>
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Forma de Pagamento</h4>
            <div className="grid grid-cols-3 gap-2">
              {['Dinheiro', 'Cartão', 'Pix'].map(method => (
                <button
                  key={method}
                  onClick={() => setEditPayment(method)}
                  className={`py-2.5 rounded-xl font-bold text-sm transition-all border ${
                    editPayment === method
                      ? 'bg-lacasa-primary/20 border-lacasa-primary text-lacasa-primary shadow-[inset_0_0_20px_rgba(225,29,72,0.2)]'
                      : 'bg-lacasa-bg/50 border-white/5 text-gray-400 hover:bg-lacasa-bg'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-white/10 shrink-0 space-y-3">
          {/* Resumo */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-400">
              Anterior: <span className="font-mono font-bold text-gray-300">R$ {(order.total || 0).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-3">
              {totalDiff !== 0 && (
                <span className={`text-sm font-bold font-mono ${totalDiff > 0 ? 'text-red-400' : 'text-lacasa-success'}`}>
                  {totalDiff > 0 ? '+' : ''}R$ {totalDiff.toFixed(2)}
                </span>
              )}
              <span className="text-2xl font-black text-lacasa-success font-mono">
                R$ {newTotal.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 transition-colors">
              Cancelar
            </button>
            <button
              onClick={saveChanges}
              className="flex-1 py-3 rounded-xl font-bold bg-lacasa-primary hover:bg-rose-500 text-white shadow-[0_4px_15px_rgba(225,29,72,0.3)] transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" /> Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderEditModal;
