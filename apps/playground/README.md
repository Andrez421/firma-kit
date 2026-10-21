# Playground

Banco de pruebas manual de los cuatro modos. **No se publica**: existe para
verificar lo que ningún test headless puede ver.

```bash
pnpm --filter @firma-kit/playground dev
```

Consume el código fuente de `packages/core` y `packages/react` por alias de
Vite, no `dist`, así que no hace falta compilar antes.

## Qué hay que mirar a ojo (pendiente en la fase 1)

1. **Modo escribir**: el nombre `José Muñoz Peña` debe verse con tilde y con
   `ñ` en las cuatro cursivas. Si aparece una letra sin tilde o un hueco, la
   fuente servida no es la correcta (ver `packages/react/assets/fonts/README.md`).
2. **Fondo**: el PNG descargado tiene tinta sobre blanco puro, sin gris ni
   negro, en los cuatro modos.
3. **Táctil**: en un móvil real, dibujar no debe hacer scroll de la página
   (`touch-action: none`) y los botones deben medir al menos 44px.
4. **Lector de pantalla**: las pestañas se anuncian con su rol, y el modo
   escribir se ofrece como alternativa accesible al lienzo.

Los puntos 1-4 están pendientes de firma humana: este entorno no tiene navegador
gráfico, así que el playground se verificó con `vite build` (compila y empaqueta
las cuatro fuentes), no visualmente.
