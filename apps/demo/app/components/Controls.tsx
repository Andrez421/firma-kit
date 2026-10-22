"use client";

// Panel de opciones. Cada control escribe sobre el mismo objeto de configuración que
// se codifica en la URL y se muestra como props: no hay una segunda fuente de verdad.
import type { Locale, SignatureMode, TypeFont } from "@firma-kit/core";

import { ALL_ACTIONS, ALL_MODES, FONTS, type DemoConfig } from "../../lib/config.js";
import { PANEL_COPY } from "../../lib/copy.js";
import { FIELD_PRESETS, type FieldPreset } from "../../lib/presets.js";
import type { ToolbarAction } from "@firma-kit/react";

type Props = {
  config: DemoConfig;
  activePreset: FieldPreset;
  onChange: (siguiente: DemoConfig) => void;
  onPreset: (id: string) => void;
};

const MODE_LABEL: Record<SignatureMode, { en: string; es: string }> = {
  draw: { en: "Draw", es: "Dibujar" },
  type: { en: "Type", es: "Escribir" },
  upload: { en: "Upload", es: "Subir" },
  camera: { en: "Camera", es: "Cámara" },
};

const ACTION_LABEL: Record<ToolbarAction, { en: string; es: string }> = {
  undo: { en: "Undo", es: "Deshacer" },
  redo: { en: "Redo", es: "Rehacer" },
  erase: { en: "Erase", es: "Borrar" },
  fullscreen: { en: "Full screen", es: "Pantalla completa" },
  clear: { en: "Clear", es: "Limpiar" },
  confirm: { en: "Confirm", es: "Confirmar" },
};

export function Controls({ config, activePreset, onChange, onPreset }: Props) {
  const copy = PANEL_COPY[config.locale];
  const parche = (cambios: Partial<DemoConfig>) => onChange({ ...config, ...cambios });
  const trazo = (cambios: Partial<DemoConfig["stroke"]>) =>
    onChange({ ...config, stroke: { ...config.stroke, ...cambios } });

  // La barra se reordena moviendo elementos de la lista: el orden de la lista es el
  // orden de los botones, sin índices paralelos que se puedan desincronizar.
  const mover = (indice: number, salto: number) => {
    const destino = indice + salto;
    if (destino < 0 || destino >= config.toolbar.length) return;
    const copia = [...config.toolbar];
    [copia[indice], copia[destino]] = [copia[destino]!, copia[indice]!];
    parche({ toolbar: copia });
  };

  const alternarAccion = (accion: ToolbarAction) => {
    const activa = config.toolbar.includes(accion);
    parche({
      toolbar: activa
        ? config.toolbar.filter((actual) => actual !== accion)
        : [...config.toolbar, accion],
    });
  };

  const alternarModo = (modo: SignatureMode) => {
    const activos = config.modes.includes(modo)
      ? config.modes.filter((actual) => actual !== modo)
      : ALL_MODES.filter((actual) => actual === modo || config.modes.includes(actual));
    // Nunca se queda sin modos: el campo necesita al menos uno.
    if (activos.length === 0) return;
    parche({
      modes: activos,
      initialMode: activos.includes(config.initialMode) ? config.initialMode : activos[0],
    });
  };

  return (
    <div className="panel">
      <section>
        <h2>{copy.theme}</h2>
        <p className="hint">{copy.themeNote}</p>
        <div className="presets" role="radiogroup" aria-label={copy.theme}>
          {FIELD_PRESETS.map((preset) => {
            const activo = preset.id === activePreset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={activo}
                className="preset"
                data-active={activo ? "true" : "false"}
                onClick={() => onPreset(preset.id)}
                title={preset.note[config.locale]}
              >
                <span
                  className="swatch"
                  style={{
                    background: preset.vars["--signature-surface"],
                    borderColor: preset.vars["--signature-border"],
                  }}
                >
                  <span
                    className="swatch-ink"
                    style={{ background: preset.vars["--signature-focus"] }}
                  />
                </span>
                {preset.name[config.locale]}
              </button>
            );
          })}
        </div>

        <label className="field">
          <span>{copy.scheme}</span>
          <select
            value={config.fieldTheme}
            onChange={(evento) =>
              parche({ fieldTheme: evento.target.value as DemoConfig["fieldTheme"] })
            }
          >
            <option value="auto">{copy.schemeAuto}</option>
            <option value="light">{copy.schemeLight}</option>
            <option value="dark">{copy.schemeDark}</option>
          </select>
        </label>
      </section>

      <section>
        <h2>{copy.basics}</h2>
        <div className="row">
          <label className="field">
            <span>{copy.language}</span>
            <select
              value={config.locale}
              onChange={(evento) => parche({ locale: evento.target.value as Locale })}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </label>
          <label className="field">
            <span>{copy.size}</span>
            <select
              value={config.size}
              onChange={(evento) => parche({ size: evento.target.value as DemoConfig["size"] })}
            >
              <option value="sm">{copy.small}</option>
              <option value="md">{copy.medium}</option>
              <option value="lg">{copy.large}</option>
            </select>
          </label>
        </div>
      </section>

      <section>
        <h2>{copy.modes}</h2>
        <p className="hint">{copy.modesNote}</p>
        <div className="chips">
          {ALL_MODES.map((modo) => (
            <label key={modo} className="chip" data-active={config.modes.includes(modo)}>
              <input
                type="checkbox"
                checked={config.modes.includes(modo)}
                onChange={() => alternarModo(modo)}
              />
              {MODE_LABEL[modo][config.locale]}
            </label>
          ))}
        </div>
        <label className="field">
          <span>{copy.initial}</span>
          <select
            value={config.initialMode}
            onChange={(evento) =>
              parche({ initialMode: evento.target.value as SignatureMode })
            }
          >
            {config.modes.map((modo) => (
              <option key={modo} value={modo}>
                {MODE_LABEL[modo][config.locale]}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section>
        <h2>{copy.typeMode}</h2>
        <label className="field">
          <span>{copy.name}</span>
          <input
            type="text"
            value={config.name}
            placeholder={config.locale === "es" ? "María Fernanda Gómez" : "María Fernanda Gómez"}
            onChange={(evento) => parche({ name: evento.target.value })}
          />
        </label>
        <p className="hint">{copy.nameNote}</p>
        <div className="row">
          <label className="field">
            <span>{copy.lines}</span>
            <select
              value={String(config.maxLines)}
              onChange={(evento) =>
                parche({ maxLines: Number(evento.target.value) === 1 ? 1 : 2 })
              }
            >
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </label>
          <label className="field">
            <span>{copy.font}</span>
            <select
              value={config.font}
              onChange={(evento) => parche({ font: evento.target.value as TypeFont })}
            >
              {FONTS.map((fuente) => (
                <option key={fuente} value={fuente}>
                  {fuente}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section>
        <h2>{copy.stroke}</h2>
        <label className="field range">
          <span>
            {copy.minWidth} <b>{config.stroke.minWidth.toFixed(1)}</b>
          </span>
          <input
            type="range"
            min="0.2"
            max="6"
            step="0.1"
            value={config.stroke.minWidth}
            onChange={(evento) => trazo({ minWidth: Number(evento.target.value) })}
          />
        </label>
        <label className="field range">
          <span>
            {copy.maxWidth} <b>{config.stroke.maxWidth.toFixed(1)}</b>
          </span>
          <input
            type="range"
            min="0.5"
            max="12"
            step="0.1"
            value={config.stroke.maxWidth}
            onChange={(evento) => trazo({ maxWidth: Number(evento.target.value) })}
          />
        </label>
        <label className="field range">
          <span>
            {copy.smoothing} <b>{config.stroke.smoothing.toFixed(2)}</b>
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.stroke.smoothing}
            onChange={(evento) => trazo({ smoothing: Number(evento.target.value) })}
          />
        </label>
        <label className="field range">
          <span>
            {copy.ink} <b>{Math.round(config.stroke.ink)}</b>
          </span>
          <input
            type="range"
            min="0"
            max="180"
            step="1"
            value={config.stroke.ink}
            onChange={(evento) => trazo({ ink: Number(evento.target.value) })}
          />
        </label>
        <label className="field range">
          <span>
            {copy.speed} <b>{config.stroke.maxSpeed.toFixed(1)}</b>
          </span>
          <input
            type="range"
            min="0.2"
            max="6"
            step="0.1"
            value={config.stroke.maxSpeed}
            onChange={(evento) => trazo({ maxSpeed: Number(evento.target.value) })}
          />
        </label>
      </section>

      <section>
        <h2>{copy.behaviour}</h2>
        <h3>{copy.toolbar}</h3>
        <p className="hint">{copy.toolbarNote}</p>
        <ol className="order-list">
          {config.toolbar.map((accion, indice) => (
            <li key={accion} className="order-row">
              <span>{ACTION_LABEL[accion][config.locale]}</span>
              <span className="order-buttons">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => mover(indice, -1)}
                  disabled={indice === 0}
                  aria-label={`${copy.up}: ${ACTION_LABEL[accion][config.locale]}`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => mover(indice, 1)}
                  disabled={indice === config.toolbar.length - 1}
                  aria-label={`${copy.down}: ${ACTION_LABEL[accion][config.locale]}`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => alternarAccion(accion)}
                  aria-label={`${copy.outBar}: ${ACTION_LABEL[accion][config.locale]}`}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ol>
        {config.toolbar.length === 0 ? <p className="hint">{copy.toolbarNote}</p> : null}
        <div className="chips">
          {ALL_ACTIONS.filter((accion) => !config.toolbar.includes(accion)).map((accion) => (
            <button
              key={accion}
              type="button"
              className="chip chip-button"
              onClick={() => alternarAccion(accion)}
            >
              + {ACTION_LABEL[accion][config.locale]}
            </button>
          ))}
        </div>

        <label className="chip" data-active={config.strokeLink}>
          <input
            type="checkbox"
            checked={config.strokeLink}
            onChange={() => parche({ strokeLink: !config.strokeLink })}
          />
          {copy.strokeLink}
        </label>
        <p className="hint">{copy.strokeLinkNote}</p>
      </section>

      <section>
        <h2>{copy.limits}</h2>
        <label className="field">
          <span>{copy.maxBytes}</span>
          <input
            type="number"
            min="64"
            max="20480"
            step="64"
            value={config.maxBytesKb}
            onChange={(evento) => parche({ maxBytesKb: Number(evento.target.value) })}
          />
        </label>
      </section>
    </div>
  );
}
