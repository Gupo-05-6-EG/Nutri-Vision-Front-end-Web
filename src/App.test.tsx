import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { detail, fakeApi, fakeJwt, json, loginResponse, nutritionist } from '@/test/fakeApi';

const patients = () =>
  json([{ paciente_id: 7, nome: 'Alex Silva', email: 'alex@email.com', status: 'ativo' }]);
const me = () => json(nutritionist);
const overview = () =>
  json({
    indicadores: {
      pacientes_ativos: 1,
      pacientes_pendentes: 0,
      alertas_criticos: 0,
      adesao_media_pct: 80,
      ofensiva_media_dias: 3,
    },
    contagens: { todos: 1, ativos: 1, em_risco: 0, pendentes: 0 },
    total: 1,
    pagina: 1,
    por_pagina: 10,
    pacientes: [
      {
        paciente_id: 7,
        nome: 'Alex Silva',
        email: 'alex@email.com',
        status_vinculo: 'ativo',
        vinculado_em: '2026-10-01T10:00:00Z',
        situacao: 'ativo',
        motivo_risco: null,
        meta_kcal: 2000,
        consumo_hoje_kcal: 0,
        adesao_semanal_pct: 80,
        ofensiva: 3,
        xp: 100,
        alertas_nao_lidos: 0,
        ultimo_registro: null,
      },
    ],
  });
const consumption = () =>
  json({ paciente_id: 7, data: '2026-11-11', quantidade_refeicoes: 0, totais: {} });

const loginHeading = () => screen.queryByRole('heading', { name: 'Bem-vindo de volta' });

async function login() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('E-mail profissional'), 'ana@exemplo.com');
  await user.type(screen.getByLabelText('Senha de acesso'), 'senha-forte-123');
  await user.click(screen.getByRole('button', { name: 'Entrar no painel clínico' }));
  return user;
}

const menu = () => screen.getByRole('navigation', { name: 'Menu do painel' });

beforeEach(() => {
  window.location.hash = '';
});

describe('App', () => {
  it('menu lateral leva a cada secao e guarda a secao no endereco', async () => {
    fakeApi({
      'POST /auth/login': () => loginResponse(),
      'GET /auth/me': me,
      'GET /patients': patients,
      'GET /nutricionista/visao-geral': overview,
      'GET /refeicoes/consumo-diario': consumption,
      'GET /alertas-desvio/regra': () =>
        json({ percentual_desvio: 20, dias_consecutivos: 2, ativo: true }),
      'GET /alertas-desvio': () => json([]),
    });
    render(<App />);
    const user = await login();

    const visao = await within(menu()).findByRole('link', { name: 'Visão Geral' });
    expect(visao).toHaveAttribute('aria-current', 'page');

    await user.click(within(menu()).getByRole('link', { name: 'Prescrição de Dietas' }));
    expect(window.location.hash).toBe('#/prescricao');
    expect(screen.getByRole('button', { name: 'Prescrever plano' })).toBeInTheDocument();
    expect(within(menu()).getByRole('link', { name: 'Prescrição de Dietas' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(within(menu()).getByRole('link', { name: 'Pacientes & Vínculos' }));
    expect(window.location.hash).toBe('#/pacientes');
    expect(await screen.findByRole('button', { name: /Alex Silva/ })).toBeInTheDocument();
  });

  it('topo mostra o profissional logado e nada de depuracao', async () => {
    const { calls } = fakeApi({
      'POST /auth/login': () => loginResponse(),
      'GET /auth/me': me,
      'GET /patients': patients,
      'GET /nutricionista/visao-geral': overview,
      'GET /refeicoes/consumo-diario': consumption,
    });
    render(<App />);
    await login();

    expect(await screen.findByText('Dra. Ana')).toBeInTheDocument();
    expect(screen.getByText('CRN-3 12345')).toBeInTheDocument();
    expect(screen.queryByText(/ambiente/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Conectado')).not.toBeInTheDocument();
    expect(calls.some((c) => c.path.startsWith('/health'))).toBe(false);
    // Todas as chamadas depois do login levam o token.
    const authed = calls.filter((c) => c.path !== '/auth/login');
    expect(authed.every((c) => c.headers.get('Authorization') === 'Bearer token-da-ana')).toBe(
      true,
    );
  });

  it('busca da barra superior abre pacientes ja filtrados', async () => {
    const { calls } = fakeApi({
      'POST /auth/login': () => loginResponse(),
      'GET /auth/me': me,
      'GET /patients': patients,
      'GET /nutricionista/visao-geral': overview,
      'GET /refeicoes/consumo-diario': consumption,
    });
    render(<App />);
    const user = await login();

    await user.type(screen.getByRole('searchbox', { name: 'Buscar paciente' }), 'alex{Enter}');

    expect(window.location.hash).toBe('#/pacientes?busca=alex');
    await screen.findByRole('button', { name: /Alex Silva/ });
    expect(
      calls.some(
        (c) => c.path.startsWith('/nutricionista/visao-geral') && c.path.includes('busca=alex'),
      ),
    ).toBe(true);
  });

  it('do historico do plano, Editar plano ativo abre o construtor ja carregado', async () => {
    const plan = {
      id: 2,
      paciente_id: 7,
      nutricionista_id: 10,
      titulo: 'Plano ajustado',
      observacao: null,
      ativo: true,
      criado_em: '2026-11-05T12:00:00Z',
      refeicoes: [
        {
          id: 1,
          nome: 'Almoço',
          horario: null,
          meta_kcal: 700,
          meta_proteinas_g: 40,
          observacao: null,
          alimentos: [{ id: 1, nome_alimento: 'Arroz', quantidade_g: 200, alimento_taco_id: null }],
        },
      ],
      totais: { meta_kcal: 700, meta_proteinas_g: 40 },
    };
    window.location.hash = '#/prescricao';
    fakeApi({
      'POST /auth/login': () => loginResponse(),
      'GET /auth/me': me,
      'GET /patients': patients,
      'GET /nutricionista/visao-geral': overview,
      'GET /pacientes/7/planos/versoes': () =>
        json([{ ...plan, versao: 1, autor: { id: 10, nome: 'Dra. Ana' } }]),
    });
    render(<App />);
    const user = await login();

    await user.click(await screen.findByRole('button', { name: 'Histórico do plano' }));
    await user.type(screen.getByLabelText('Id do paciente'), '7');
    await user.click(screen.getByRole('button', { name: 'Ver histórico' }));
    await user.click(await screen.findByRole('button', { name: 'Editar plano ativo' }));

    expect(screen.getByRole('button', { name: 'Construtor do plano' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await screen.findByLabelText(/^Título/)).toHaveValue('Plano ajustado');
  });

  it('Sair volta ao login e apaga o token', async () => {
    fakeApi({
      'POST /auth/login': () => loginResponse(),
      'GET /auth/me': me,
      'GET /patients': patients,
      'GET /nutricionista/visao-geral': overview,
      'GET /refeicoes/consumo-diario': consumption,
    });
    render(<App />);
    const user = await login();
    await screen.findByText('Dra. Ana');

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(loginHeading()).toBeInTheDocument();
    expect(localStorage.getItem('nutrivision.token')).toBeNull();
  });

  it('menu do celular abre e fecha', async () => {
    fakeApi({
      'POST /auth/login': () => loginResponse(),
      'GET /auth/me': me,
      'GET /patients': patients,
      'GET /nutricionista/visao-geral': overview,
      'GET /refeicoes/consumo-diario': consumption,
    });
    render(<App />);
    const user = await login();

    const toggle = await screen.findByRole('button', { name: 'Abrir menu' });
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('restaura a sessao salva com token valido', async () => {
    const token = fakeJwt(1);
    localStorage.setItem('nutrivision.token', token);
    const { calls } = fakeApi({
      'GET /auth/me': me,
      'GET /patients': patients,
      'GET /nutricionista/visao-geral': overview,
      'GET /refeicoes/consumo-diario': consumption,
    });

    render(<App />);

    expect(loginHeading()).not.toBeInTheDocument();
    expect(await screen.findByText('Dra. Ana')).toBeInTheDocument();
    expect(calls[0].headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('401 da API encerra a sessao e avisa no login', async () => {
    localStorage.setItem('nutrivision.token', fakeJwt(1));
    fakeApi({
      'GET /auth/me': () => detail('Token invalido', 401),
      'GET /patients': () => detail('Token invalido', 401),
    });

    render(<App />);

    expect(await screen.findByRole('status')).toHaveTextContent('Sua sessão expirou.');
    expect(loginHeading()).toBeInTheDocument();
    expect(localStorage.getItem('nutrivision.token')).toBeNull();
  });
});
