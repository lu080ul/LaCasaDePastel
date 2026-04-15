import React, { useState } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../../firebase/config';
import { Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

const AdminLogin = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isFirebaseConfigured()) {
    return (
      <div className="min-h-screen bg-lacasa-bg flex items-center justify-center p-4">
        <div className="glass-panel max-w-md w-full p-8 rounded-[2rem]">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Firebase não configurado</h2>
            <p className="text-gray-400 text-sm">
              Configure as variáveis de ambiente do Firebase no arquivo <code className="bg-white/10 px-2 py-1 rounded">.env</code>
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 text-sm text-gray-300">
            <p className="font-bold text-white mb-2">Passos para configurar:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Crie um projeto no <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-lacasa-primary hover:underline">Firebase Console</a></li>
              <li>Copie <code className="bg-white/10 px-1 rounded">.env.example</code> para <code className="bg-white/10 px-1 rounded">.env</code></li>
              <li>Preencha as credenciais do Firebase</li>
              <li>Habilite Authentication > Email/Password</li>
              <li>Crie um usuário admin</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLogin();
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

  return (
    <div className="min-h-screen bg-lacasa-bg flex items-center justify-center p-4">
      <div className="glass-panel max-w-md w-full p-8 rounded-[2rem]">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-lacasa-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-lacasa-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Painel Admin</h1>
          <p className="text-gray-400">La Casa de Pastel</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
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
              'Entrar'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  return { user, loading, logout };
};

export default AdminLogin;
