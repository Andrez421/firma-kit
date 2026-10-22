# Arquitectura

> Versión en español. La primaria es [`ARCHITECTURE.md`](ARCHITECTURE.md).


## Paquetes

```
@firma-kit/core        sin DOM, sin React, sin red
  ├── types.ts         contrato: SignatureMode, Signature, SignatureResult, RejectionReason
  └── ink/             pipeline puro: extractSignature, flattenInk, stretchLevels
@firma-kit/react       componentes + estilos (CSS variables, no Tailwind obligatorio)
@firma-kit/verify      verificación visual en CPU (MobileCLIP-S0 → SmolVLM-256M)
apps/demo              Next.js que ejercita los cuatro modos
```

Regla de dependencias: `react` y `verify` dependen de `core`; `core` no depende
de nadie. Es lo que permite usar el módulo en el navegador, en una API, en un
worker o en un test de Node.

## Flujo de una firma por imagen

```
archivo/foto
   │  (navegador: canvas → ImageData | servidor: sharp → Buffer RGBA)
   ▼
extractSignature(rgba, w, h)          ← núcleo, ya portado y probado
   ├─ limpieza directa (Sauvola local)
   ├─ si no es confiable → stretchLevels (auto-niveles) → limpieza otra vez
   ├─ gates: sin_tinta · fondo_oscuro · no_es_firma · ruido
   ▼
flattenInk(alpha, w, h, caja)         ← tinta sobre blanco, sin alfa
   ▼
Signature { png, width, height, mode, createdAt }
```

`enhanced` en `Signature` indica que se usó la cascada, para poder auditar el
resultado después.

## Verificación visual (fase 3)

Dos niveles, **ambos en CPU**, la imagen nunca sale de la infraestructura:

| Nivel | Modelo | Tamaño | Latencia | Papel |
| --- | --- | --- | --- | --- |
| 1 | MobileCLIP-S0 int8 (zero-shot imagen↔texto) | presupuesto ~90 MB | ~50 ms | gate: ¿la clase ganadora es "firma manuscrita"? |
| 2 | SmolVLM-256M GGUF Q4 | ~300 MB | ~1–2 s | segunda opinión solo si el nivel 1 es ambiguo |

Los ONNX int8 publicados miden ≈55 MB (visión 11,8 MB + texto 42,8 MB); el presupuesto del nivel 1 se ajusta al dimensionar el contenedor en la fase 3.

Clases abiertas del nivel 1 (borrador): «una firma manuscrita sobre papel»,
«una cédula o documento de identidad», «una factura o página impresa», «una foto
de un objeto», «una captura de pantalla», «una persona».

Detalles que ya están decididos por la evidencia:

- **Se clasifica la imagen original**, no la limpia: al binarizar, una cédula se
  vuelve "página con texto" y se pierde la señal.
- Los modelos se cachean en un volumen (`FIRMA_KIT_MODULES_DIR`), no en el
  paquete. Nunca se empaquetan: sus licencias son suyas.
- Privacidad: un documento de identidad es dato personal (Ley 1581 de 2012 en
  Colombia). Un clasificador en la nube queda descartado por diseño.

## Coste en el host

| Componente | Disco | RAM en uso |
| --- | --- | --- |
| núcleo | — | unos pocos MB por imagen ≤1200px |
| nivel 1 | ~90 MB | ~200 MB |
| nivel 2 | ~300 MB | ~500 MB–1 GB |

Todo cabe en el contenedor actual (sin GPU). El nivel 1 puede correr en el
navegador con transformers.js si algún proyecto lo prefiere; el nivel 2 no.

## Validación (el bloqueo real)

Hay 1 018 firmas reales como positivos y **un** negativo. Antes de fijar
umbrales hace falta un lote de negativos (cédula, factura, recibo, pantallazo,
objeto, mano, hoja vacía): **30–50** mínimo. Métricas:

- falsos rechazos sobre firmas reales **≤ 1–2 %** (no negociable);
- falsos aceptados sobre negativos **≥ 90 %**.
