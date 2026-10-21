// Pipeline de tinta: el corazón reutilizable del módulo.
//
// Recibe una imagen (RGBA ya compuesto sobre blanco) y devuelve `alpha` con la
// tinta + la caja del trazo, o el motivo por el que no sirve como firma. No
// conoce DOM, canvas, red ni filesystem: por eso el mismo código corre en el
// navegador, en el servidor (sharp), en un worker y en los tests.
export {
  INK_GRAY,
  INK_MESSAGE,
  countInk,
  extractInk,
  extractSignature,
  flattenInk,
  stretchLevels,
  type InkBox,
  type InkOptions,
  type InkReason,
  type InkResult,
} from "./pixeles.js";
