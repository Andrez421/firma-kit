# Demo como página de pruebas pública

Objetivo: convertir `apps/demo` en una página para enseñar y probar el módulo, con
personalización amplia. Rama `feat/demo-playground`.

## Specs

- **S1** (dueño, verbatim) — «para la pagina en la parte superior podriamos añadir
  botones para github y modo claro/oscuro».
- **S2** (dueño, verbatim) — «otra opcion para thema que cubra el campo de la firma es
  decir algunas opciones para mostrar de diferentes maneras como se visualizaria el
  campo entero por ejemplo otros colores, orden de los botones, redondos, degradados,
  efectos, etc algo asi como diferentes estilos prediseñados».
- **S3** (dueño, verbatim) — «una seccion para personalizar las opciones, por ejemplo
  poder habilitar o deshabilitar algunas opciones, como la funcion para que el trazo se
  dibuje desde donde termina el ultimo o simplemente poder dibujarlo desde cualquier
  punto, entre otras. y poder reorganizar en diferentes lugares o posiciones los
  botones».
- **S4** (dueño, verbatim) — «identifica que otras mejoras o funcionalidades para dejar
  mas completo y llamativo el demo, ya que la idea es desplegarlo como una page para que
  la puedan testear las personas y tengan muchas opciones para probar».
- **S5** — Frontera de contrato: lo que se pueda conseguir con las props y las variables
  CSS existentes se hace en el demo; lo que exija cambiar el contrato público de
  `@firma-kit/react` se decide aparte, porque el paquete está a punto de publicarse.
  Hoy el campo **no** expone orden de botones ni trazo continuo: eso es API nueva.

## Tasks

- **T1** — Chrome de la página: enlace a GitHub y conmutador claro/oscuro con
  preferencia del sistema y persistencia. Commit: `feat(demo): page chrome with GitHub and a theme switch`.
- **T2** — Presets de tema del campo sobre `--signature-*`: colores, radios,
  superficies, degradados y efectos, aplicados en vivo. Commit: `feat(demo): theme presets for the field`.
- **T3** — Panel de opciones con las props existentes (`locale`, `size`, `theme`,
  `modes`, `initialMode`, `maxLines`, `font`, `maxBytes`, `stroke`), props resultantes
  en JSON copiable y estado compartible por URL. Commit: `feat(demo): an options panel and shareable state`.
- **T4** — API nueva para el contrato (trazo continuo, orden/visibilidad de botones):
  requiere decisión del dueño antes de escribir.

## Estado

- T1, T2 y T3 hechos en un solo commit. Es una unidad grande (~1 600 líneas) porque la
  página, el panel y los presets no funcionan por separado: partirla dejaría la primera
  mitad como código muerto. Verificado en Chromium: tema claro/oscuro y su persistencia,
  ida y vuelta de la URL, 7 presets con efectos, apagado de modos, firma de prueba
  (547×84, 3 978 bytes) y cero respuestas >= 400.
- T4 hecho en `feat/toolbar-strokeline`: el dueño eligió `toolbar` (lista ordenada) y
  `strokeLink` (booleano) como props sueltas. El helper `startStroke` aísla la decisión
  del trazo para poder probarla sin DOM. La prueba de navegador destapó un defecto en el
  demo: `normalizar` reconstruía la barra en el orden canónico, así que reordenar no se
  veía y el enlace compartido lo perdía; corregido y verificado con ida y vuelta.

## Log

- **L1** (dueño, verbatim, resumen): «vale, queremos mejorar el demo y darle muchas mas
  formas de persoalizacion en general tanto a las funcionalidades como a la pagina
  mostrada».
- **L2** (hecho previo): fase 4 mergeada (PR #29); demo en `/` y `/integration` con los
  cuatro modos, en/es, tres tamaños, verificador contra el gate y estado «sin servicio»
  visible.
