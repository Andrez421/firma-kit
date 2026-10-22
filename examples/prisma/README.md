# Storing signatures with Prisma

An example, not a package: it is not installed by the workspace and it does not run in
CI. Copy what you need.

The module returns the signature; storing it belongs to your project. This is the
smallest useful version of that: a table, an endpoint that validates what it receives,
and a hash so the same signature cannot be stored twice.

## What is here

| File | What it does |
| --- | --- |
| `schema.prisma` | `Firma` table: hash, PNG bytes, dimensions, mode, optional subject |
| `lib/prisma.ts` | Prisma client singleton (Next reloads modules in dev) |
| `app/api/firmas/route.ts` | `POST` stores a signature, `GET ?id=` returns the PNG |
| `env.example` | `DATABASE_URL` for SQLite |

## Wire it

```bash
pnpm add -D prisma
pnpm add @prisma/client
cp examples/prisma/env.example .env
cp examples/prisma/schema.prisma prisma/schema.prisma
npx prisma migrate dev --name firma
```

Copy `lib/` and `app/api/firmas/` next to your app code (adjust the import paths to
your project layout), then send the signature from the form:

```ts
const res = await fetch(`/api/firmas?mode=${firma.mode}`, {
  method: "POST",
  headers: { "content-type": "image/png" },
  body: firma.png, // Uint8Array, straight from onSignature
});
const { id } = await res.json();
```

## Decisions worth copying

- **The client is not trusted.** The format is decided with `detectFormat` from
  `@firma-kit/core` (magic bytes), and the dimensions are read from the PNG's own
  IHDR, not from what the browser claims. A JPEG with an `image/png` header is
  rejected.
- **A 2 MB ceiling.** The module caps the output at 900 px wide, so anything larger is
  not a signature this library produced.
- **The hash is unique.** Re-submitting the same signature does not create a second
  row, which also makes the endpoint safe to retry.
- **The PNG is served with `no-store` and `nosniff`.** A signature is not a public
  asset and must not be cached by a proxy or reinterpreted as another type.
- **Who the signature belongs to is your data.** The module never sees identities, so
  `sujetoId` is whatever your system already uses.

## What this example deliberately does not do

- No authentication: in a real app, the endpoint must know who is signing and reject
  anyone else. That is your authorisation model, not the module's.
- No object storage: for large volumes, keep the bytes in S3/MinIO and the metadata
  here. The endpoint would return a signed URL instead of the bytes.
- No retention policy: signatures are personal data in most jurisdictions. Decide how
  long you keep them before you store the first one.
