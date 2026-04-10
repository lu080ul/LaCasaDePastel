import React, { useEffect, useState, useRef } from 'react';
import { useAppContext } from '../store/Store';
import { Store } from 'lucide-react';
import gsap from 'gsap';
import logoIcon from '../assets/logotipo.jpg';

const TVDisplay = () => {
  const { salesHistory } = useAppContext();
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [flashQueue, setFlashQueue] = useState([]);
  const [activeFlash, setActiveFlash] = useState(null);
  const audioCtxRef = useRef(null);
  
  // Keep track of the senhas we have already seen as "pronto"
  const processedSenhas = useRef(new Set());

  const preparando = salesHistory.filter(s => s.status === 'preparando').slice(0, 12);
  const pronto = salesHistory.filter(s => s.status === 'pronto').slice(0, 12);

  // Initializing audio lazily inline when playing
  const initAudioIfNeeded = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!audioCtxRef.current && AudioContext) {
       audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
       audioCtxRef.current.resume().catch(err => console.log(err));
    }
  };

  const playCinematicAlert = () => {
    initAudioIfNeeded();
    if (!audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      
      const playTone = (type, freq, timeOffset, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + timeOffset);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + timeOffset);
        gain.gain.linearRampToValueAtTime(1, ctx.currentTime + timeOffset + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + timeOffset + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + timeOffset);
        osc.stop(ctx.currentTime + timeOffset + duration);
      };

      // Tensão "La Casa de Papel": Baixo grave + Sino de Alerta
      // 1. Grave continuo crescendo
      playTone('sine', 60, 0, 3);
      // 2. Acorde Menor (Sino suspense)
      playTone('triangle', 329.63, 0.4, 2); // E4
      playTone('triangle', 392.00, 0.6, 2); // G4
      playTone('triangle', 493.88, 0.8, 3); // B4

    } catch (e) {
      console.error("Erro ao tocar áudio", e);
    }
  };

  useEffect(() => {
    // Check for NEW pronto items not seen before
    const newProntos = pronto.filter(p => !processedSenhas.current.has(p.senha));
    
    if (newProntos.length > 0) {
      newProntos.forEach(p => processedSenhas.current.add(p.senha)); // Mark as seen
      
      // Add senhas to the queue
      const senhasToAlert = newProntos.map(p => p.senha);
      setFlashQueue(prev => [...prev, ...senhasToAlert]);
    }
  }, [pronto]);

  // Queue Processor
  useEffect(() => {
    if (flashQueue.length > 0 && !activeFlash) {
      const nextSenha = flashQueue[0];
      setActiveFlash(nextSenha);
      playCinematicAlert();
      
      // Flash dura mais tempo (8 segundos)
      setTimeout(() => {
        setActiveFlash(null);
        setFlashQueue(prev => prev.slice(1));
      }, 8000);
    }
  }, [flashQueue, activeFlash]);

  return (
    <div className="w-full h-screen flex flex-col pt-6 font-sans overflow-hidden" style={{backgroundColor: '#000000'}}>
      

      
      {/* Header */}
      <header className="px-10 flex items-center justify-between z-10 mb-8">
        <div className="flex items-center gap-4">
          <img src={logoIcon} alt="La Casa" className="h-16 md:h-20 object-contain" />
        </div>
        <div className="text-gray-400 font-mono tracking-widest uppercase">
          Status dos Pedidos
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 flex gap-8 px-10 pb-10 h-[calc(100vh-120px)]">
        
        {/* Preparando Col */}
        <div className="flex-1 glass-panel rounded-[3rem] p-10 flex flex-col border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          <h2 className="text-5xl font-bold mb-10 tracking-tighter text-gray-300">Preparando</h2>
          
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max overflow-y-auto pr-4">
            {preparando.length > 0 ? preparando.map(order => (
              <div key={order.senha} className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center shadow-[0_8px_20px_rgba(0,0,0,0.5)]">
                 <span className="text-5xl font-mono font-black text-gray-400">#{String(order.senha).padStart(3, '0')}</span>
              </div>
            )) : <span className="text-2xl text-gray-500 italic">Nenhum pedido na fila</span>}
          </div>
        </div>

        {/* Pronto Col */}
        <div className="flex-1 glass-panel rounded-[3rem] p-10 flex flex-col border border-lacasa-success/20 relative overflow-hidden shadow-[inset_0_0_80px_rgba(16,185,129,0.05)]">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-lacasa-success/50 to-transparent"></div>
          <h2 className="text-5xl font-bold mb-10 tracking-tighter text-lacasa-success">Pronto</h2>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max overflow-y-auto pr-4">
            {pronto.length > 0 ? pronto.map(order => (
              <div key={order.senha} className="bg-lacasa-success/20 border-2 border-lacasa-success rounded-3xl p-6 text-center transform transition-transform hover:scale-105">
                 <span className="text-5xl font-mono font-black text-white">#{String(order.senha).padStart(3, '0')}</span>
              </div>
            )) : <span className="text-2xl text-gray-500 italic">Nenhum pedido aguardando retirada</span>}
          </div>
        </div>

      </main>

      {/* Flash Cinematic Overlay */}
      <div 
        className={`fixed inset-0 bg-lacasa-primary z-[100] flex flex-col justify-center items-center text-white transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${activeFlash ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'}`}
      >
        <h1 className="text-[180px] font-black tracking-tighter leading-none mb-4" style={{textShadow: '0 20px 40px rgba(0,0,0,0.5)'}}>
          #{activeFlash ? String(activeFlash).padStart(3, '0') : '000'}
        </h1>
        <p className="text-7xl font-bold tracking-widest uppercase opacity-90">Pronto para retirada</p>
      </div>

    </div>
  );
};

export default TVDisplay;
