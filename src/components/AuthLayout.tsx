import type { ReactNode } from 'react';
import { env } from '@/lib/env';

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
}

/** Moldura comum das telas de login e cadastro. */
export function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <main className="auth">
      <section className="auth__card">
        <p className="auth__brand">{env.appName} · Painel clínico</p>
        <h1>{title}</h1>
        <p className="auth__subtitle">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}
