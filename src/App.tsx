/**
 * Casca do painel do nutricionista: sem sessão mostra login/cadastro, com
 * sessão mostra o painel. As demais telas entram nas Tasks 1.5 e 5.x.
 */

import { useState } from 'react';
import { AuthProvider } from '@/auth/AuthProvider';
import { useAuth } from '@/auth/useAuth';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';

function GuestScreens() {
  const [view, setView] = useState<'login' | 'register'>('login');

  return view === 'login' ? (
    <LoginPage onGoToRegister={() => setView('register')} />
  ) : (
    <RegisterPage onGoToLogin={() => setView('login')} />
  );
}

function Gate() {
  const { status } = useAuth();
  return status === 'authenticated' ? <HomePage /> : <GuestScreens />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
