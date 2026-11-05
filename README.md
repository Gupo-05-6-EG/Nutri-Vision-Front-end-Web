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
├── pages/          # uma pasta/arquivo por tela
├── lib/
│   ├── env.ts      # leitura validada das variáveis VITE_*
│   ├── api.ts      # cliente HTTP + injeção do JWT
│   ├── auth.ts     # login e sessão do nutricionista
│   └── plans.ts    # API e rascunho do construtor de planos
└── types/          # tipos compartilhados
```

O alias `@/` aponta para `src/` (configurado em `vite.config.ts` e `tsconfig.app.json`).

## Telas

### Login

Entra com email e senha de um **nutricionista** (`POST /auth/login`); paciente é
recusado. O token fica na `sessionStorage` da aba e é injetado em todas as chamadas
(`src/lib/auth.ts`). É uma versão mínima, para as rotas protegidas funcionarem.

### Construtor de planos alimentares (Task 5.1, RF09.1)

`src/pages/PlanBuilderPage.tsx`. O nutricionista:

1. informa o **id do paciente** (a lista de pacientes vinculados chega na Task 1.5) e,
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
  a API interceptada no navegador. Cobre login → construtor de planos (busca
  na TACO, metas, blocos) → prescrever → reabrir o plano ativo.

## Repositórios do projeto

- [Nutri-Vision-Back-end](https://github.com/Gupo-05-6-EG/Nutri-Vision-Back-end) — API FastAPI
- [Nutri-Vision-Front-end](https://github.com/Gupo-05-6-EG/Nutri-Vision-Front-end) — app Flutter (paciente)
- [Nutri-Vision-Front-end-Web](https://github.com/Gupo-05-6-EG/Nutri-Vision-Front-end-Web) — este painel
- [Nutri-Vision-IA](https://github.com/Gupo-05-6-EG/Nutri-Vision-IA) — reconhecimento de alimentos
