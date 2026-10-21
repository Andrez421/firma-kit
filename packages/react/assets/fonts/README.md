# Fuentes del modo «escribir»

Cuatro cursivas Open Font License servidas desde el propio paquete: **nunca** se
pide nada a Google Fonts en tiempo de ejecución, así que no hay dependencia
externa, ni salto de layout, ni fuga de datos.

Son las mismas que GCly ya usó con personas reales, para no cambiar la
experiencia de quien ya firmó con ellas.

## Archivos y procedencia

Cada archivo es el subconjunto `latin` que publica Google Fonts, que cubre
`U+0000-00FF` — es decir tildes, `ñ` y `ü` del español. Se eligió ese bloque
precisamente por eso: el subconjunto `latin-ext` no incluye `á` ni `ñ`, y un
nombre como «Muñoz» saldría mutilado.

| Familia | Archivo | Tamaño | SHA-256 |
| --- | --- | --- | --- |
| Caveat | `caveat.woff2` | 48 836 B | `d0b7b931b8980049327e8f8f9ac264617c8200b8422d62e886473d3d9527bad3` |
| Pacifico | `pacifico.woff2` | 32 280 B | `99ec044ad9040a708e38f90ebd5984ca03fc46afeee26d5c77c4769c66ed89e2` |
| Great Vibes | `greatvibes.woff2` | 42 800 B | `c59dc73d29daf142ef2431f455d21464172374aa750d793a79d608735db2d856` |
| Sacramento | `sacramento.woff2` | 23 708 B | `2fcd867d2812578d001b0eca921848e24de91d01986f26e038be374ec7c5cfd2` |

Origen: `https://fonts.gstatic.com/s/<familia>/…woff2`, obtenido desde la hoja
de estilos de Google Fonts con un navegador moderno. Licencia de cada familia en
`LICENCIA-<familia>.txt` (SIL Open Font License 1.1), copiada del repositorio
`google/fonts`.

## Cómo se actualizan

No se editan a mano. Si hay que reemplazar una fuente:

1. Descargar el bloque `latin` de la hoja de estilos de Google Fonts, no el
   `latin-ext`.
2. Reemplazar el `.woff2` y su `LICENCIA-*.txt`.
3. Actualizar la tabla de arriba con el tamaño y el SHA-256 nuevos (`sha256sum`).
4. Abrir el playground y comprobar a ojo un nombre con tilde y con `ñ` en las
   cuatro fuentes: `José Muñoz Peña`.
