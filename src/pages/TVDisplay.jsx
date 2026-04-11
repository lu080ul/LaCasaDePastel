import React, { useEffect, useState, useRef } from 'react';
import { useAppContext } from '../store/Store';
import gsap from 'gsap';
import logoIcon from '../assets/logotipo.jpg';

const TVDisplay = () => {
  const { salesHistory } = useAppContext();
  const [flashQueue, setFlashQueue] = useState([]);
  const [activeFlash, setActiveFlash] = useState(null);
  const audioCtxRef = useRef(null);
  const processedSenhas = useRef(new Set());

  const preparando = salesHistory.filter(s => s.status === 'preparando').slice(0, 12);
  const pronto     = salesHistory.filter(s => s.status === 'pronto').slice(0, 12);

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
        const osc  = ctx.createOscillator();
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
      playTone('sine',     60,     0,   3);
      playTone('triangle', 329.63, 0.4, 2);
      playTone('triangle', 392.00, 0.6, 2);
      playTone('triangle', 493.88, 0.8, 3);
    } catch (e) {
      console.error('Erro ao tocar áudio', e);
    }
  };

  useEffect(() => {
    const newProntos = pronto.filter(p => !processedSenhas.current.has(p.senha));
    if (newProntos.length > 0) {
      newProntos.forEach(p => processedSenhas.current.add(p.senha));
      setFlashQueue(prev => [...prev, ...newProntos.map(p => p.senha)]);
    }
  }, [pronto]);

  // Detecta "Chamar Novamente" — campo callAgainAt foi atualizado
  const lastCallAgain = useRef({});
  useEffect(() => {
    pronto.forEach(order => {
      const prev = lastCallAgain.current[order.senha];
      const curr = order.callAgainAt;
      if (curr && curr !== prev) {
        lastCallAgain.current[order.senha] = curr;
        // Só adiciona à fila se não estiver já aguardando
        setFlashQueue(q => {
          if (q.includes(order.senha)) return q;
          return [...q, order.senha];
        });
      }
    });
  }, [pronto]);

  useEffect(() => {
    if (flashQueue.length > 0 && !activeFlash) {
      const nextSenha = flashQueue[0];
      setActiveFlash(nextSenha);
      playCinematicAlert();
      setTimeout(() => {
        setActiveFlash(null);
        setFlashQueue(prev => prev.slice(1));
      }, 8000);
    }
  }, [flashQueue, activeFlash]);

  /* ─── Card de senha ─── */
  const SenhaCard = ({ order, variant }) => {
    const isReady = variant === 'pronto';
    return (
      <div style={{
        borderRadius: '1rem',
        padding: '1rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.25rem',
        background: isReady ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
        border: isReady ? '2px solid rgba(16,185,129,0.6)' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: isReady ? '0 0 30px rgba(16,185,129,0.15)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        {/* Número grande */}
        <span style={{
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          fontWeight: 900,
          fontFamily: 'monospace',
          letterSpacing: '-0.04em',
          lineHeight: 1,
          color: isReady ? '#ffffff' : '#9ca3af',
        }}>
          #{String(order.senha).padStart(3, '0')}
        </span>
        {/* Itens resumidos */}
        {(order.items || []).length > 0 && (
          <div style={{
            fontSize: 'clamp(0.65rem, 1.2vw, 0.85rem)',
            color: isReady ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {order.items.map(i => `${i.qty}x ${i.name}`).join(' · ')}
          </div>
        )}
      </div>
    );
  };

  /* ─── Coluna ─── */
  const Column = ({ title, orders, variant, accentColor }) => (
    <div style={{
      flex: 1,
      borderRadius: '2rem',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${accentColor}22`,
      boxShadow: variant === 'pronto' ? `inset 0 0 80px ${accentColor}08` : 'none',
      overflow: 'hidden',
    }}>
      {/* Título da coluna */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        flexShrink: 0,
      }}>
        <h2 style={{
          fontSize: 'clamp(1.8rem, 3vw, 2.8rem)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: accentColor,
          margin: 0,
        }}>{title}</h2>
        {orders.length > 0 && (
          <span style={{
            background: `${accentColor}22`,
            border: `1px solid ${accentColor}44`,
            color: accentColor,
            borderRadius: '999px',
            padding: '0.25rem 0.9rem',
            fontSize: '1.1rem',
            fontWeight: 800,
            fontFamily: 'monospace',
          }}>{orders.length}</span>
        )}
      </div>

      {/* Grade Dinâmica Auto-Fill para comportar muitos itens */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(110px, 15vw, 160px), 1fr))',
        gap: '0.75rem',
        alignContent: 'start',
      }}>
        {orders.length > 0
          ? orders.map(order => (
              <SenhaCard key={order.senha} order={order} variant={variant} />
            ))
          : (
            <span style={{
              gridColumn: '1 / -1',
              color: 'rgba(255,255,255,0.2)',
              fontStyle: 'italic',
              fontSize: '1.2rem',
              paddingTop: '1rem',
            }}>
              {variant === 'pronto' ? 'Nenhum pedido pronto' : 'Nenhum pedido na fila'}
            </span>
          )
        }
      </div>
    </div>
  );

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: localStorage.getItem('lacasa_tv_bg') || '#000000',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      overflow: 'hidden',
      padding: '1.5rem 2rem 2rem',
      boxSizing: 'border-box',
      gap: '1.5rem',
    }}>

      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <img src={logoIcon} alt="La Casa" style={{ height: '64px', objectFit: 'contain' }} />
        <span style={{
          color: 'rgba(255,255,255,0.3)',
          fontFamily: 'monospace',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          fontSize: '0.85rem',
        }}>
          Status dos Pedidos
        </span>
      </header>

      {/* Colunas principais */}
      <main style={{ flex: 1, display: 'flex', gap: '1.5rem', minHeight: 0 }}>
        <Column
          title="Preparando"
          orders={preparando}
          variant="preparando"
          accentColor="#9ca3af"
        />
        <Column
          title="✓ Pronto"
          orders={pronto}
          variant="pronto"
          accentColor="#10b981"
        />
      </main>

      {/* Flash Overlay */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
        opacity: activeFlash ? 1 : 0,
        transform: activeFlash ? 'scale(1)' : 'scale(1.05)',
        pointerEvents: activeFlash ? 'auto' : 'none',
      }}>
        <p style={{
          fontSize: 'clamp(1.5rem, 4vw, 3rem)',
          fontWeight: 700,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.7)',
          margin: 0,
        }}>Pedido Pronto</p>
        <h1 style={{
          fontSize: 'clamp(8rem, 28vw, 22rem)',
          fontWeight: 900,
          fontFamily: 'monospace',
          letterSpacing: '-0.04em',
          lineHeight: 0.85,
          color: '#fff',
          textShadow: '0 20px 60px rgba(0,0,0,0.5)',
          margin: 0,
        }}>
          #{activeFlash ? String(activeFlash).padStart(3, '0') : '000'}
        </h1>
        <p style={{
          fontSize: 'clamp(1.2rem, 3vw, 2.5rem)',
          fontWeight: 700,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.85)',
          margin: 0,
        }}>Retire no balcão</p>
      </div>

    </div>
  );
};

export default TVDisplay;
