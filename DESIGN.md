# Design — «la impresión»

The visual world of `<SignatureField />`, decided with the `impeccable` direction roll
(`concept-seed`, key `d4e7e322`, mode *operate*) and chosen by the owner. The assigned
direction was candidate 5 of the grounded list: the **seal tradition**.

## The idea

Signing is not drawing a line: it is **pressing a mark that commits**. The field reads
as a sheet of paper on a desk, with black ink and a single vermilion that belongs only
to the act of committing.

## Palette

| Role | Light | Dark |
| --- | --- | --- |
| Paper (surface) | `#fbfbf9` | `#14140f` |
| Ink (text) | `#14140f` | `#f5f3ee` |
| Muted | `#5f5c55` | `#a8a39a` |
| Hairline | `#e4e1da` | `#2e2a24` |
| Rule (stronger) | `#cfcac0` | `#3d3830` |
| **Vermilion (accent)** | `#c8372d` | `#e4584c` |
| Error | `#8e1f17` | `#f0a09a` |

One accent only. It marks the active tab, the selected handwriting, focus, and fills the
single committing button — nothing else. Error is a **deeper crimson**, not the
vermilion, so "this failed" never reads as "press this".

## Type

The UI voice is the system sans; the four cursive faces are **content**, never chrome.
Figures are tabular: the engraved caption under the impression (`385×75 px · 3 KB`)
aligns in a column.

## Composition

- The field is a **sheet**: hairline frame, 2px radius, generous padding, and a real
  offset shadow (`0 1px 1px` plus a soft `0 10px 24px -18px`) so it sits on the desk.
- Tabs are an **index line**: a rule across, text-only items, the active one marked by a
  vermilion block and a 2px underline. No pills.
- The drawing area is a **construction sheet**: a faint 20px grid on paper, with the
  hint centred while empty.
- Confirming is the only filled element, shaped like a seal block.
- The result is the **impression**: the PNG framed with an engraved caption of mode,
  size and weight.

## Motion

One authored moment: the seal **presses**. The primary button scales to 0.98 over 120 ms
on `cubic-bezier(0.2, 0.8, 0.2, 1)`. Nothing else animates.

## Browser surfaces

Selection, caret, focus rings and form-control accents come from the palette
(`::selection` in vermilion on paper, `caret-color`, `accent-color`). These ship with the
component instead of the browser's defaults.

## Refusals

No cards, no gradients, no icon glyphs standing in for icons, no monospace as costume, no
trailing accent everywhere. A control that is not the commit stays outline.

## Honest risk

Vermilion on white can read as an error state in a form. Mitigated by using it only for
commit and active marking, and by keeping errors in a distinct darker crimson with a
square marker rather than a colour change alone.

## How to extend it

A new surface (the future demo page) inherits this grammar: paper ground, ink, one
vermilion, hairline structure, and a single filled committing action. It does not need a
new roll; it is the same world at a larger scale.
