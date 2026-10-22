import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SignatureField,
  availableModes,
  type SignatureFieldHandle,
} from "./SignatureField.js";
import { MESSAGES_ES } from "@firma-kit/core";
import type { Bitmap, TextRasterizer } from "@firma-kit/core";

afterEach(cleanup);

const encoder = () => vi.fn(async () => new Uint8Array([7, 7, 7]));

/** Rasterizer that paints a dark bar: enough ink to pass the pipeline gates. */
const inkRasterizer: TextRasterizer = {
  rasterize: (_lines, _style, _lineHeight, bounds) => {
    const { width, height } = bounds;
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

const measurer = {
  measure: (text: string, style: { size: number }) => ({
    width: text.length * style.size * 0.5,
    height: style.size,
  }),
};

describe("availableModes", () => {
  it("hides type without a name and camera without a camera", () => {
    expect(availableModes({ hasCamera: false })).toEqual(["draw", "upload"]);
    expect(availableModes({ name: "Ana", hasCamera: true })).toEqual([
      "draw",
      "type",
      "upload",
      "camera",
    ]);
  });

  it("keeps the caller's order and selection", () => {
    expect(
      availableModes({ modes: ["upload", "draw"], hasCamera: true })
    ).toEqual(["upload", "draw"]);
  });
});

describe("<SignatureField />", () => {
  it("offers only the possible modes", () => {
    render(<SignatureField />);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.queryByRole("tab", { name: "Type" })).toBeNull();
  });

  it("offers type when there is a name", () => {
    render(<SignatureField name="Ana" />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Type" })).toBeTruthy();
  });

  it("marks the active tab and navigates with the arrow keys", () => {
    render(<SignatureField />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(tabs[0]!, { key: "ArrowRight" });
    const afterRight = screen.getAllByRole("tab");
    expect(afterRight[1]!.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(afterRight[1]!, { key: "Home" });
    expect(screen.getAllByRole("tab")[0]!.getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  it("exposes clear, confirm and openMode through the ref", () => {
    const ref = createRef<SignatureFieldHandle>();
    render(<SignatureField ref={ref} />);
    expect(typeof ref.current?.clear).toBe("function");
    expect(typeof ref.current?.confirm).toBe("function");
    act(() => ref.current?.openMode("upload"));
    expect(screen.getByText("Upload an image of the signature")).toBeTruthy();
  });

  it("reports a rejection instead of failing silently when there is no canvas", async () => {
    const onRejection = vi.fn();
    render(<SignatureField onRejection={onRejection} encoder={encoder()} />);
    fireEvent.click(screen.getByRole("button", { name: "Use this signature" }));
    await screen.findByRole("alert");
    expect(onRejection).toHaveBeenCalledWith("empty", expect.any(String));
  });

  it("returns the signature from the type mode with its bytes", async () => {
    const onSignature = vi.fn();
    const png = encoder();
    render(
      <SignatureField
        name="José Muñoz"
        onSignature={onSignature}
        encoder={png}
        measurer={measurer}
        rasterizer={inkRasterizer}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Type" }));
    fireEvent.click(screen.getByRole("button", { name: "Use this signature" }));
    await screen.findByText("Signature ready to save.");
    expect(png).toHaveBeenCalledTimes(1);
    expect(onSignature).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "type",
        png: new Uint8Array([7, 7, 7]),
      })
    );
  });

  it("reports the signature to a controlled parent and reflects its value", async () => {
    const onSignature = vi.fn();
    const png = encoder();
    const { rerender } = render(
      <SignatureField
        value={null}
        name="Ana Ruiz"
        onSignature={onSignature}
        encoder={png}
        measurer={measurer}
        rasterizer={inkRasterizer}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Type" }));
    fireEvent.click(screen.getByRole("button", { name: "Use this signature" }));
    await waitFor(() => expect(onSignature).toHaveBeenCalledTimes(1));

    // En controlado el padre decide: hasta que no pase la firma en `value`, el
    // componente no muestra el estado de "lista".
    expect(screen.queryByText("Signature ready to save.")).toBeNull();
    const firmada = onSignature.mock.calls[0]![0];
    rerender(
      <SignatureField
        value={firmada}
        name="Ana Ruiz"
        onSignature={onSignature}
        encoder={png}
        measurer={measurer}
        rasterizer={inkRasterizer}
      />
    );
    expect(screen.getByText("Signature ready to save.")).toBeTruthy();
  });

  it("tells a controlled parent when the field is cleared", () => {
    // Bug real: en modo controlado `clear` se callaba, así que el padre nunca
    // podía enterarse de que la persona había limpiado el campo.
    const onSignature = vi.fn();
    render(<SignatureField value={null} onSignature={onSignature} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onSignature).toHaveBeenCalledWith(null);
  });

  it("rejects a file whose bytes are not PNG or JPEG, before decoding it", async () => {
    // Un PDF renombrado a .png: el MIME declarado no basta, mandan los magic bytes.
    const onRejection = vi.fn();
    const png = encoder();
    const { container } = render(
      <SignatureField modes={["upload"]} onRejection={onRejection} encoder={png} />
    );
    const archivo = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "firma.png", {
      type: "image/png",
    });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      fireEvent.change(input, { target: { files: [archivo] } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Use this signature" }));
    await screen.findByRole("alert");
    expect(onRejection).toHaveBeenCalledWith(
      "unsupported_format",
      expect.stringContaining("PNG or JPG")
    );
    expect(png).not.toHaveBeenCalled();
  });

  it("rejects a file over the size limit without touching it", async () => {
    const onRejection = vi.fn();
    const png = encoder();
    const { container } = render(
      <SignatureField
        modes={["upload"]}
        maxBytes={10}
        onRejection={onRejection}
        encoder={png}
      />
    );
    const archivo = new File([new Uint8Array(100)], "grande.png", { type: "image/png" });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      fireEvent.change(input, { target: { files: [archivo] } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Use this signature" }));
    await screen.findByRole("alert");
    expect(onRejection).toHaveBeenCalledWith("too_heavy", expect.any(String));
    expect(png).not.toHaveBeenCalled();
  });

  it("says the rejection in Spanish when asked", async () => {
    const onRejection = vi.fn();
    const { container } = render(
      <SignatureField
        modes={["upload"]}
        locale="es"
        maxBytes={10}
        onRejection={onRejection}
        encoder={encoder()}
      />
    );
    const archivo = new File([new Uint8Array(100)], "grande.png", { type: "image/png" });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      fireEvent.change(input, { target: { files: [archivo] } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Usar esta firma" }));
    await screen.findByRole("alert");
    expect(onRejection).toHaveBeenCalledWith("too_heavy", MESSAGES_ES.too_heavy);
  });

  it("asks for an image before confirming in upload mode", async () => {
    const onRejection = vi.fn();
    render(<SignatureField onRejection={onRejection} encoder={encoder()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Upload" }));
    fireEvent.click(screen.getByRole("button", { name: "Use this signature" }));
    expect(
      await screen.findByText("Choose an image before continuing.")
    ).toBeTruthy();
    expect(onRejection).not.toHaveBeenCalled();
  });

  it("offers the four handwriting styles and uses the chosen one", async () => {
    const familias: string[] = [];
    const rasterizer: TextRasterizer = {
      rasterize: (_lineas, estilo, _interlineado, caja) => {
        familias.push(estilo.family);
        const data = new Uint8ClampedArray(caja.width * caja.height * 4).fill(255);
        for (let y = 40; y < 48; y++) {
          for (let x = 40; x < 240; x++) {
            const i = (y * caja.width + x) * 4;
            data[i] = 20;
            data[i + 1] = 20;
            data[i + 2] = 20;
          }
        }
        return { data, width: caja.width, height: caja.height };
      },
    };
    render(
      <SignatureField
        name="Ana Muñoz"
        encoder={encoder()}
        measurer={measurer}
        rasterizer={rasterizer}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Type" }));

    // Las cuatro del paquete, como radios de verdad.
    const opciones = screen.getAllByRole("radio");
    expect(opciones.map((o) => o.getAttribute("value"))).toEqual([
      "Caveat",
      "Pacifico",
      "Great Vibes",
      "Sacramento",
    ]);

    fireEvent.click(screen.getByRole("radio", { name: "Pacifico" }));
    fireEvent.click(screen.getByRole("button", { name: "Use this signature" }));
    await waitFor(() => expect(familias.length).toBeGreaterThan(0));
    expect(familias.at(-1)).toBe("Pacifico");
  });

  it("hides the chooser when only one style is offered", () => {
    render(<SignatureField name="Ana" fonts={["Caveat"]} />);
    fireEvent.click(screen.getByRole("tab", { name: "Type" }));
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("lets the parent control the style", () => {
    render(<SignatureField name="Ana" font="Great Vibes" onFontChange={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "Type" }));
    const elegida = screen
      .getAllByRole("radio")
      .find((o) => (o as HTMLInputElement).checked);
    expect(elegida?.getAttribute("value")).toBe("Great Vibes");
  });

  it("renders the theme attribute the stylesheet keys on", () => {
    // La hoja pinta su propia superficie según `data-theme`; si el atributo no
    // llega al DOM, en un esquema oscuro el texto queda blanco sobre blanco.
    const { container, unmount } = render(<SignatureField theme="dark" />);
    expect(container.querySelector(".signature")?.getAttribute("data-theme")).toBe("dark");
    unmount();
    const segundo = render(<SignatureField />);
    expect(segundo.container.querySelector(".signature")?.hasAttribute("data-theme")).toBe(false);
  });

  it("returns the rejection message in the requested language", async () => {
    const onRejection = vi.fn();
    render(
      <SignatureField
        locale="es"
        onRejection={onRejection}
        encoder={encoder()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Usar esta firma" }));
    await screen.findByRole("alert");
    // El mensaje viene del core, no de la tabla de etiquetas: si `locale` no
    // viaja en coreOptions, esto falla con el texto inglés.
    expect(onRejection).toHaveBeenCalledWith(
      "empty",
      MESSAGES_ES.empty
    );
  });

  it("keeps the Spanish copy exactly as the baseline had it", async () => {
    // Regresión de copy: la tabla por idioma perdía el punto final de los
    // mensajes que ya existían antes del renombrado.
    const onRejection = vi.fn();
    render(<SignatureField locale="es" onRejection={onRejection} encoder={encoder()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Subir imagen" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar esta firma" }));
    expect(
      await screen.findByText("Elige una imagen antes de continuar.")
    ).toBeTruthy();
  });

  it("speaks Spanish when the caller asks for it", () => {
    render(<SignatureField name="Ana" locale="es" />);
    expect(screen.getByRole("tab", { name: "Dibujar" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Escribir" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Limpiar" })).toBeTruthy();
  });
});
