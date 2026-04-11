import React, { useState } from 'react';
import { useAppContext } from '../store/Store';
import { PackageCheck, BellRing, ChefHat, CheckCircle2, ArrowRight, Clock } from 'lucide-react';
import logoIcon from '../assets/logotipo.jpg';

const DespachoDisplay = () => {
  const { salesHistory, setSalesHistory } = useAppContext();
  const [dispatching, setDispatching] = useState(false);

  const preparando = (salesHistory || [])
    .filter(s => s.status === 'preparando')
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const pronto = (salesHistory || [])
    .filter(s => s.status === 'pronto')
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const changeStatus = (id, newStatus) => {
    setSalesHistory((salesHistory || []).map(sale =>
      sale.senha === id ? { ...sale, status: newStatus } : sale
    ));
  };

  const callAgain = (id) => {
    setSalesHistory((salesHistory || []).map(sale =>
      sale.senha === id ? { ...sale, callAgainAt: Date.now() } : sale
    ));
  };

  const dispatchAllReady = () => {
    if (pronto.length === 0) return;
    setDispatching(true);
    setSalesHistory((salesHistory || []).map(sale =>
      sale.status === 'pronto' ? { ...sale, status: 'entregue' } : sale
    ));
    setTimeout(() => setDispatching(false), 1200);
  };

  /* ─── Card de pedido ─── */
  const OrderCard = ({ order, variant }) => {
    const isReady = variant === 'pronto';
    return (
      <div style={{
        borderRadius: '1.5rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        background: isReady ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
        border: isReady ? '2px solid rgba(16,185,129,0.5)' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: isReady ? '0 0 40px rgba(16,185,129,0.1)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        {/* Senha + Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: 900,
            fontFamily: 'monospace',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            color: isReady ? '#10b981' : '#9ca3af',
          }}>
            #{String(order.senha).padStart(3, '0')}
          </span>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: '0.25rem 0.75rem',
            borderRadius: '0.5rem',
            background: isReady ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.15)',
            color: isReady ? '#10b981' : '#f59e0b',
            border: isReady ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.25)',
          }}>
            {order.status}
          </span>
        </div>

        {/* Itens */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {(order.items || []).map((item, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#e5e7eb' }}>
                <span style={{ color: isReady ? '#10b981' : '#f59e0b', fontFamily: 'monospace', marginRight: '0.5rem' }}>{item.qty}x</span>
                {item.name}
              </span>
              {item.observation && (
                <span style={{ fontSize: '0.8rem', color: '#f59e0b', marginLeft: '1.5rem' }}>Obs: {item.observation}</span>
              )}
              {(item.addons || []).map((ad, i) => (
                <span key={i} style={{ fontSize: '0.8rem', color: '#6ee7b7', marginLeft: '1.5rem' }}>+ {ad.name}</span>
              ))}
            </div>
          ))}
          {order.observation && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.75rem',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.2)',
              fontSize: '0.85rem',
              color: '#f59e0b',
              fontWeight: 700,
            }}>
              📋 {order.observation}
            </div>
          )}
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
          {order.status === 'preparando' ? (
            <button
              onClick={() => changeStatus(order.senha, 'pronto')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem',
                borderRadius: '1rem',
                border: '1px solid rgba(16,185,129,0.5)',
                background: 'rgba(16,185,129,0.2)',
                color: '#10b981',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.2)'; e.currentTarget.style.color = '#10b981'; }}
            >
              <CheckCircle2 size={20} /> Pronto
            </button>
          ) : (
            <button
              onClick={() => callAgain(order.senha)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem',
                borderRadius: '1rem',
                border: '1px solid rgba(245,158,11,0.4)',
                background: 'rgba(245,158,11,0.15)',
                color: '#f59e0b',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f59e0b'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.15)'; e.currentTarget.style.color = '#f59e0b'; }}
            >
              <BellRing size={18} /> Chamar Novamente
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0a0a0a',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      overflow: 'hidden',
      padding: '1.5rem 2rem 2rem',
      boxSizing: 'border-box',
      gap: '1.5rem',
      color: '#fff',
    }}>

      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img src={logoIcon} alt="La Casa" style={{ height: '56px', objectFit: 'contain', borderRadius: '0.75rem' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
              Painel de Despacho
            </h1>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Entrega de Pedidos
            </span>
          </div>
        </div>

        {/* Botão Despachar Todos */}
        <button
          onClick={dispatchAllReady}
          disabled={pronto.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.85rem 1.5rem',
            borderRadius: '999px',
            border: pronto.length === 0 ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(16,185,129,0.4)',
            background: pronto.length === 0 ? 'rgba(255,255,255,0.03)' : dispatching ? '#10b981' : 'rgba(16,185,129,0.15)',
            color: pronto.length === 0 ? 'rgba(255,255,255,0.2)' : dispatching ? '#fff' : '#10b981',
            fontWeight: 800,
            fontSize: '1.1rem',
            cursor: pronto.length === 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            position: 'relative',
          }}
        >
          <PackageCheck size={22} style={dispatching ? { animation: 'bounce 0.5s ease infinite alternate' } : {}} />
          {dispatching ? 'Despachando...' : 'Despachar Todos'}
          {pronto.length > 0 && !dispatching && (
            <span style={{
              position: 'absolute',
              top: '-0.5rem',
              right: '-0.5rem',
              width: '1.6rem',
              height: '1.6rem',
              borderRadius: '999px',
              background: '#10b981',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16,185,129,0.5)',
            }}>
              {pronto.length}
            </span>
          )}
        </button>
      </header>

      {/* Corpo — duas colunas */}
      <main style={{ flex: 1, display: 'flex', gap: '1.5rem', minHeight: 0, overflow: 'hidden' }}>
        
        {/* Coluna Preparando */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '1.5rem',
          padding: '1.5rem',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(245,158,11,0.1)',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Clock size={24} style={{ color: '#f59e0b' }} />
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>Preparando</h2>
            </div>
            {preparando.length > 0 && (
              <span style={{
                background: 'rgba(245,158,11,0.15)',
                border: '1px solid rgba(245,158,11,0.3)',
                color: '#f59e0b',
                borderRadius: '999px',
                padding: '0.15rem 0.65rem',
                fontSize: '0.95rem',
                fontWeight: 800,
                fontFamily: 'monospace',
              }}>{preparando.length}</span>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {preparando.length > 0 ? preparando.map(order => (
              <OrderCard key={order.senha} order={order} variant="preparando" />
            )) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.15)', fontStyle: 'italic', fontSize: '1.1rem' }}>
                Nenhum pedido em preparo
              </div>
            )}
          </div>
        </div>

        {/* Coluna Prontos */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '1.5rem',
          padding: '1.5rem',
          background: 'rgba(16,185,129,0.03)',
          border: '1px solid rgba(16,185,129,0.15)',
          boxShadow: 'inset 0 0 60px rgba(16,185,129,0.03)',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle2 size={24} style={{ color: '#10b981' }} />
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>Prontos</h2>
            </div>
            {pronto.length > 0 && (
              <span style={{
                background: 'rgba(16,185,129,0.15)',
                border: '1px solid rgba(16,185,129,0.3)',
                color: '#10b981',
                borderRadius: '999px',
                padding: '0.15rem 0.65rem',
                fontSize: '0.95rem',
                fontWeight: 800,
                fontFamily: 'monospace',
              }}>{pronto.length}</span>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pronto.length > 0 ? pronto.map(order => (
              <OrderCard key={order.senha} order={order} variant="pronto" />
            )) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.15)', fontStyle: 'italic', fontSize: '1.1rem' }}>
                Nenhum pedido pronto
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Inline animation keyframe */}
      <style>{`
        @keyframes bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
};

export default DespachoDisplay;
