// English messages: the primary language of the public API and the default for
// new integrations. Same codes as `es.ts`, different copy.

import type { RejectionReason } from "../types.js";

export const MESSAGES_EN: Record<RejectionReason, string> = {
  unreadable: "We could not read that image. Upload a PNG or JPG of your signature.",
  no_ink:
    "We could not find a signature stroke. Move closer and frame only the signature on white paper.",
  dark_background:
    "The photo has a dark or heavily shadowed background. Retake it on white paper with even light.",
  not_a_signature:
    "That image does not look like a signature (a document photo, for example). Upload or take a photo of the signature itself.",
  noise:
    "The background has too much texture (grain, marble, grid) to separate it from the signature. Retake it on plain paper.",
  empty: "The canvas is empty. Draw or type your signature before continuing.",
  too_heavy: "The image is too large to process. Try a smaller photo or crop it.",
  unsupported_format:
    "We only accept PNG or JPG. Convert the image to one of those formats and try again.",
  font_unavailable:
    "We could not load the handwriting font. Wait a moment and try again, or pick another font.",
};
