import React, { useState, useEffect } from 'react';
import { 
  Package, ShoppingCart, Settings, LogOut, Plus, Search, Edit, Trash2, 
  Eye, EyeOff, Save, X, Cloud, CloudOff, RefreshCw, CheckCircle2, Clock,
  DollarSign, TrendingUp, AlertTriangle, QrCode, Building, MapPin, Users, User
} from 'lucide-react';
import { collection, doc, setDoc, getDocs, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured, initializeCollections } from '../../firebase/config';
import { useAuth } from './AdminLogin';

const defaultOperators = ['Luigi', 'Maria', 'João', 'Carlos', 'Ana'];

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('produtos');
  const [syncStatus, setSyncStatus] = useState('online');
  const [lastSync, setLastSync] = useState(null);
  const [products, setProducts] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [settings, setSettings] = useState({
    pixKey: '',
    merchantName: 'La Casa de Pastel',
    merchantCity: 'SAO PAULO'
  });
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isFirebaseConfigured()) {
      initializeCollections().then(() => {
        loadData();
        subscribeToChanges();
      });
    } else {
      loadLocalData();
    }
  }, []);

  const subscribeToChanges = () => {
    const productsSub = onSnapshot(collection(db, 'products'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length > 0) setProducts(data);
    });

    const historySub = onSnapshot(collection(db, 'sales'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length > 0) setSalesHistory(data);
    });

    const settingsSub = onSnapshot(collection(db, 'settings'), (snap) => {
      if (!snap.empty) {
        const s = snap.docs[0].data();
        setSettings({
          pixKey: s.pixKey || '',
          merchantName: s.merchantName || 'La Casa de Pastel',
          merchantCity: s.merchantCity || 'SAO PAULO'
        });
      }
    });

    return () => {
      productsSub();
      historySub();
      settingsSub();
    };
  };

  const loadLocalData = () => {
    setProducts(JSON.parse(localStorage.getItem('lacasa_products') || '[]'));
    setSalesHistory(JSON.parse(localStorage.getItem('lacasa_history') || '[]'));
    setSettings({
      pixKey: localStorage.getItem('lacasa_pix_key') || '',
      merchantName: localStorage.getItem('lacasa_merchant_name') || 'La Casa de Pastel',
      merchantCity: localStorage.getItem('lacasa_merchant_city') || 'SAO PAULO'
    });
    const savedOperators = localStorage.getItem('lacasa_operators');
    setOperators(savedOperators ? JSON.parse(savedOperators) : defaultOperators);
    setLoading(false);
  };

  const loadData = async () => {
    try {
      const productsSnap = await getDocs(collection(db, 'products'));
      const productsData = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProducts(productsData.length > 0 ? productsData : JSON.parse(localStorage.getItem('lacasa_products') || '[]'));

      const historySnap = await getDocs(collection(db, 'sales'));
      const historyData = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSalesHistory(historyData.length > 0 ? historyData : JSON.parse(localStorage.getItem('lacasa_history') || '[]'));

      const settingsSnap = await getDocs(collection(db, 'settings'));
      if (!settingsSnap.empty) {
        const s = settingsSnap.docs[0].data();
        setSettings({
          pixKey: s.pixKey || '',
          merchantName: s.merchantName || 'La Casa de Pastel',
          merchantCity: s.merchantCity || 'SAO PAULO'
        });
      }

      setSyncStatus('online');
      setLastSync(new Date());
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      loadLocalData();
    } finally {
      setLoading(false);
    }
  };

  const saveProduct = async (product) => {
    if (isFirebaseConfigured()) {
      try {
        const productRef = doc(db, 'products', product.id.toString());
        await setDoc(productRef, product);
        await loadData();
      } catch (err) {
        console.error('Erro ao salvar:', err);
      }
    }
    localStorage.setItem('lacasa_products', JSON.stringify(products));
  };

  const deleteProduct = async (id) => {
    if (confirm('Excluir este produto?')) {
      if (isFirebaseConfigured()) {
        try {
          await deleteDoc(doc(db, 'products', id.toString()));
        } catch (err) {
          console.error('Erro ao excluir:', err);
        }
      }
      setProducts(products.filter(p => p.id.toString() !== id.toString()));
      localStorage.setItem('lacasa_products', JSON.stringify(products.filter(p => p.id.toString() !== id.toString())));
    }
  };

  const saveSettings = async () => {
    if (isFirebaseConfigured()) {
      try {
        await setDoc(doc(db, 'settings', 'main'), settings);
      } catch (err) {
        console.error('Erro ao salvar configurações:', err);
      }
    }
    localStorage.setItem('lacasa_pix_key', settings.pixKey);
    localStorage.setItem('lacasa_merchant_name', settings.merchantName);
    localStorage.setItem('lacasa_merchant_city', settings.merchantCity);
    alert('Configurações salvas!');
  };

  const syncToLocal = () => {
    localStorage.setItem('lacasa_products', JSON.stringify(products));
    localStorage.setItem('lacasa_history', JSON.stringify(salesHistory));
    localStorage.setItem('lacasa_pix_key', settings.pixKey);
    localStorage.setItem('lacasa_merchant_name', settings.merchantName);
    localStorage.setItem('lacasa_merchant_city', settings.merchantCity);
    alert('Dados sincronizados com o app local!');
  };

  const backupToFirebase = async () => {
    if (!isFirebaseConfigured()) {
      alert('Firebase não está configurado!');
      return;
    }
    
    if (!confirm('Isso irá substituir os dados no Firebase pelos dados locais. Continuar?')) return;

    try {
      setLoading(true);
      for (const p of products) {
        await setDoc(doc(db, 'products', p.id.toString()), p);
      }
      for (const s of salesHistory) {
        const id = s.id || s.timestamp?.toString() || Date.now().toString();
        await setDoc(doc(db, 'sales', id), s);
      }
      await setDoc(doc(db, 'settings', 'main'), settings);
      setLastSync(new Date());
      alert('Backup realizado com sucesso!');
    } catch (err) {
      console.error('Erro no backup:', err);
      alert('Erro ao fazer backup: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalVendas = salesHistory.reduce((acc, s) => acc + (s.total || 0), 0);
  const vendasHoje = salesHistory.filter(s => {
    const today = new Date().toDateString();
    return new Date(s.timestamp).toDateString() === today;
  }).reduce((acc, s) => acc + (s.total || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-lacasa-bg flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-lacasa-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-lacasa-bg">
      <header className="bg-lacasa-panel border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">Painel Admin</h1>
            <span className="text-gray-400 text-sm">La Casa de Pastel</span>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              syncStatus === 'online' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              {syncStatus === 'online' ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
              {syncStatus === 'online' ? 'Online' : 'Offline'}
              {lastSync && <span className="text-xs opacity-70">({lastSync.toLocaleTimeString()})</span>}
            </div>
            {isFirebaseConfigured() && (
              <button onClick={backupToFirebase} className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
                <Cloud className="w-4 h-4" /> Backup
              </button>
            )}
            <button onClick={syncToLocal} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
              <RefreshCw className="w-4 h-4" /> Sincronizar
            </button>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">{user?.email}</span>
              <button onClick={logout} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 p-2 rounded-xl transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-6 flex gap-1">
          {[
            { id: 'produtos', icon: Package, label: 'Produtos' },
            { id: 'vendas', icon: ShoppingCart, label: 'Vendas' },
            { id: 'config', icon: Settings, label: 'Configurações' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === tab.id 
                  ? 'border-lacasa-primary text-lacasa-primary' 
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'produtos' && (
          <ProductsTab 
            products={products} 
            setProducts={setProducts}
            onSave={saveProduct}
            onDelete={deleteProduct}
          />
        )}
        {activeTab === 'vendas' && (
          <SalesTab sales={salesHistory} totalVendas={totalVendas} vendasHoje={vendasHoje} />
        )}
        {activeTab === 'config' && (
          <SettingsTab settings={settings} setSettings={setSettings} onSave={saveSettings} operators={operators} setOperators={setOperators} />
        )}
      </main>
    </div>
  );
};

const ProductsTab = ({ products, setProducts, onSave, onDelete }) => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '', category: 'Pastéis', icon: 'fa-solid fa-utensils',
    price: '', stock: '', hasStockControl: true, isAvailable: true, isAddon: false, active: true
  });

  const openModal = (product = null) => {
    if (product) {
      setEditProduct(product.id);
      setFormData(product);
    } else {
      setEditProduct(null);
      setFormData({ name: '', category: 'Pastéis', icon: 'fa-solid fa-utensils', price: '', stock: '', hasStockControl: true, isAvailable: true, isAddon: false, active: true });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const product = {
      ...formData,
      price: parseFloat(formData.price) || 0,
      stock: formData.hasStockControl ? parseInt(formData.stock, 10) || 0 : 0,
      id: editProduct || Date.now()
    };

    if (editProduct) {
      setProducts(products.map(p => p.id.toString() === editProduct.toString() ? product : p));
    } else {
      setProducts([...products, product]);
    }
    onSave(product);
    setIsModalOpen(false);
  };

  const toggleActive = (id) => {
    const updated = products.map(p => p.id.toString() === id.toString() ? { ...p, active: p.active === false } : p);
    setProducts(updated);
    const product = updated.find(p => p.id.toString() === id.toString());
    if (product) onSave(product);
  };

  const filtered = products.filter(p => 
    (p.name || '').toLowerCase().includes((search || '').toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Gerenciar Produtos</h2>
          <p className="text-gray-400 text-sm">{products.length} produtos cadastrados</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-lacasa-panel border border-white/10 rounded-xl px-4 py-2 flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-400" />
            <input 
              className="bg-transparent border-none outline-none text-white" 
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => openModal()} className="bg-lacasa-primary hover:bg-rose-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors">
            <Plus className="w-5 h-5" /> Novo Produto
          </button>
        </div>
      </div>

      <div className="bg-lacasa-panel rounded-2xl overflow-hidden border border-white/10">
        <table className="w-full">
          <thead className="bg-lacasa-bg text-gray-400 text-sm">
            <tr>
              <th className="text-left px-6 py-4 font-bold uppercase tracking-wider">Produto</th>
              <th className="text-left px-6 py-4 font-bold uppercase tracking-wider">Preço</th>
              <th className="text-left px-6 py-4 font-bold uppercase tracking-wider">Estoque</th>
              <th className="text-left px-6 py-4 font-bold uppercase tracking-wider">Status</th>
              <th className="text-right px-6 py-4 font-bold uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className={`border-t border-white/5 hover:bg-white/5 transition-colors ${!p.active ? 'opacity-50' : ''}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-lacasa-bg flex items-center justify-center">
                      <i className={`${p.icon} text-lacasa-primary`} />
                    </div>
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        {p.name}
                        {p.isAddon && <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">Adicional</span>}
                      </div>
                      <div className="text-gray-500 text-sm">{p.category}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 font-mono font-bold text-lacasa-success">R$ {Number(p.price || 0).toFixed(2)}</td>
                <td className="px-6 py-4">
                  {p.hasStockControl !== false ? (
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${p.stock <= 5 ? 'bg-red-500/20 text-red-400' : 'bg-lacasa-bg text-gray-300'}`}>
                      {p.stock} un
                    </span>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${p.isAvailable === false ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {p.isAvailable === false ? 'Esgotado' : 'Infinito'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    p.active !== false ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {p.active !== false ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => toggleActive(p.id)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                      {p.active !== false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openModal(p)} className="p-2 hover:bg-amber-500/20 rounded-lg transition-colors text-gray-400 hover:text-amber-400">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(p.id)} className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            Nenhum produto encontrado
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-lacasa-panel w-full max-w-lg rounded-[2rem] p-8 border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-white">{editProduct ? 'Editar' : 'Novo'} Produto</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-400 mb-1 block">Nome</label>
                  <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-lacasa-primary" />
                </div>
                <label className="flex items-center gap-2 bg-lacasa-bg border border-white/10 rounded-xl px-4 h-[46px] self-end">
                  <input type="checkbox" checked={formData.isAddon} onChange={e => setFormData({...formData, isAddon: e.target.checked})} className="accent-blue-500 w-4 h-4" />
                  <span className="text-sm font-bold text-blue-400">Adicional</span>
                </label>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-400 mb-1 block">Preço (R$)</label>
                  <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full font-mono bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-lacasa-primary" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-400 mb-1 block">Estoque</label>
                  {formData.hasStockControl ? (
                    <input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full font-mono bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-lacasa-primary" />
                  ) : (
                    <div className="flex items-center gap-2 bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 h-[46px]">
                      <span className={`text-sm font-bold ${formData.isAvailable ? 'text-emerald-400' : 'text-red-400'}`}>{formData.isAvailable ? 'Disponível' : 'Esgotado'}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.hasStockControl} onChange={e => setFormData({...formData, hasStockControl: e.target.checked})} className="accent-lacasa-primary w-4 h-4" />
                  <span className="text-sm font-bold text-gray-400">Controlar estoque</span>
                </label>
                {!formData.hasStockControl && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.isAvailable} onChange={e => setFormData({...formData, isAvailable: e.target.checked})} className="accent-lacasa-primary w-4 h-4" />
                    <span className="text-sm font-bold text-gray-400">Disponível</span>
                  </label>
                )}
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-400 mb-1 block">Categoria</label>
                  <input value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-lacasa-primary" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-400 mb-1 block">Ícone (classe)</label>
                  <input value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})} className="w-full font-mono text-sm bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-lacasa-primary" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 transition-colors">Cancelar</button>
              <button onClick={handleSave} className="magnetic-btn flex-1 py-3 rounded-xl font-bold bg-lacasa-primary hover:bg-rose-500 text-white shadow-[0_4px_15px_rgba(225,29,72,0.3)]">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SalesTab = ({ sales, totalVendas, vendasHoje }) => {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? sales : 
    filter === 'today' ? sales.filter(s => new Date(s.timestamp).toDateString() === new Date().toDateString()) : 
    sales;

  return (
    <div>
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-lacasa-panel rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-lacasa-success/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-lacasa-success" />
            </div>
            <span className="text-gray-400 font-bold">Total Vendido</span>
          </div>
          <p className="text-3xl font-bold text-lacasa-success font-mono">R$ {totalVendas.toFixed(2)}</p>
        </div>
        <div className="bg-lacasa-panel rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-lacasa-primary/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-lacasa-primary" />
            </div>
            <span className="text-gray-400 font-bold">Vendas Hoje</span>
          </div>
          <p className="text-3xl font-bold text-lacasa-primary font-mono">R$ {vendasHoje.toFixed(2)}</p>
        </div>
        <div className="bg-lacasa-panel rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-gray-400 font-bold">Pedidos</span>
          </div>
          <p className="text-3xl font-bold text-amber-500 font-mono">{sales.length}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Histórico de Vendas</h2>
        <div className="flex gap-2 bg-lacasa-panel rounded-xl p-1 border border-white/10">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'today', label: 'Hoje' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                filter === f.id ? 'bg-lacasa-primary text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-lacasa-panel rounded-2xl overflow-hidden border border-white/10">
        <table className="w-full">
          <thead className="bg-lacasa-bg text-gray-400 text-sm">
            <tr>
              <th className="text-left px-6 py-4 font-bold uppercase tracking-wider">Pedido</th>
              <th className="text-left px-6 py-4 font-bold uppercase tracking-wider">Operador</th>
              <th className="text-left px-6 py-4 font-bold uppercase tracking-wider">Data/Hora</th>
              <th className="text-left px-6 py-4 font-bold uppercase tracking-wider">Itens</th>
              <th className="text-left px-6 py-4 font-bold uppercase tracking-wider">Pagamento</th>
              <th className="text-left px-6 py-4 font-bold uppercase tracking-wider">Status</th>
              <th className="text-right px-6 py-4 font-bold uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map(sale => (
              <tr key={sale.id || sale.timestamp} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-6 py-4 font-mono font-bold text-lacasa-primary">#{String(sale.senha || '---').padStart(3, '0')}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 font-bold">
                    {sale.operador || 'N/A'}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-400 text-sm">
                  {new Date(sale.timestamp).toLocaleDateString('pt-BR')} {new Date(sale.timestamp).toLocaleTimeString('pt-BR')}
                </td>
                <td className="px-6 py-4 text-gray-300">
                  {(sale.items || []).map(i => `${i.qty}x ${i.name}`).join(', ')}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    sale.pagamento === 'Pix' ? 'bg-emerald-500/20 text-emerald-400' :
                    sale.pagamento === 'Cartão' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    {sale.pagamento}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    sale.status === 'entregue' ? 'bg-emerald-500/20 text-emerald-400' :
                    sale.status === 'preparando' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {sale.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-mono font-bold text-lacasa-success">R$ {Number(sale.total || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-gray-500">Nenhuma venda registrada</div>
        )}
      </div>
    </div>
  );
};

const SettingsTab = ({ settings, setSettings, onSave, operators, setOperators }) => {
  const [newOperator, setNewOperator] = useState('');

  const addOperator = () => {
    if (newOperator.trim() && !operators.includes(newOperator.trim())) {
      const updated = [...operators, newOperator.trim()];
      setOperators(updated);
      localStorage.setItem('lacasa_operators', JSON.stringify(updated));
      setNewOperator('');
    }
  };

  const removeOperator = (name) => {
    const updated = operators.filter(o => o !== name);
    setOperators(updated);
    localStorage.setItem('lacasa_operators', JSON.stringify(updated));
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-white mb-6">Configurações</h2>
      
      <div className="bg-lacasa-panel rounded-2xl p-8 border border-white/10 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Operadores de Caixa</h3>
            <p className="text-gray-400 text-sm">Gerencie os operadores que usam o sistema</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {operators.map(name => (
            <div key={name} className="flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 text-purple-300 px-4 py-2 rounded-full">
              <User className="w-4 h-4" />
              <span className="font-medium">{name}</span>
              <button onClick={() => removeOperator(name)} className="hover:text-red-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newOperator}
            onChange={e => setNewOperator(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addOperator()}
            placeholder="Nome do novo operador"
            className="flex-1 bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500"
          />
          <button onClick={addOperator} className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-xl font-bold transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="bg-lacasa-panel rounded-2xl p-8 border border-white/10 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-lacasa-primary/20 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-lacasa-primary" />
          </div>
          <div>
            <h3 className="font-bold text-white">Configurações PIX</h3>
            <p className="text-gray-400 text-sm">Dados para geração do QR Code PIX</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-400 mb-1 block">Chave PIX</label>
            <input 
              value={settings.pixKey} 
              onChange={e => setSettings({...settings, pixKey: e.target.value})}
              className="w-full bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-lacasa-primary font-mono"
              placeholder="CPF, CNPJ, email ou telefone"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-bold text-gray-400 mb-1 block">Nome do Estabelecimento</label>
              <input 
                value={settings.merchantName} 
                onChange={e => setSettings({...settings, merchantName: e.target.value})}
                className="w-full bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-lacasa-primary"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-bold text-gray-400 mb-1 block">Cidade</label>
              <input 
                value={settings.merchantCity} 
                onChange={e => setSettings({...settings, merchantCity: e.target.value})}
                className="w-full bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-lacasa-primary font-mono uppercase"
              />
            </div>
          </div>
        </div>
      </div>

      <button onClick={onSave} className="magnetic-btn w-full bg-lacasa-success hover:bg-emerald-400 py-4 rounded-xl font-bold text-lacasa-bg shadow-[0_4px_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2">
        <Save className="w-5 h-5" /> Salvar Configurações
      </button>
    </div>
  );
};

export default AdminDashboard;
