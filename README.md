# Compasso

Agenda de eventos de Joinville e região, agregando várias fontes de venda de
ingresso (Blumie, Meaple, Shotgun, Sympla, Eventbrite, Eventim) numa única
página.

O vocabulário do domínio está em [`CONTEXT.md`](./CONTEXT.md) e as decisões
que são caras de reverter em [`docs/adr/`](./docs/adr/). Leia os dois antes
de mexer na coleta.

## Estrutura

- `apps/web` — Next.js, publicado na Vercel. Lê os eventos direto do Postgres.
- `apps/collector` — script rodado 1x/dia pelo GitHub Actions
  (`.github/workflows/collect.yml`), que executa cada scraper e faz upsert no
  banco.
- `packages/scrapers` — um módulo por fonte, implementando
  `EventSource.fetchEvents(): Promise<RawEvent[]>`. **Os scrapers ainda são
  stubs** (`packages/scrapers/src/sources/*.ts`) — cada um precisa ser
  implementado inspecionando o endpoint de busca/listagem do respectivo site.
- `packages/db` — schema Drizzle (tabela `events`) e client para Postgres via
  `pg` (node-postgres), compatível tanto com um Postgres local quanto com
  Neon (usado em produção).

## Setup local

1. Suba o Postgres local: `docker compose up -d` (usa o `docker-compose.yml`
   na raiz, expõe `localhost:5432`, usuário/senha/db `compasso`).
2. `cp .env.example apps/web/.env.local` (o valor default já aponta pro
   Postgres do docker compose). Faça o mesmo em `apps/collector/.env` para
   rodar o coletor localmente (`tsx --env-file=.env src/index.ts` ou exporte
   a variável no shell).
3. `pnpm install`
4. Gere e aplique as migrations: `pnpm --filter @repo/db run db:generate` e
   depois `pnpm --filter @repo/db run db:migrate`.
5. `pnpm dev` sobe o site em `http://localhost:3000` (sem eventos até rodar o
   coletor pelo menos uma vez).
6. Para rodar o coletor manualmente: `pnpm --filter collector run collect`.
7. Para derrubar o Postgres local: `docker compose down` (os dados persistem
   no volume `pgdata`; use `docker compose down -v` para zerar o banco).

## Deploy

- **Web**: importe o repo na Vercel com root directory `apps/web`, configure
  `DATABASE_URL` nas variáveis de ambiente do projeto.
- **Coleta diária**: configure o secret `DATABASE_URL` no GitHub Actions
  (Settings → Secrets and variables → Actions). O workflow já roda todo dia
  às 06:00 (horário de Brasília) e pode ser disparado manualmente via
  "Run workflow".

## Próximos passos

Ver a issue [#3](https://github.com/henrilhos/compasso/issues/3) e suas
sub-issues.
