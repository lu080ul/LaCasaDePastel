import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, X, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * UpdateNotifier — Componente de auto-atualização integrado ao electron-updater.
 * Aparece discretamente no canto inferior direito quando há nova versão.
 */
const UpdateNotifier = () => {
  const [state, setState] = useState('idle'); // idle | available | downloading | downloaded | error
  const [progress, setProgress] = useState(0);
  const [versionInfo, setVersionInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Só funciona dentro do Electron
    if (!window.require) return;

    const { ipcRenderer } = window.require('electron');

    ipcRenderer.on('update-available', (_, info) => {
      setVersionInfo(info);
      setState('available');
      setDismissed(false);
    });

    ipcRenderer.on('update-not-available', () => {
      // Silencioso — sem notificação
    });

    ipcRenderer.on('download-progress', (_, data) => {
      setState('downloading');
      setProgress(Math.round(data.percent || 0));
    });

    ipcRenderer.on('update-downloaded', (_, info) => {
      setVersionInfo(info);
      setState('downloaded');
    });

    ipcRenderer.on('update-error', (_, msg) => {
      setErrorMsg(msg);
      setState('error');
    });

    return () => {
      ipcRenderer.removeAllListeners('update-available');
      ipcRenderer.removeAllListeners('update-not-available');
      ipcRenderer.removeAllListeners('download-progress');
      ipcRenderer.removeAllListeners('update-downloaded');
      ipcRenderer.removeAllListeners('update-error');
    };
  }, []);

  const handleDownload = () => {
    if (!window.require) return;
    const { ipcRenderer } = window.require('electron');
    ipcRenderer.send('start-update-download');
    setState('downloading');
  };

  const handleInstall = () => {
    if (!window.require) return;
    const { ipcRenderer } = window.require('electron');
    ipcRenderer.send('install-update');
  };

  if (dismissed || state === 'idle') return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        width: '340px',
        animation: 'slideInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        background: 'linear-gradient(135deg, rgba(15,15,25,0.97) 0%, rgba(20,20,35,0.97) 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '1rem',
        padding: '1.25rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {state === 'error' ? (
              <AlertCircle style={{ width: '20px', height: '20px', color: '#ef4444', flexShrink: 0 }} />
            ) : state === 'downloaded' ? (
              <CheckCircle style={{ width: '20px', height: '20px', color: '#22c55e', flexShrink: 0 }} />
            ) : (
              <Download style={{ width: '20px', height: '20px', color: '#f59e0b', flexShrink: 0 }} />
            )}
            <span style={{ fontWeight: 800, fontSize: '0.875rem', color: '#fff', letterSpacing: '-0.01em' }}>
              {state === 'available' && 'Atualização Disponível'}
              {state === 'downloading' && 'Baixando Atualização...'}
              {state === 'downloaded' && 'Pronto para Instalar!'}
              {state === 'error' && 'Erro na Atualização'}
            </span>
          </div>
          {state !== 'downloading' && (
            <button
              onClick={() => setDismissed(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px', lineHeight: 1 }}
            >
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          )}
        </div>

        {/* Version info */}
        {versionInfo && (
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 0.75rem 0' }}>
            {state === 'downloaded'
              ? `Versão ${versionInfo.version} pronta. Reinicie para aplicar.`
              : `Versão ${versionInfo.version} disponível.`}
          </p>
        )}

        {/* Error message */}
        {state === 'error' && errorMsg && (
          <p style={{ fontSize: '0.75rem', color: '#f87171', margin: '0 0 0.75rem 0' }}>{errorMsg}</p>
        )}

        {/* Progress bar */}
        {state === 'downloading' && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                borderRadius: '999px',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <p style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '4px', textAlign: 'right' }}>{progress}%</p>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {state === 'available' && (
            <>
              <button
                onClick={() => setDismissed(true)}
                style={{
                  flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)',
                  background: 'transparent', color: '#9ca3af', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Depois
              </button>
              <button
                onClick={handleDownload}
                style={{
                  flex: 2, padding: '0.5rem', borderRadius: '0.5rem', border: 'none',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000',
                  fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                }}
              >
                <Download style={{ width: '14px', height: '14px' }} /> Baixar Agora
              </button>
            </>
          )}

          {state === 'downloaded' && (
            <button
              onClick={handleInstall}
              style={{
                flex: 1, padding: '0.6rem', borderRadius: '0.5rem', border: 'none',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff',
                fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}
            >
              <RefreshCw style={{ width: '16px', height: '16px' }} /> Reiniciar e Instalar
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default UpdateNotifier;
