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
├── components/     # componentes reutilizáveis
├── pages/          # uma pasta/arquivo por tela
├── lib/
│   ├── env.ts      # leitura validada das variáveis VITE_*
│   └── api.ts      # cliente HTTP + injeção do JWT
└── types/          # tipos compartilhados
```

O alias `@/` aponta para `src/` (configurado em `vite.config.ts` e `tsconfig.app.json`).

## Rodando localmente

```bash
cp .env.example .env.local
npm install
npm run dev
```

Abre em <http://localhost:5173>. A tela inicial mostra se a API do back-end
está respondendo — útil para conferir que o `.env.local` está correto.

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

## Variáveis de ambiente

Documentadas em [`.env.example`](.env.example). Apenas variáveis com prefixo
`VITE_` chegam ao código do cliente — **o bundle é público, nunca coloque
segredo aqui**.

## CI/CD (RNF08)

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda a cada push e pull
request em `main`/`develop`: Prettier, oxlint, `tsc` e build de produção, com o
`dist/` publicado como artefato.

## Repositórios do projeto

- [Nutri-Vision-Back-end](https://github.com/Gupo-05-6-EG/Nutri-Vision-Back-end) — API FastAPI
- [Nutri-Vision-Front-end](https://github.com/Gupo-05-6-EG/Nutri-Vision-Front-end) — app Flutter (paciente)
- [Nutri-Vision-Front-end-Web](https://github.com/Gupo-05-6-EG/Nutri-Vision-Front-end-Web) — este painel
- [Nutri-Vision-IA](https://github.com/Gupo-05-6-EG/Nutri-Vision-IA) — reconhecimento de alimentos
