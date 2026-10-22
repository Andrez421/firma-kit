# Evaluación del verificador

Arnés que mide el verificador contra un corpus etiquetado y **falla** si el lote
no cumple los presupuestos. No se publica.

```bash
# El corpus NO vive en el repositorio: las firmas reales son dato personal
# (ADR-012). Se apunta al directorio que las tenga.
export FIRMA_KIT_EVAL_CORPUS=/ruta/al/corpus
pnpm --filter @firma-kit/eval eval
```

Código de salida: `0` si pasa, `1` si falla algún presupuesto, `2` si falta el
corpus.

## El corpus

`manifest.json` en la raíz del corpus, una entrada por imagen:

```json
[
  { "path": "firmas/001.png", "label": "signature", "source": "synthetic", "licence": "CC0-1.0" },
  { "path": "negativos/factura-01.png", "label": "not_signature", "source": "https://dataset.example", "licence": "CC-BY-4.0" }
]
```

`parseManifest` valida que la ruta sea relativa y no escape del corpus, que no
haya duplicados (contar dos veces la misma firma infla la métrica), que cada
archivo declare procedencia y licencia, y que una fuente real no venga con
`"unknown"` como licencia.

## Presupuestos

| Métrica | Umbral | Por qué |
| --- | --- | --- |
| Falsos rechazos sobre firmas | ≤ **2 %** | un falso rechazo deja a una persona sin poder firmar; no se negocia |
| Falsos aceptados sobre negativos | ≥ **90 %** | un falso aceptado se detecta después |

El informe incluye la matriz de confusión, la latencia p50/p95/máx y la lista de
fallos. Se archiva en `docs/eval/<fecha>.md` cuando se tocan umbrales (ADR-011).

## Bloqueo conocido

Faltan negativos reales: hoy hay 1 018 firmas y **un** negativo. El arnés se
prueba con fixtures sintéticos y verificadores falsos; los umbrales no se
calibran hasta tener 30–50 negativos (cédula, factura, recibo, pantallazo,
objeto, mano, hoja vacía).

El `run.ts` deja el gate sin modelos a propósito: medir hoy exigiría pesos que no
están fijados por hash. Cuando existan, se conecta aquí y el mismo arnés empieza a
decir la verdad.
