# Giroa

SaaS multi-tenant para estudios de danza y disciplinas de movimiento.

Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres, Auth, Storage, RLS), Mercado Pago, Vercel.

## Desarrollo local

Requisitos: Node 24+, Docker Desktop corriendo.

```bash
npm install
npm run db:start      # levanta Supabase local (Docker)
npm run db:reset      # aplica migraciones + seed
npm run dev           # http://localhost:3000
```

Tests:

```bash
npm run db:test       # pgTAP: RPC y aislamiento RLS
npm test              # Vitest
```

Reglas del proyecto: ver `CLAUDE.md`.
