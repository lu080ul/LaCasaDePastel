import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle, Loader2, Store } from 'lucide-react';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase/config';

const LoginPage = () => {
  const navigate = useNavigate();
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isFirebaseConfigured()) {
      setError('Firebase não está configurado. Configure as variáveis de ambiente.');
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin');
    } catch (err) {
      const errorMessages = {
        'auth/invalid-email': 'Email inválido',
        'auth/user-disabled': 'Usuário desativado',
        'auth/user-not-found': 'Usuário não encontrado',
        'auth/wrong-password': 'Senha incorreta',
        'auth/invalid-credential': 'Email ou senha incorretos',
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
      };
      setError(errorMessages[err.code] || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleOperatorAccess = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-lacasa-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-lacasa-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store className="w-10 h-10 text-lacasa-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">La Casa de Pastel</h1>
          <p className="text-gray-400">Sistema PDV</p>
        </div>

        <div className="glass-panel p-8 rounded-[2rem]">
          {!isAdminMode ? (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white mb-2">Bem-vindo!</h2>
                <p className="text-gray-400 text-sm">Escolha como deseja acessar</p>
              </div>

              <button
                onClick={handleOperatorAccess}
                className="magnetic-btn w-full bg-lacasa-success hover:bg-emerald-400 py-4 rounded-xl font-bold text-lacasa-bg shadow-[0_4px_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-3 transition-colors"
              >
                <User className="w-5 h-5" />
                Acessar como Operador
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-lacasa-panel text-gray-400">ou</span>
                </div>
              </div>

              <button
                onClick={() => setIsAdminMode(true)}
                className="w-full bg-white/5 hover:bg-white/10 py-3 rounded-xl font-bold text-gray-300 flex items-center justify-center gap-2 transition-colors border border-white/10"
              >
                <Lock className="w-4 h-4" />
                Acessar como Administrador
              </button>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setIsAdminMode(false)}
                className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1"
              >
                ← Voltar
              </button>

              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white mb-2">Painel Admin</h2>
                <p className="text-gray-400 text-sm">Acesso restrito</p>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2">
                    <Lock className="w-4 h-4 inline mr-2" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-lacasa-primary transition-colors"
                    placeholder="admin@lacasa.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2">
                    <Lock className="w-4 h-4 inline mr-2" />
                    Senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-lacasa-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-lacasa-primary transition-colors"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="magnetic-btn w-full bg-lacasa-primary hover:bg-rose-500 py-4 rounded-xl font-bold text-white shadow-[0_4px_15px_rgba(225,29,72,0.3)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      Entrar
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          La Casa PDV v1.4.0
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
