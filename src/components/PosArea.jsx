import React, { useState, useEffect } from 'react';
import { loadFromStorage, saveToStorage } from '../utils/LocalStorage';
import { useAppContext } from '../store/Store';
import { Search, Plus, Minus, Trash2, CheckCircle2, DollarSign, CreditCard, Menu, ShoppingCart, MessageSquare, Edit } from 'lucide-react';
import { generatePixBrCode, printSequentialReceipts } from '../utils/ReceiptHelper';

const PosArea = () => {
  const { products, setProducts, salesHistory, setSalesHistory, currentOrderNumber, setCurrentOrderNumber, shiftSales, setShiftSales } = useAppContext();
  
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState(() => loadFromStorage('lacasa_current_cart', []));
  const [paymentMethod, setPaymentMethod] = useState(() => loadFromStorage('lacasa_current_payment', 'Dinheiro'));
  const [payAmount, setPayAmount] = useState(() => loadFromStorage('lacasa_current_payamt', ''));
  const [orderObservation, setOrderObservation] = useState(() => loadFromStorage('lacasa_current_obs', ''));
  const [editingItem, setEditingItem] = useState(null); // { cartItemId, observation, addons }

  // Persistir estado do carrinho e formulário no localStorage
  useEffect(() => { saveToStorage('lacasa_current_cart', cart); }, [cart]);
  useEffect(() => { saveToStorage('lacasa_current_payment', paymentMethod); }, [paymentMethod]);
  useEffect(() => { saveToStorage('lacasa_current_payamt', payAmount); }, [payAmount]);
  useEffect(() => { saveToStorage('lacasa_current_obs', orderObservation); }, [orderObservation]);

  // Lógica de adicionar ao carrinho
  const addToCart = (product) => {
    const existingIndex = cart.findIndex(item => item.productId === product.id && !item.observation && (!item.addons || item.addons.length === 0));
    
    // Calcula qtd atual no carrinho do mesmo produto para check de estoque
    const currentQtyInCart = cart.filter(item => item.productId === product.id).reduce((sum, item) => sum + item.qty, 0);
    
    if (product.hasStockControl !== false && currentQtyInCart + 1 > product.stock) {
      alert("Estoque insuficiente!");
      return;
    }

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].qty += 1;
      setCart(newCart);
    } else {
      setCart([...cart, { cartItemId: Date.now() + Math.random(), productId: product.id, name: product.name, price: product.price, qty: 1, observation: '', addons: [] }]);
    }
  };

  const updateCartQty = (cartItemId, delta) => {
    const cartItem = cart.find(item => item.cartItemId === cartItemId);
    const product = products.find(p => p.id === cartItem.productId);
    
    if (!cartItem) return;

    if (delta > 0 && product.hasStockControl !== false) {
      const currentQtyInCart = cart.filter(item => item.productId === product.id).reduce((sum, item) => sum + item.qty, 0);
      if (currentQtyInCart + delta > product.stock) {
        alert("Estoque insuficiente!");
        return;
      }
    }

    const newQty = cartItem.qty + delta;
    if (newQty <= 0) {
      setCart(cart.filter(item => item.cartItemId !== cartItemId));
    } else {
      setCart(cart.map(item => item.cartItemId === cartItemId ? { ...item, qty: newQty } : item));
    }
  };

  const getItemUnitPrice = (item) => {
    const addonsTotal = (item.addons || []).reduce((sum, ad) => sum + (parseFloat(ad.price) || 0), 0);
    return item.price + addonsTotal;
  };

  const cartTotal = cart.reduce((acc, item) => acc + (getItemUnitPrice(item) * item.qty), 0);
  const change = paymentMethod === 'Dinheiro' ? (parseFloat(payAmount || 0) - cartTotal) : 0;

  const finalizeSale = async () => {
    if (cart.length === 0) {
      alert("O carrinho está vazio!");
      return;
    }

    if (paymentMethod === 'Dinheiro') {
      const paid = parseFloat(payAmount || 0);
      if (paid < cartTotal) {
        alert("O valor pago em dinheiro é menor que o total do pedido!");
        return;
      }
    }

    // Deduzir estoque de produtos principais E de adicionais
    const updatedProducts = products.map(p => {
      let inCartTotal = cart.filter(item => item.productId === p.id).reduce((sum, item) => sum + item.qty, 0);
      
      // Checar se este produto foi usado como adicional em algum lugar do carrinho
      cart.forEach(item => {
        const addonMatches = (item.addons || []).filter(a => a.productId === p.id).length;
        inCartTotal += (addonMatches * item.qty);
      });

      if (inCartTotal > 0 && p.hasStockControl !== false) {
        return { ...p, stock: p.stock - inCartTotal };
      }
      return p;
    });
    setProducts(updatedProducts);

    let pixPayload = null;
    if (paymentMethod === 'Pix') {
      const pixKey = localStorage.getItem('lacasa_pix_key');
      if (pixKey) {
        const mercName = localStorage.getItem('lacasa_merchant_name') || 'La Casa de Pastel';
        const mercCity = localStorage.getItem('lacasa_merchant_city') || 'SAO PAULO';
        pixPayload = generatePixBrCode(pixKey, cartTotal, mercName, mercCity, 'LACASA' + Date.now());
      }
    }

    const newOrder = {
      items: [...cart],
      total: cartTotal,
      senha: currentOrderNumber,
      pagamento: paymentMethod,
      troco: change >= 0 ? change : 0,
      pixPayload: pixPayload,
      observation: orderObservation,
      status: 'preparando',
      timestamp: Date.now()
    };

    setSalesHistory([newOrder, ...salesHistory]);
    setShiftSales({ count: shiftSales.count + 1, total: shiftSales.total + cartTotal });
    setCurrentOrderNumber(prev => prev + 1);
    
    setCart([]);
    setPayAmount('');
    setPaymentMethod('Dinheiro');
    setOrderObservation('');
    
    // Imprime sequencialmente Comanda e Cupom
    await printSequentialReceipts(newOrder);
  };

    const filteredProducts = React.useMemo(() => {
    return (products || []).filter(p => 
      p.active !== false && !p.isAddon && (p.name || '').toLowerCase().includes((search || '').toLowerCase())
    );
  }, [products, search]);
  
  const availableAddons = React.useMemo(() => {
    return (products || []).filter(p => p.active !== false && p.isAddon);
  }, [products]);

  return (
    <div className="flex gap-6 h-full items-start overflow-hidden">
      
      {/* Left Area: Products */}
      <div className="flex-1 flex flex-col gap-6 h-[calc(100vh-140px)]">
        <div className="glass-panel p-4 rounded-full flex items-center gap-3 shrink-0 mx-2">
          <Search className="text-gray-400 w-5 h-5 ml-2" />
          <input 
            type="text" 
            placeholder="Buscar produto..."
            className="bg-transparent border-none outline-none text-white w-full font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto px-2 pb-10 content-start">
          {filteredProducts.map(p => {
            const isOut = p.hasStockControl === false ? p.isAvailable === false : p.stock <= 0;
            return (
              <div 
                key={p.id} 
                onClick={() => !isOut && addToCart(p)}
                className={`glass-panel rounded-2xl p-6 flex flex-col items-center text-center gap-3 relative ${isOut ? 'opacity-50 grayscale' : 'magnetic-btn cursor-pointer'}`}
              >
                 <i className={`${p.icon} text-3xl ${isOut ? 'text-gray-500' : 'text-lacasa-primary'}`} />
                 <span className="font-bold text-lg">{p.name}</span>
                 <span className="text-lacasa-success font-bold font-mono text-xl">R$ {Number(p.price || 0).toFixed(2)}</span>
                 <span className="text-sm text-gray-400 font-mono">Estoque: {p.hasStockControl === false ? 'Infinito' : Number(p.stock || 0)}</span>
                 {isOut && <div className="absolute inset-0 bg-red-900/20 backdrop-blur-[1px] flex justify-center items-center rounded-3xl border border-red-500/50 transform -rotate-12 font-black text-xl text-red-500 tracking-widest overlay">ESGOTADO</div>}
              </div>
            )
          })}
          {filteredProducts.length === 0 && (
            <div className="col-span-full pt-10 flex flex-col items-center text-gray-500 italic">
               <Menu className="w-12 h-12 mb-4 opacity-50"/>
               Nenhum produto cadastrado ou encontrado.
            </div>
          )}
        </div>
      </div>

      {/* Right Area: Bento Cart */}
      <div className="w-[420px] glass-panel rounded-[1.5rem] p-8 flex flex-col flex-shrink-0 h-[calc(100vh-140px)] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] border border-white/10 relative">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-lacasa-border shrink-0">
          <h2 className="text-3xl font-bold tracking-tight">Pedido</h2>
          <span className="bg-lacasa-primary/20 border border-lacasa-primary/50 text-lacasa-primary px-4 py-1.5 rounded-full font-bold font-mono text-xl">
            #{String(currentOrderNumber).padStart(3, '0')}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0 pr-2">
          {cart.length === 0 ? (
            <div className="m-auto text-center text-gray-500 flex flex-col items-center">
               <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
               <span className="italic">O carrinho está vazio</span>
            </div>
          ) : (
          cart.map(item => (
             <div key={item.cartItemId} className="flex flex-col gap-2 p-4 rounded-2xl bg-lacasa-bg/50 border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
               <div className="flex justify-between items-center relative">
                 <div className="flex flex-col flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg leading-tight">{item.name}</span>
                      <button onClick={() => setEditingItem({ cartItemId: item.cartItemId, observation: item.observation, addons: [...(item.addons||[])] })} className="text-gray-500 hover:text-lacasa-primary transition-colors">
                         <Edit className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-sm text-gray-400 font-mono">R$ {Number(getItemUnitPrice(item)).toFixed(2)} x {item.qty}</span>
                 </div>
                 <div className="flex items-center gap-3 bg-lacasa-panel p-1 rounded-full border border-white/5 shrink-0">
                   <button onClick={() => updateCartQty(item.cartItemId, -1)} className="w-8 h-8 rounded-full bg-white/5 flex justify-center items-center hover:bg-white/10 transition-colors"><Minus className="w-4 h-4 text-gray-300" /></button>
                   <span className="font-mono font-bold w-4 text-center">{item.qty}</span>
                   <button onClick={() => updateCartQty(item.cartItemId, 1)} className="w-8 h-8 rounded-full bg-white/5 flex justify-center items-center hover:bg-white/10 transition-colors"><Plus className="w-4 h-4 text-gray-300" /></button>
                 </div>
               </div>
               
               {/* Observation & Addons preview in cart */}
               {(item.observation || (item.addons && item.addons.length > 0)) && (
                  <div className="text-xs text-gray-400 bg-white/5 rounded-xl p-2 flex flex-col gap-1">
                     {item.observation && <div><span className="font-bold text-amber-500/80">Obs:</span> {item.observation}</div>}
                     {(item.addons || []).map((ad, idx) => (
                        <div key={idx} className="flex justify-between text-emerald-400 ml-1">
                           <span>+ {ad.name}</span>
                           <span className="font-mono">+R$ {Number(ad.price || 0).toFixed(2)}</span>
                        </div>
                     ))}
                  </div>
               )}
             </div>
          ))
          )}
        </div>

        <div className="shrink-0 mt-4">
           {/* Payment Methods */}
           <div className="grid grid-cols-3 gap-2 mb-4">
              {['Dinheiro', 'Cartão', 'Pix'].map(method => (
                <button 
                  key={method} 
                  onClick={() => setPaymentMethod(method)}
                  className={`py-3 rounded-2xl font-bold transition-all border ${paymentMethod === method ? 'bg-lacasa-primary/20 border-lacasa-primary text-lacasa-primary shadow-[inset_0_0_20px_rgba(225,29,72,0.2)]' : 'bg-lacasa-bg/50 border-white/5 text-gray-400 hover:bg-lacasa-bg'}`}
                >
                  {method}
                </button>
              ))}
           </div>
           
           {paymentMethod === 'Dinheiro' && (
             <div className="bg-lacasa-bg/50 border border-white/5 rounded-2xl p-4 mb-4 flex justify-between items-center">
                <span className="text-gray-400 font-bold">Valor Recebido</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-mono">R$</span>
                  <input 
                    type="number" 
                    value={payAmount} 
                    onChange={e => setPayAmount(e.target.value)}
                    className="bg-lacasa-panel border border-white/10 rounded-xl px-3 py-1 w-24 text-right font-mono text-lg outline-none focus:border-lacasa-primary transition-colors text-white"
                  />
                </div>
             </div>
           )}

           <div className="flex justify-between items-center font-bold text-lg text-gray-400 mb-2">
             <span>Troco</span>
             <span className="font-mono">R$ {(change > 0 ? change : 0).toFixed(2)}</span>
           </div>

           {/* General Observation */}
           <div className="mb-4">
              <div className="flex items-center gap-2 mb-2 text-gray-400 font-bold text-sm">
                <MessageSquare className="w-4 h-4" /> Observação Geral
              </div>
              <textarea 
                className="w-full bg-lacasa-bg/50 border border-white/10 rounded-xl p-3 outline-none focus:border-lacasa-primary text-white resize-none text-sm transition-colors"
                rows="2"
                placeholder="Ex: Embalar para viagem"
                value={orderObservation}
                onChange={e => setOrderObservation(e.target.value)}
              />
           </div>

           <div className="flex justify-between items-center font-black text-3xl text-lacasa-success mb-6">
             <span>Total</span>
             <span className="font-mono tracking-tighter">R$ {cartTotal.toFixed(2)}</span>
           </div>
           
           <button 
             onClick={finalizeSale}
             className="magnetic-btn w-full bg-lacasa-success hover:bg-emerald-400 py-4.5 rounded-2xl font-black text-xl flex justify-center items-center gap-3 text-lacasa-bg shadow-[0_10px_20px_rgba(16,185,129,0.3)] border border-emerald-300/50"
           >
             <CheckCircle2 className="w-6 h-6" /> Finalizar Venda
           </button>
        </div>
      </div>

      {/* Editing Item Modal */}
      {editingItem && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-md p-8 rounded-[2rem] shadow-2xl scale-in-center overflow-hidden flex flex-col max-h-[90vh]">
               <h3 className="text-2xl font-bold mb-6 flex items-center gap-3"><Edit className="text-lacasa-primary"/> Editar Item</h3>
               
               <div className="flex-1 overflow-y-auto pr-2 pb-4">
                 {/* Item Observation */}
                 <div className="mb-6">
                    <label className="text-sm font-bold text-gray-400 mb-2 block">Observação do Item</label>
                    <textarea 
                      className="w-full bg-lacasa-bg border border-white/10 rounded-xl p-4 outline-none text-white focus:border-lacasa-primary transition-colors resize-none"
                      rows="3"
                      placeholder="Ex: Sem cebola, bem passado..."
                      value={editingItem.observation}
                      onChange={e => setEditingItem({...editingItem, observation: e.target.value})}
                    />
                 </div>

                 {/* Item Addons */}
                 <div>
                    <label className="text-sm font-bold text-gray-400 mb-2 block">Adicionais Selecionados</label>
                    <div className="flex flex-col gap-2 mb-6">
                       {editingItem.addons.map((ad, i) => (
                           <div key={i} className="flex justify-between items-center bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                              <div>
                                <span className="font-bold text-white">{ad.name}</span>
                                <span className="ml-2 text-sm text-lacasa-success font-mono">+ R$ {Number(ad.price || 0).toFixed(2)}</span>
                              </div>
                              <button onClick={() => { const newAd = [...editingItem.addons]; newAd.splice(i, 1); setEditingItem({...editingItem, addons: newAd}); }} className="p-2 text-red-400 hover:bg-white/10 rounded-xl transition-colors"><Trash2 className="w-4 h-4"/></button>
                           </div>
                       ))}
                       {editingItem.addons.length === 0 && <span className="text-sm text-gray-500 italic px-2">Nenhum adicional vinculado.</span>}
                    </div>

                    <label className="text-sm font-bold text-gray-400 mb-2 block border-t border-white/10 pt-4">Adicionar ao Item</label>
                    {availableAddons.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                           {availableAddons.map(addonProduct => (
                              <button 
                                key={addonProduct.id} 
                                onClick={() => setEditingItem({...editingItem, addons: [...editingItem.addons, { productId: addonProduct.id, name: addonProduct.name, price: addonProduct.price }]})} 
                                className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 font-bold px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
                              >
                                 <Plus className="w-3 h-3" /> {addonProduct.name} (R$ {Number(addonProduct.price||0).toFixed(2)})
                              </button>
                           ))}
                        </div>
                    ) : (
                        <div className="text-sm text-gray-500 italic">Nenhum adicional cadastrado no estoque (Marque produtos com a opção "Adicional" no Estoque).</div>
                    )}
                 </div>
               </div>

               <div className="flex gap-3 mt-4 pt-4 border-t border-white/5 shrink-0">
                  <button onClick={() => setEditingItem(null)} className="flex-1 py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 transition-colors">Cancelar</button>
                  <button 
                    onClick={() => {
                        setCart(cart.map(i => i.cartItemId === editingItem.cartItemId ? { ...i, observation: editingItem.observation, addons: editingItem.addons.filter(a => a.name.trim() !== '') } : i));
                        setEditingItem(null);
                    }} 
                    className="flex-1 py-3 rounded-xl font-bold bg-lacasa-primary hover:bg-rose-500 text-white shadow-[0_4px_15px_rgba(225,29,72,0.3)] transition-colors"
                  >
                     Salvar
                  </button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default PosArea;
