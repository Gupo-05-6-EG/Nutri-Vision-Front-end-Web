# Nutri Vision — Painel Web (nutricionista)

Painel do nutricionista, em **React 19 + TypeScript + Vite**.

## Stack

| Camada | Tecnologia |
|---|---|
| Build | Vite 8 |
| UI | React 19 + TypeScript |
| Lint | oxlint |
| Formatação | Prettier |
| CI | GitHub Actions |

## Estrutura

```
src/
├── main.tsx        # bootstrap do React
├── App.tsx         # casca do painel
├── components/     # componentes reutilizáveis (plan/: blocos e busca de alimento)
├── pages/          # uma pasta/arquivo por tela (PatientsPage: vínculos, RF15)
├── lib/
│   ├── env.ts      # leitura validada das variáveis VITE_*
│   ├── api.ts      # cliente HTTP + injeção do JWT
│   ├── plans.ts    # API e rascunho do construtor de planos
│   └── planHistory.ts # histórico de versões do plano e "o que mudou"
└── types/          # tipos compartilhados
```

O alias `@/` aponta para `src/` (configurado em `vite.config.ts` e `tsconfig.app.json`).

## Telas

### Login e cadastro (Task 1.2)

`src/auth/AuthProvider.tsx`: o token fica no `localStorage` e é injetado em todas as
chamadas; um 401 com sessão aberta volta para o login com o aviso de sessão expirada.

Depois de entrar, a home tem quatro abas: **Pacientes** (vínculos e alertas de abandono,
Tasks 1.5 e 5.2), **Planos alimentares** (Task 5.1), **Histórico do plano** (Task 5.3)
e **Dashboards** (Task 5.2).

### Dashboards e alertas de abandono (Task 5.2, RF07.1, RF10.1)

- **Alerta de abandono (`src/pages/PatientsPage.tsx`, `src/lib/linksApi.ts`)**: exibe um
  ícone e selo vermelho de advertência (`Alerta de abandono`) na lista de pacientes e no
  dashboard quando `streak === 0` por 3 ou mais dias consecutivos (`dias_streak_zero >= 3`
  ou `alerta_abandono = true`).
- **Gráfico de 7 dias (`src/pages/DashboardPage.tsx`, `src/components/dashboard/SevenDayCaloriesChart.tsx`)**:
  utiliza **Recharts** (`LineChart`) para comparar a **Linha de Meta Calórica** (fixa, a partir
  do plano ativo em `GET /pacientes/{id}/planos/ativo`) com a **Linha de Consumo Real**
  (`GET /refeicoes/consumo-diario` nos últimos 7 dias), além de indicadores de média consumida
  e dias dentro da meta.

### Construtor de planos alimentares (Task 5.1, RF09.1)

`src/pages/PlanBuilderPage.tsx`. O nutricionista:

1. informa o **id do paciente** e,
   se quiser, carrega o plano ativo dele para partir dele;
2. dá título e orientações gerais ao plano;
3. monta os **blocos de refeição**: nome (com sugestões: café da manhã, ceia...),
   horário, **meta de kcal** e **meta de proteínas**, e a **lista de alimentos** com
   gramas. O alimento pode vir da busca na TACO (selo `TACO`, entra como
   `alimento_taco_id`) ou ser digitado livre;
4. reordena/remove blocos e vê, por bloco, a estimativa de kcal e proteínas dos
   alimentos escolhidos da TACO contra a meta, e no rodapé as metas do dia;
5. clica em **Prescrever plano** (`POST /pacientes/{id}/planos`): o plano novo vira o
   ativo e substitui o anterior.

### Histórico de versões do plano (Task 5.3, RF08, RNF08)

`src/pages/PlanHistoryPage.tsx` (aba **Histórico do plano**). O nutricionista informa o
id do paciente e vê, da mais nova para a mais antiga, cada versão salva do plano com o
**autor**, a **data/hora** (horário de Brasília) e **o que mudou** em relação à versão
anterior (título, orientações, refeições adicionadas/removidas, horário, metas e
alimentos). **Editar plano ativo** abre o construtor já com o plano carregado; salvar
(`POST /pacientes/{id}/planos`) gera uma versão nova.

Contrato esperado do back-end (Task 5.3 [Back]), documentado em `src/lib/planHistory.ts`:

- `GET /pacientes/{id}/planos/versoes`: lista de versões, da mais nova para a mais antiga.
  Cada item é o plano completo (mesmos campos de `GET /pacientes/{id}/planos/ativo`) mais
  `versao` (número sequencial por paciente) e `autor` (`{ id, nome }` ou `null`).
  Só o nutricionista vinculado ao paciente; 404 sem paciente e 403 sem vínculo.

O "o que mudou" é calculado no front, comparando cada versão com a anterior (os blocos
pelo nome, porque os ids mudam a cada versão).

A validação (`src/lib/plans.ts`) repete os limites do back-end para o erro aparecer no
campo. Para testar, o nutricionista precisa estar vinculado ao paciente
(`POST /linking-code` + `POST /link` no back-end).

## Rodando localmente

```bash
cp .env.example .env.local
npm install
npm run dev
```

Abre em <http://localhost:5173>. O rodapé mostra se a API do back-end está
respondendo, o que ajuda a conferir se o `.env.local` está correto.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | typecheck + build de produção em `dist/` |
| `npm run preview` | serve o `dist/` |
| `npm run lint` | oxlint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` | Prettier (escreve) |
| `npm run format:check` | Prettier (só verifica) |
| `npm test` | testes de componentes (Vitest + Testing Library) |
| `npm run test:coverage` | testes com cobertura (mínimo de 80% de linhas) |
| `npm run test:e2e` | E2E do fluxo principal (Playwright; rode `npx playwright install chromium` uma vez) |

## Variáveis de ambiente

Documentadas em [`.env.example`](.env.example). Apenas variáveis com prefixo
`VITE_` chegam ao código do cliente — **o bundle é público, nunca coloque
segredo aqui**.

## CI/CD (RNF08)

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda a cada push e pull
request em `main`/`dev`: Prettier, oxlint, `tsc` e build de produção (com o
`dist/` publicado como artefato), testes de componentes com cobertura e o E2E
do fluxo principal no Chromium.

## Testes (Task 7.4)

- **Componentes** (`src/**/*.test.tsx`): Vitest em jsdom com Testing Library.
  O `fetch` é trocado por uma API falsa (`src/test/fakeApi.ts`), então nenhum
  teste depende do back-end no ar.
- **E2E** (`e2e/`): Playwright contra o build de produção (`vite preview`), com
  a API interceptada no navegador. São dois fluxos:
  - [`fluxo-principal.spec.ts`](e2e/fluxo-principal.spec.ts): login → pacientes
    vinculados → construtor de planos (busca na TACO, metas, blocos) →
    prescrever → reabrir o plano ativo → recarregar a página → sair.
  - [`acompanhamento.spec.ts`](e2e/acompanhamento.spec.ts): "Ver desempenho" →
    dashboard de 7 dias (resumo, tabela, gráfico e alerta de abandono) → troca
    de paciente → alertas de desvio (regra, verificação, marcar como lido e
    filtro de não lidos).
- Dashboards e alertas também têm testes de componente (`DashboardPage`,
  `SevenDayCaloriesChart`, `DeviationAlertsPage`) e do cliente da API
  (`deviationAlertsApi`).

## Documentação Técnica do Sistema

Para entender a arquitetura completa, integrações e modelagem de dados:
- [Documento de Arquitetura](../Documentação/ARQUITETURA.md) — Visão C4, fluxos de integração e modelo clínico.
- [Modelagem de Banco de Dados](../Documentação/BANCO_DE_DADOS.md) — DER completo e dicionário de dados.

## Repositórios do projeto

- [Nutri-Vision-Back-end](https://github.com/Gupo-05-6-EG/Nutri-Vision-Back-end) — API FastAPI
- [Nutri-Vision-Front-end](https://github.com/Gupo-05-6-EG/Nutri-Vision-Front-end) — app Flutter (paciente)
- [Nutri-Vision-Front-end-Web](https://github.com/Gupo-05-6-EG/Nutri-Vision-Front-end-Web) — este painel
- [Nutri-Vision-IA](https://github.com/Gupo-05-6-EG/Nutri-Vision-IA) — reconhecimento de alimentos
