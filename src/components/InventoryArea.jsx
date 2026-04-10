import React, { useState } from 'react';
import { useAppContext } from '../store/Store';
import { Plus, Search, Trash2, Edit, EyeOff, Eye } from 'lucide-react';

const InventoryArea = () => {
  const { products, setProducts } = useAppContext();
  const [search, setSearch] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '', category: 'Pastéis', icon: 'fa-solid fa-utensils',
    price: '', stock: '', hasStockControl: true, isAvailable: true, isAddon: false
  });

  const openModal = (product = null) => {
    if (product) {
      setEditId(product.id);
      setFormData({
        name: product.name, category: product.category,
        icon: product.icon, price: product.price, 
        stock: product.stock, 
        hasStockControl: product.hasStockControl !== false,
        isAvailable: product.isAvailable !== false,
        isAddon: product.isAddon === true
      });
    } else {
      setEditId(null);
      setFormData({ name: '', category: 'Pastéis', icon: 'fa-solid fa-utensils', price: '', stock: '', hasStockControl: true, isAvailable: true, isAddon: false });
    }
    setIsModalOpen(true);
  };

  const saveProduct = (e) => {
    e.preventDefault();
    const newProduct = {
      ...formData,
      price: parseFloat(formData.price),
      stock: formData.hasStockControl ? parseInt(formData.stock, 10) || 0 : 0,
      active: true, // simplified for now
    };

    if (editId) {
      setProducts(products.map(p => p.id === editId ? { ...p, ...newProduct, active: p.active } : p));
    } else {
      newProduct.id = Date.now();
      setProducts([...products, newProduct]);
    }
    setIsModalOpen(false);
  };

  const deleteProduct = (id) => {
    if(confirm('Excluir este produto permanentemente?')) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const toggleStatus = (id) => {
    setProducts(products.map(p => p.id === id ? { ...p, active: p.active === false ? true : false } : p));
  };

  const filtered = (products || []).filter(p => (p.name || '').toLowerCase().includes((search || '').toLowerCase()));

  return (
    <div className="glass-panel p-10 rounded-[1.5rem] h-[calc(100vh-140px)] flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      
      <div className="flex justify-between items-center mb-8 shrink-0">
        <h2 className="text-4xl font-bold tracking-tight">Estoque e Produtos</h2>
        <div className="flex items-center gap-4">
          <div className="bg-lacasa-bg/50 border border-white/5 rounded-full px-4 py-2 flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-400" />
            <input 
              className="bg-transparent border-none outline-none text-white w-48 font-medium" 
              placeholder="Buscar..." 
              value={search} onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <button onClick={() => openModal()} className="magnetic-btn bg-lacasa-primary text-white px-6 py-2 rounded-full font-bold flex items-center gap-2">
            <Plus className="w-5 h-5" /> Novo Produto
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto pr-2">
        <div className="w-full text-left border-collapse">
          <div className="grid grid-cols-12 text-sm font-bold text-gray-500 uppercase tracking-widest px-6 py-4 bg-lacasa-bg/80 sticky top-0 backdrop-blur-md rounded-t-2xl z-10 border-b border-white/5">
            <div className="col-span-4">Nome & Categoria</div>
            <div className="col-span-2">Preço</div>
            <div className="col-span-2">Estoque</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2 text-right">Ações</div>
          </div>
          
          <div className="flex flex-col gap-2 mt-2">
            {filtered.map(p => (
              <div key={p.id} className={`grid grid-cols-12 items-center px-6 py-4 bg-white/5 border border-white/5 rounded-2xl transition-opacity hover:bg-white/10 ${p.active === false ? 'opacity-50' : ''}`}>
                <div className="col-span-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-lacasa-panel flex items-center justify-center border border-white/10 shrink-0">
                    <i className={`${p.icon} text-lacasa-primary`} />
                  </div>
                  <div>
                    <div className="font-bold text-lg leading-tight flex items-center gap-2">
                        {p.name}
                        {p.isAddon && <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 font-bold uppercase tracking-widest border border-blue-500/20">Adicional</span>}
                    </div>
                    <div className="text-gray-500 text-sm">{p.category}</div>
                  </div>
                </div>
                <div className="col-span-2 font-mono font-bold">R$ {Number(p.price || 0).toFixed(2)}</div>
                <div className="col-span-2 font-mono">
                  {p.hasStockControl !== false ? (
                     <span className={`px-3 py-1 rounded-full text-sm font-bold ${p.stock <= 5 ? 'bg-red-500/20 text-red-400' : 'bg-lacasa-bg text-gray-300'}`}>{p.stock}</span>
                  ) : (
                     <span className={`px-3 py-1 rounded-full text-sm font-bold ${p.isAvailable === false ? 'bg-red-500/20 text-red-400' : 'bg-lacasa-bg text-emerald-400'}`}>
                        {p.isAvailable === false ? 'Esgotado' : 'Infinito'}
                     </span>
                  )}
                </div>
                <div className="col-span-2">
                   {p.active !== false ? (
                     <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">Ativo</span>
                   ) : (
                     <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/20">Inativo</span>
                   )}
                </div>
                <div className="col-span-2 flex justify-end gap-3 text-gray-400">
                  <button onClick={() => toggleStatus(p.id)} className="hover:text-white transition-colors p-2 bg-lacasa-bg/50 rounded-full">{p.active !== false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  <button onClick={() => openModal(p)} className="hover:text-amber-400 transition-colors p-2 bg-lacasa-bg/50 rounded-full"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => deleteProduct(p.id)} className="hover:text-red-500 transition-colors p-2 bg-lacasa-bg/50 rounded-full"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-8 rounded-[2rem] shadow-2xl scale-in-center">
             <h3 className="text-2xl font-bold mb-6">{editId ? 'Editar Produto' : 'Novo Produto'}</h3>
             <form onSubmit={saveProduct} className="flex flex-col gap-4">
               <div className="flex gap-4">
                 <div className="flex-1">
                   <label className="text-sm font-bold text-gray-400 mb-1 block">Nome do Produto</label>
                   <input required className="w-full bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 outline-none text-white focus:border-lacasa-primary transition-colors" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                 </div>
                 <div className="w-32 flex flex-col justify-end">
                    <label className="flex items-center gap-2 cursor-pointer bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 h-[46px] hover:border-blue-500 transition-colors">
                      <input type="checkbox" className="accent-blue-500 w-4 h-4" checked={formData.isAddon} onChange={(e) => setFormData({...formData, isAddon: e.target.checked})} />
                      <span className="text-sm font-bold text-blue-400">Adicional</span>
                    </label>
                 </div>
               </div>
               <div className="flex gap-4">
                 <div className="flex-1">
                   <label className="text-sm font-bold text-gray-400 mb-1 block">Preço (R$)</label>
                   <input required type="number" step="0.01" className="w-full font-mono bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 outline-none text-white focus:border-lacasa-primary transition-colors" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                 </div>
                 <div className="flex-1">
                   <div className="flex items-center justify-between mb-1">
                     <label className="text-sm font-bold text-gray-400 block">Estoque</label>
                     <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-xs text-gray-500 font-bold">Controlar</span>
                        <input type="checkbox" className="accent-lacasa-primary w-4 h-4" checked={formData.hasStockControl} onChange={(e) => setFormData({...formData, hasStockControl: e.target.checked})} />
                     </label>
                   </div>
                   {formData.hasStockControl ? (
                     <input required type="number" className="w-full font-mono bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 outline-none text-white focus:border-lacasa-primary transition-colors" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} />
                   ) : (
                     <div className="flex items-center gap-4 bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 h-[46px]">
                       <span className="text-sm font-bold text-gray-400 flex-1">Status:</span>
                       <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="accent-lacasa-primary w-4 h-4 cursor-pointer" checked={formData.isAvailable} onChange={(e) => setFormData({...formData, isAvailable: e.target.checked})} />
                          <span className={`text-sm font-bold ${formData.isAvailable ? 'text-emerald-400' : 'text-red-400'}`}>{formData.isAvailable ? 'Disponível' : 'Esgotado'}</span>
                       </label>
                     </div>
                   )}
                 </div>
               </div>
               <div className="flex gap-4">
                 <div className="flex-1">
                   <label className="text-sm font-bold text-gray-400 mb-1 block">Categoria</label>
                   <input required className="w-full bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 outline-none text-white focus:border-lacasa-primary transition-colors" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
                 </div>
                 <div className="flex-1">
                   <label className="text-sm font-bold text-gray-400 mb-1 block">Classe do Ícone</label>
                   <input required className="w-full font-mono text-sm bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 outline-none text-white focus:border-lacasa-primary transition-colors" value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})} />
                 </div>
               </div>
               <div className="flex gap-3 mt-6">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 transition-colors">Cancelar</button>
                 <button type="submit" className="magnetic-btn flex-1 py-3 rounded-xl font-bold bg-lacasa-primary hover:bg-rose-500 text-white shadow-[0_4px_15px_rgba(225,29,72,0.3)]">Salvar</button>
               </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default InventoryArea;
