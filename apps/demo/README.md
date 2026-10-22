# @firma-kit/demo

A Next.js app that shows the module working and, in `/integration`, how to add it to a
project. It is not published and it stores nothing: the signature is returned to the
page and downloaded from there.

## Run it

```bash
pnpm install
pnpm --filter @firma-kit/demo dev      # http://localhost:3000
```

## Visual verification (optional)

The gate runs outside the browser. Start it first — the token and origins detail lives
in [`apps/playground/README.md`](../../apps/playground/README.md):

```bash
GATE_HOST=127.0.0.1 FIRMA_KIT_MODULES_DIR=~/firma-kit-modules \
  pnpm --filter @firma-kit/eval serve
```

Then point the demo at it:

```bash
NEXT_PUBLIC_GATE_URL=http://127.0.0.1:8790 \
NEXT_PUBLIC_GATE_TOKEN=<the same token> \
  pnpm --filter @firma-kit/demo dev
```

Without the service the page says **verification off** and keeps working: the field
never blocks a person because a model is missing. When the service is up, uploading an
ID card or a photo of an object is rejected with the reason in the page's language.

## What it demonstrates

| Part | Where |
| --- | --- |
| The four modes, both languages, three sizes | `/` |
| The signature as a PNG, with size and timestamp | `/` |
| Copy-pasteable integration in under 30 minutes | `/integration` |
| Fail-open verification with a visible reason | `/` |

## Notes

- The CSS comes from the package: `import "@firma-kit/react/firma-kit.css"`.
- `transpilePackages` in `next.config.ts` is what lets Next compile the workspace
  packages from their `dist/`.
- This app is `private: true`; the published artefacts are the three packages.
