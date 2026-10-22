# Playground

Banco de pruebas manual de los cuatro modos. **No se publica**: existe para
verificar lo que ningún test headless puede ver.

```bash
pnpm --filter @firma-kit/playground dev
```

Consume el código fuente de `packages/core` y `packages/react` por alias de
Vite, no `dist`, así que no hace falta compilar antes.

## Verificación visual

El modelo no cabe en el navegador (201 MB de ONNX), así que la verificación corre
en un servicio local y el campo la consume por el puerto `verifier`:

```bash
# en otra terminal, con los pesos ya descargados
FIRMA_KIT_MODULES_DIR=~/firma-kit-modules pnpm --filter @firma-kit/eval serve
# escucha en http://127.0.0.1:8790 (GATE_PORT para cambiarlo)
```

El arnés sondea `/salud` al cargar y lo dice en pantalla: **conectado** (verde) o
**sin servicio** (gris). Sin servicio el campo se comporta como antes — no
verifica — para que el playground siga sirviendo aunque el modelo no esté. Ese
aviso también aparece si el verificador falla en mitad de una firma: el campo no
bloquea a la persona, pero el arnés deja de fingir que validó.

### Probarlo desde el móvil (Tailscale)

El servicio escucha en `127.0.0.1` por defecto. Si abres el arnés desde otro
dispositivo, el campo busca el gate en **el mismo host que sirvió la página**, así
que el servicio tiene que escuchar en esa interfaz:

```bash
# servicio: exige token fuera de loopback y solo atiende al arnés
GATE_HOST=0.0.0.0 \
GATE_TOKEN=un-token-largo-y-propio \
GATE_ORIGINS=http://100.83.204.18:5173 \
FIRMA_KIT_MODULES_DIR=~/firma-kit-modules \
  pnpm --filter @firma-kit/eval serve

# arnés: el mismo token, en el bundle de desarrollo
VITE_GATE_TOKEN=un-token-largo-y-propio \
  pnpm --filter @firma-kit/playground dev --host
```

Fuera de loopback el servicio **se niega a arrancar sin token**, y solo contesta a
los orígenes de `GATE_ORIGINS` (más el preflight que esa cabecera obliga a hacer).
Un `POST` binario sin cabeceras es una *petición simple*: sin token, cualquier
página que la persona visite podría usar el gate como oráculo.

Si el indicador dice «sin servicio (…)», el paréntesis dice por qué: servicio
apagado, token que no coincide o timeout. `VITE_GATE_URL` fuerza otra URL.

Con el servicio levantado, subir una cédula, una factura o la foto de un objeto se
rechaza con «La imagen no parece una firma…», y una foto de una firma real pasa.

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
5. **Tema**: con el sistema en oscuro y el selector en «Sistema», todo el
   componente debe verse sobre su propia superficie oscura (nunca texto claro
   sobre blanco). «Claro» y «Oscuro» fuerzan el esquema sin tocar el sistema.

Los puntos 1-4 están pendientes de firma humana: este entorno no tiene navegador
gráfico, así que el playground se verificó con `vite build` (compila y empaqueta
las cuatro fuentes), no visualmente.
