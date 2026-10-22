<!-- English primary. Español: this package's user-facing copy is bilingual at runtime;
     the docs live in the root README.es.md and docs/*.es.md. -->

# @firma-kit/react

`<SignatureField />`: the four ways of signing (draw, type, upload, camera) on top
of `@firma-kit/core`, accessible and themeable with CSS variables.

```bash
pnpm add @firma-kit/react @firma-kit/core react
```

```tsx
import "@firma-kit/react/firma-kit.css";
import { SignatureField } from "@firma-kit/react";

<SignatureField
  name="José Muñoz"                       // enables the type mode
  onSignature={(signature) => save(signature)} // signature.png is a Uint8Array
  onRejection={(reason, message) => show(message)}
/>
```

The stylesheet is required: without it the component has no surface, no spacing
and no contrast. The four handwriting fonts ship with it (OFL, 142 KB), and the
type mode offers them as a radiogroup where each option is drawn in its own
cursive — picking a style by name alone tells you nothing.

## Visual verification

The verifier is a **port**: `{ verify(bitmap) }`. The model runs wherever the image
lives — usually your server or a worker — and never in the browser, because the
weights are ~200 MB. The field only calls it for the upload and camera modes, and
before any cleanup, so an ID card is classified as an ID card and not as "a page
with text".

If the verifier throws (model not downloaded, service down), the field does **not**
block the person: verification is a safeguard, not a requirement to sign.

```tsx
<SignatureField
  verifier={{ verify: (bitmap) => postToMyGate(bitmap) }}
  onRejection={(reason, message) => show(message)}
/>
```

## Drawing performance

The canvas does not repaint the whole sheet on every pointer move: while a stroke is
in progress it draws only the new segment, and on release it runs one exact pass with
the pure rasterizer. The exact pass is what you see when you stop drawing and what
gets saved, so the approximation never reaches the signature.

## Validation

Uploads and camera captures are checked **before** any decoding work:

1. **Size** against `maxBytes` (5 MB by default) → `too_heavy`.
2. **Format by magic bytes** with `detectFormat`, not by extension or by the MIME
   the browser declares → `unsupported_format`. A PDF renamed to `.png` is a PDF.
3. Then the ink pipeline runs and may reject with `no_ink`, `dark_background`,
   `not_a_signature` or `noise`.

Every rejection carries a code (`RejectionReason`) and a message already written
for the person signing, in `en` or `es`.

## Props

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `modes` | `SignatureMode[]` | all four | Which tabs to offer, in order |
| `initialMode` | `SignatureMode` | first available | Tab shown first |
| `name` | `string` | — | Name for the type mode; without it the mode is hidden |
| `value` | `Signature \| null` | — | Controlled value; omit for uncontrolled |
| `onSignature` | `(signature: Signature \| null) => void` | — | Fires on success and on clear |
| `onRejection` | `(reason, message) => void` | — | Fires on every rejection, message already localised |
| `verifier` | `Verifier` | — | Visual verification; absent means no verification. Its only method is `verify(bitmap)` |
| `maxWidth` | `number` | `900` | Final PNG width |
| `maxBytes` | `number` | `5 * 1024 * 1024` | Uploads above this are rejected before decoding |
| `fonts` | `TypeFont[]` | all four | Which handwriting styles to offer |
| `font` | `TypeFont` | first of `fonts` | Controlled style selection |
| `onFontChange` | `(font: TypeFont) => void` | — | Fires when the person picks a style |
| `locale` | `"en" \| "es"` | `"en"` | Language of labels and rejection messages |
| `theme` | `"light" \| "dark"` | system | Forces the colour scheme |
| `stroke` | `StrokeOptions` | package defaults | Stroke width, smoothing, ink level |
| `toolbar` | `ToolbarAction[]` | all six | Which buttons appear and in what order. Empty means no toolbar at all |
| `strokeLink` | `boolean` | `false` | Every new stroke starts at the end of the previous one, joined by a line |
| `label` | `string` | localised | Accessible name of the tab list |
| `className` | `string` | — | Extra class on the root |
| `encoder`, `measurer`, `rasterizer` | ports | browser implementations | Injection points for tests and servers |

Ref handle: `clear()`, `confirm()`, `openMode(mode)`.

```tsx
// A toolbar of your own, and a signature written in several passes.
<SignatureField
  toolbar={["undo", "clear", "confirm"]}
  strokeLink
  stroke={{ minWidth: 1, maxWidth: 4 }}
/>
```

`ToolbarAction` is `"undo" | "redo" | "erase" | "fullscreen" | "clear" | "confirm"`.
Actions that do not apply to the active mode are omitted, never shown disabled, and
with `toolbar={[]}` the field has no buttons at all: the parent drives it through the
ref.

`foto` is hidden when `navigator.mediaDevices` is missing; `escribir` is hidden
without `name`. Offering a mode that cannot work is worse than not offering it.

## Sizes

`size="sm" | "md" | "lg"` (default `md`) changes the aria and the canvas height
(140 / 200 / 280 px) through `--signature-canvas-height` and `--signature-gap`.
It never shrinks a target below 44px: the size is comfort, not accessibility.

## Theme tokens

Override any of these on the component or an ancestor. The component paints its
own surface, so contrast never depends on the page hosting it.

| Token | Default (light) | Dark | What it colours |
| --- | --- | --- | --- |
| `--signature-color` | `#111827` | `#f9fafb` | Text and icons |
| `--signature-muted` | `#6b7280` | `#9ca3af` | Status line and hints |
| `--signature-surface` | `#ffffff` | `#111827` | Component background and canvas paper |
| `--signature-border` | `#d1d5db` | `#374151` | Borders and dashed areas |
| `--signature-focus` | `#2563eb` | `#60a5fa` | Focus ring and primary button |
| `--signature-error` | `#b91c1c` | `#fca5a5` | Rejection message |
| `--signature-radius` | `10px` | `10px` | Corner radius |
| `--signature-gap` | `12px` | `12px` | Spacing and padding |
| `--signature-font` | `system-ui, …` | `system-ui, …` | UI font (not the handwriting ones) |

Dark tokens apply when the system prefers dark, unless the element carries
`data-theme="light"`; `theme="dark"` forces them regardless of the system.
`color-scheme` travels with the tokens so native controls (the file input)
match instead of keeping the browser's light chrome.

```css
/* Match the host product without touching the package */
.producto .signature {
  --signature-color: #0f172a;
  --signature-focus: #7c3aed;
  --signature-radius: 4px;
  --signature-canvas-height: 240px;
}
```

Or inline, when you do not want a stylesheet of your own:

```tsx
<SignatureField
  size="lg"
  style={{ "--signature-focus": "#7c3aed", "--signature-radius": "16px" } as React.CSSProperties}
/>
```

Three ready-made presets live in `apps/playground` (`Por defecto`, `Corporativo`,
`Cálido`) so you can see the effect before choosing your own numbers.

## Accessibility

- WAI-ARIA tabs (`tablist`/`tab`/`tabpanel`), roving tabindex, `←`/`→`/`Home`/`End`.
- Targets at least 44px; a visible `focus-visible` ring.
- Rejections and status go to `aria-live` regions, so a screen reader announces
  why a signature was refused.
- The canvas has an accessible name; the type mode is the keyboard-only
  alternative to drawing.
- Automated checks with `axe-core` run in the suite (`src/a11y.test.tsx`), with a
  negative control proving the checker actually detects violations. Colour
  contrast is measured in a real browser, not in jsdom.

## Server components

```ts
import type { Signature } from "@firma-kit/react/server"; // types only, no client code
```

## Notes

- The component needs a 2D canvas context. Without one it reports an explained
  rejection instead of producing an empty image.
- Images are classified as they arrive (the original), never after cleanup.
- Nothing leaves the browser: encoding and verification run in the caller's
  process.
