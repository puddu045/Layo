# Supabase (local development)

This project uses the **Supabase CLI** only for local Auth + Postgres + Storage
infrastructure — not for schema migrations. Schema ownership is split
deliberately:

- **Supabase** owns `auth.users` (identity, passwords, sessions, email
  confirmation) and gives you a local Postgres instance to point Prisma at.
- **Prisma** (`packages/db/prisma/schema.prisma`) owns every application table,
  including `User`, which mirrors `auth.users` by id but lives in the `public`
  schema and holds no credentials.

Running two migration systems against the same schema is a common source of
drift, so this project never runs `supabase migration` — only `prisma
migrate`.

## Starting local Supabase

```bash
npm install -g supabase
supabase start
```

This prints a local `API URL`, `anon key`, `service_role key` and `DB URL` —
copy those into your `.env` files (see the root `README.md`).

## Stopping / resetting

```bash
supabase stop
```

Add `--no-backup` if you also want to drop the local database volume.
