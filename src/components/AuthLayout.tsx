import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
}

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'apple',
    title: 'Prescrição com a TACO',
    text: 'Monte planos com os alimentos da tabela TACO e metas por refeição.',
  },
  {
    icon: 'grid',
    title: 'Registro por foto com IA',
    text: 'Os pacientes fotografam o prato e a IA identifica os alimentos e as porções.',
  },
  {
    icon: 'alert',
    title: 'Alertas de desvio',
    text: 'Saiba quando um paciente se afasta da meta ou para de registrar.',
  },
];

/** Moldura das telas de login e cadastro: apresentação à esquerda, formulário à direita. */
export function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <main className="auth">
      <aside className="auth__intro" aria-label="Sobre o Nutri Vision">
        <div className="brand">
          <span className="brand__logo">
            <Icon name="leaf" size={22} />
          </span>
          <span>
            <strong>Nutri Vision</strong>
            <small>Painel Clínico</small>
          </span>
        </div>
        <h2 className="auth__headline">
          Acompanhamento nutricional inteligente e integrado à visão computacional.
        </h2>
        <p className="auth__lead">
          Planos com a tabela TACO, registro das refeições por foto e gamificação para manter os
          seus pacientes engajados.
        </p>
        <ul className="auth__features">
          {FEATURES.map((feature) => (
            <li key={feature.title}>
              <span className="auth__feature-icon">
                <Icon name={feature.icon} size={18} />
              </span>
              <span>
                <strong>{feature.title}</strong>
                <small>{feature.text}</small>
              </span>
            </li>
          ))}
        </ul>
        <p className="auth__lgpd muted">
          <Icon name="check" size={14} /> Dados de saúde protegidos conforme a LGPD.
        </p>
      </aside>
      <section className="auth__card">
        <p className="auth__brand">Nutri Vision · Painel clínico</p>
        <h1>{title}</h1>
        <p className="auth__subtitle">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}
