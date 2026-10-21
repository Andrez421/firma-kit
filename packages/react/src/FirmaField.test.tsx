import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FirmaField,
  modosDisponibles,
  type FirmaFieldHandle,
} from "./FirmaField.js";
import type { Bitmap, TextRasterizer } from "@firma-kit/core";

afterEach(cleanup);

const encoder = () => vi.fn(async () => new Uint8Array([7, 7, 7]));

/** Rasterizador que dibuja una barra oscura: tinta suficiente para el pipeline. */
const rasterizerTinta: TextRasterizer = {
  rasterizar: (_lineas, _estilo, _interlineado, caja) => {
    const { width, height } = caja;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    for (let y = 40; y < 48; y++) {
      for (let x = 40; x < 240; x++) {
        const i = (y * width + x) * 4;
        data[i] = 20;
        data[i + 1] = 20;
        data[i + 2] = 20;
      }
    }
    return { data, width, height } satisfies Bitmap;
  },
};

const medidor = {
  medir: (texto: string, estilo: { tamano: number }) => ({
    ancho: texto.length * estilo.tamano * 0.5,
    alto: estilo.tamano,
  }),
};

describe("modosDisponibles", () => {
  it("oculta escribir sin nombre y foto sin cámara", () => {
    expect(modosDisponibles({ conCamara: false })).toEqual(["dibujar", "subir"]);
    expect(modosDisponibles({ nombre: "Ana", conCamara: true })).toEqual([
      "dibujar",
      "escribir",
      "subir",
      "foto",
    ]);
  });

  it("respeta el orden y la selección del llamador", () => {
    expect(
      modosDisponibles({ modos: ["subir", "dibujar"], conCamara: true })
    ).toEqual(["subir", "dibujar"]);
  });
});

describe("<FirmaField />", () => {
  it("ofrece solo los modos posibles", () => {
    render(<FirmaField />);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.queryByRole("tab", { name: "Escribir" })).toBeNull();
  });

  it("ofrece escribir cuando hay nombre", () => {
    render(<FirmaField nombre="Ana" />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Escribir" })).toBeTruthy();
  });

  it("marca la pestaña activa y navega con las flechas", () => {
    render(<FirmaField />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(tabs[0]!, { key: "ArrowRight" });
    const despues = screen.getAllByRole("tab");
    expect(despues[1]!.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(despues[1]!, { key: "Home" });
    expect(screen.getAllByRole("tab")[0]!.getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  it("expone limpiar, confirmar y abrirModo por ref", () => {
    const ref = createRef<FirmaFieldHandle>();
    render(<FirmaField ref={ref} />);
    expect(typeof ref.current?.limpiar).toBe("function");
    expect(typeof ref.current?.confirmar).toBe("function");
    act(() => ref.current?.abrirModo("subir"));
    expect(screen.getByText("Subir imagen de la firma")).toBeTruthy();
  });

  it("avisa de un rechazo en vez de fallar en silencio cuando no hay canvas", async () => {
    const onRechazo = vi.fn();
    render(<FirmaField onRechazo={onRechazo} encoder={encoder()} />);
    fireEvent.click(screen.getByRole("button", { name: "Usar esta firma" }));
    await screen.findByRole("alert");
    expect(onRechazo).toHaveBeenCalledWith("vacia", expect.any(String));
  });

  it("entrega la firma del modo escribir con sus bytes", async () => {
    const onFirma = vi.fn();
    const png = encoder();
    render(
      <FirmaField
        nombre="José Muñoz"
        onFirma={onFirma}
        encoder={png}
        medidor={medidor}
        rasterizer={rasterizerTinta}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Escribir" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar esta firma" }));
    await screen.findByText("Firma lista para guardar.");
    expect(png).toHaveBeenCalledTimes(1);
    expect(onFirma).toHaveBeenCalledWith(
      expect.objectContaining({
        modo: "escribir",
        png: new Uint8Array([7, 7, 7]),
      })
    );
  });

  it("pide una imagen antes de confirmar en modo subir", async () => {
    const onRechazo = vi.fn();
    render(<FirmaField onRechazo={onRechazo} encoder={encoder()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Subir imagen" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar esta firma" }));
    expect(
      await screen.findByText("Elige una imagen antes de continuar.")
    ).toBeTruthy();
    expect(onRechazo).not.toHaveBeenCalled();
  });
});
