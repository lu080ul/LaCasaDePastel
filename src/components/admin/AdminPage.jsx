import React from 'react';
import AdminLogin, { useAuth } from './AdminLogin';
import AdminDashboard from './AdminDashboard';

const AdminPage = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-lacasa-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lacasa-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return user ? <AdminDashboard /> : <AdminLogin />;
};

export default AdminPage;
