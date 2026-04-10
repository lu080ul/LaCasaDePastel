import React, { useState, useEffect } from 'react';
import { useAppContext } from '../store/Store';
import { Settings, Image as ImageIcon, Type, Receipt, QrCode, Lock, History, Printer, XCircle, MonitorPlay, Download } from 'lucide-react';
import { printSpecificReceipt, printClosureReport } from '../utils/ReceiptHelper';

const SettingsArea = () => {
  const { 
    pixKey, setPixKey,
    merchantName, setMerchantName,
    merchantCity, setMerchantCity,
    salesHistory, setSalesHistory,
    shiftSales, setShiftSales,
    setCurrentOrderNumber
  } = useAppContext();

  const [receiptName, setReceiptName] = useState(() => localStorage.getItem('lacasa_receipt_name') || 'LA CASA DE PASTEL');
  const [receiptFooter, setReceiptFooter] = useState(() => localStorage.getItem('lacasa_receipt_footer_msg') || 'Obrigado pela preferência e volte sempre!');
  
  // Salvar opções de cupom
  useEffect(() => {
    localStorage.setItem('lacasa_receipt_name', receiptName);
    localStorage.setItem('lacasa_receipt_footer_msg', receiptFooter);
  }, [receiptName, receiptFooter]);

  const [availableDisplays, setAvailableDisplays] = useState([]);
  const [selectedDisplay, setSelectedDisplay] = useState(null);

  useEffect(() => {
    if (window.require) {
       const { ipcRenderer } = window.require('electron');
       ipcRenderer.invoke('get-displays').then(disp => {
          setAvailableDisplays(disp || []);
          if (disp && disp.length > 0) {
             const external = disp.find(d => !d.isPrimary);
             setSelectedDisplay(external ? external.id : disp[0].id);
          }
       }).catch(console.error);
    }
  }, []);

  const closeRegister = () => {
    if(window.confirm('Tem certeza que deseja imprimir o relatório e fechar o caixa? Isso irá zerar o histórico de vendas do turno.')) {
      printClosureReport(salesHistory, shiftSales);
      alert("Relatório enviado para impressão. O Caixa será fechado, o histórico zerado e as senhas resetadas agora.");
      setSalesHistory([]);
      setShiftSales({ count: 0, total: 0 });
      setCurrentOrderNumber(1);
    }
  };

  const cancelSale = (senha) => {
    if(window.confirm(`Tem certeza que deseja ESTORNAR a venda #${senha}?\nO valor será removido do caixa, e a venda excluída do relatório.`)) {
       const sale = salesHistory.find(s => s.senha === senha);
       if (sale) {
           setSalesHistory(salesHistory.filter(s => s.senha !== senha));
           setShiftSales({ count: shiftSales.count - 1, total: shiftSales.total - sale.total });
       }
    }
  };

  const exportCSV = () => {
    if (!salesHistory || salesHistory.length === 0) {
      alert("Nenhuma venda no histórico para exportar.");
      return;
    }

    const report = {};
    salesHistory.forEach(sale => {
        (sale.items || []).forEach(item => {
            const id = item.productId || item.id || item.name;
            if (!report[id]) {
               report[id] = { name: item.name, qty: 0, revenue: 0 };
            }
            const addonsTotal = (item.addons || []).reduce((sum, a) => sum + (parseFloat(a.price) || 0), 0);
            report[id].qty += item.qty;
            report[id].revenue += (item.price + addonsTotal) * item.qty;
        });
    });
    
    const data = Object.values(report).sort((a,b) => b.qty - a.qty);
    
    // Create CSV content (com BOM para aceitar acentos no Excel)
    let csv = '\uFEFFProduto,Quantidade Vendida,Receita Total (R$)\n';
    data.forEach(row => {
       csv += `"${row.name}",${row.qty},${row.revenue.toFixed(2).replace('.', ',')}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Relatorio_Produtos_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-panel p-10 rounded-[1.5rem] h-[calc(100vh-140px)] flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      
      <div className="flex items-center gap-4 mb-8 shrink-0">
        <div className="w-14 h-14 bg-lacasa-primary/20 rounded-2xl flex justify-center items-center border border-lacasa-primary/50">
          <Settings className="text-lacasa-primary w-8 h-8" />
        </div>
        <div>
           <h2 className="text-4xl font-bold tracking-tight">Ajustes & Gerenciamento</h2>
           <span className="text-gray-400 font-medium">Configure sistema, Pix e fechamento de caixa</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex gap-8">
         
         <div className="w-[450px] shrink-0 flex flex-col gap-6 overflow-y-auto pr-2 pb-10">
            {/* PIX Settings */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-3 border-b border-white/10 pb-3">
                <QrCode className="text-[#32bcad] w-5 h-5" /> 
                Configurações PIX
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-400 block mb-1">Chave PIX:</label>
                  <input type="text" value={pixKey} onChange={e => setPixKey(e.target.value)} className="w-full bg-lacasa-bg border border-white/10 rounded-xl px-4 py-2 outline-none text-white focus:border-[#32bcad] transition-colors" placeholder="Telefone, CPF, Aleatória..." />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-bold text-gray-400 block mb-1">Nome no PIX:</label>
                    <input type="text" value={merchantName} onChange={e => setMerchantName(e.target.value)} className="w-full bg-lacasa-bg border border-white/10 rounded-xl px-4 py-2 outline-none text-white focus:border-[#32bcad] transition-colors" placeholder="La Casa de Pastel" />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-bold text-gray-400 block mb-1">Cidade:</label>
                    <input type="text" value={merchantCity} onChange={e => setMerchantCity(e.target.value)} className="w-full bg-lacasa-bg border border-white/10 rounded-xl px-4 py-2 outline-none text-white focus:border-[#32bcad] transition-colors" placeholder="SAO PAULO" />
                  </div>
                </div>
                <button className="magnetic-btn mt-2 bg-[#32bcad]/20 text-[#32bcad] hover:bg-[#32bcad] hover:text-white border border-[#32bcad]/30 px-6 py-3 rounded-xl font-bold transition-colors w-full">
                  Salvo Automaticamente
                </button>
              </div>
            </div>

            {/* Receipt Settings */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-3 border-b border-white/10 pb-3">
                <Receipt className="text-lacasa-primary w-5 h-5" /> 
                Configuração do Cupom
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-400 block mb-1">Nome no Cupom:</label>
                  <div className="relative">
                    <Type className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input type="text" value={receiptName} onChange={e => setReceiptName(e.target.value)} className="w-full pl-12 bg-lacasa-bg border border-white/10 rounded-xl px-4 py-2 outline-none text-white focus:border-lacasa-primary transition-colors uppercase font-bold" />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-400 block mb-1">Mensagem de Rodapé:</label>
                  <textarea rows="3" value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} className="w-full bg-lacasa-bg border border-white/10 rounded-xl px-4 py-2 outline-none text-white focus:border-lacasa-primary transition-colors resize-none"></textarea>
                </div>
              </div>
            </div>

            {/* TV Settings */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-3 border-b border-white/10 pb-3">
                <MonitorPlay className="text-purple-400 w-5 h-5" /> 
                Painel de Pedidos (TV)
              </h3>
              
              <div className="space-y-4">
                <p className="text-sm text-gray-400 font-medium">O sistema lista as telas conectadas para você forçar a abertura da TV em uma tela específica.</p>
                {availableDisplays.length > 0 && (
                   <div className="flex flex-col gap-1">
                     <label className="text-xs text-gray-500 font-bold uppercase">Selecione o Monitor:</label>
                     <select 
                       className="bg-lacasa-bg border border-white/10 text-white text-sm outline-none rounded-xl p-2 focus:border-purple-500"
                       value={selectedDisplay || ''}
                       onChange={e => setSelectedDisplay(parseInt(e.target.value))}
                     >
                        {availableDisplays.map(d => (
                          <option key={d.id} value={d.id}>{d.label}</option>
                        ))}
                     </select>
                   </div>
                )}
                <button 
                  onClick={() => {
                    if (window.require) {
                       const { ipcRenderer } = window.require('electron');
                       ipcRenderer.send('open-tv-display', selectedDisplay);
                    } else {
                       window.open('#/tv', '_blank', 'width=1280,height=720,fullscreen=yes');
                    }
                  }} 
                  className="magnetic-btn w-full bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white border border-purple-500/30 px-6 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <MonitorPlay className="w-5 h-5" /> Forçar Abertura da TV
                </button>
              </div>
            </div>
         </div>

         {/* History & Closure */}
         <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4 shrink-0">
               <h3 className="text-2xl font-bold flex items-center gap-3">
                  <History className="text-blue-400 w-6 h-6" /> Histórico do Turno Atual
               </h3>
               <button onClick={exportCSV} className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors text-sm">
                  <Download className="w-4 h-4" /> Exportar Relatório (CSV)
               </button>
            </div>

            <div className="flex gap-6 mb-6 shrink-0">
               <div className="flex-1 bg-lacasa-bg border border-white/10 p-5 rounded-2xl flex items-center gap-4">
                  <Receipt className="w-10 h-10 text-gray-500" />
                  <div>
                    <div className="text-gray-400 font-bold text-sm uppercase">Vendas Realizadas</div>
                    <div className="text-3xl font-black font-mono mt-1">{shiftSales.count}</div>
                  </div>
               </div>
               <div className="flex-1 bg-lacasa-bg border border-blue-500/20 p-5 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/50 text-blue-400 font-black text-xl">$</div>
                  <div>
                    <div className="text-blue-400 font-bold text-sm uppercase">Faturamento Total</div>
                    <div className="text-3xl font-black font-mono mt-1 text-white">R$ {(shiftSales.total || 0).toFixed(2)}</div>
                  </div>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto mb-6 border border-white/5 rounded-xl bg-lacasa-bg/50">
               <table className="w-full text-left border-collapse">
                  <thead className="bg-white/5 text-xs font-bold text-gray-400 uppercase tracking-wider sticky top-0 z-10 hidden sm:table-header-group">
                    <tr>
                      <th className="px-4 py-3 w-20">Senha</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Forma</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(salesHistory || []).map((sale, i) => (
                      <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors flex flex-col sm:table-row py-3 sm:py-0">
                        <td className="px-4 py-1 sm:py-3 font-mono font-bold text-lg">#{String(sale.senha).padStart(3,'0')}</td>
                        <td className="px-4 py-1 sm:py-3 font-mono text-lacasa-success font-bold">R$ {Number(sale.total||0).toFixed(2)}</td>
                        <td className="px-4 py-1 sm:py-3 font-bold text-gray-300">{sale.pagamento || 'Dinheiro'}</td>
                        <td className="px-4 py-1 sm:py-3">
                          <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-widest ${sale.status === 'preparando' ? 'bg-amber-500/20 text-amber-400' : sale.status === 'pronto' ? 'bg-lacasa-success/20 text-lacasa-success' : 'bg-blue-500/20 text-blue-400'}`}>
                            {sale.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 sm:py-3 text-right">
                           <div className="flex flex-wrap justify-end gap-2">
                             <button onClick={() => printSpecificReceipt('comanda', sale)} title="Reimprimir Comanda" className="bg-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors">
                               <Printer className="w-3 h-3"/> Comanda
                             </button>
                             <button onClick={() => printSpecificReceipt('cupom', sale)} title="Reimprimir Cupom" className="bg-[#32bcad]/20 text-[#32bcad] hover:bg-[#32bcad] hover:text-white px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors">
                               <Receipt className="w-3 h-3"/> Cupom
                             </button>
                             <button onClick={() => cancelSale(sale.senha)} title="Estornar Venda" className="bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors">
                               <XCircle className="w-3 h-3"/>
                             </button>
                           </div>
                        </td>
                      </tr>
                    ))}
                    {(!salesHistory || salesHistory.length===0) && (
                      <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-600 italic">Nenhuma venda registrada ainda.</td></tr>
                    )}
                  </tbody>
               </table>
            </div>

            <button onClick={closeRegister} className="magnetic-btn w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-colors shrink-0">
               <Lock className="w-5 h-5" /> Fechar Caixa e Zerar Turno
            </button>
         </div>

      </div>
    </div>
  );
};
export default SettingsArea;
