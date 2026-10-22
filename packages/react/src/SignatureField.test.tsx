import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SignatureField,
  availableModes,
  type SignatureFieldHandle,
} from "./SignatureField.js";
import { MESSAGES_ES } from "@firma-kit/core";
import type { Bitmap, TextRasterizer } from "@firma-kit/core";

afterEach(cleanup);

// jsdom no implementa object URLs y el sustituto de vitest no acepta un Blob
// real (`_buffer`), así que se puentea aquí: lo que importa es que el
// componente lo cree y lo revoque, no cómo lo serializa el entorno de test.
beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:firma");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

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


// jsdom devuelve un rect de 0×0 y no implementa la captura de puntero: sin esto
// no hay coordenadas y los tests de trazo no probarían nada.
function prepararLienzo(container: HTMLElement): HTMLCanvasElement {
  const lienzo = container.querySelector("canvas")!;
  vi.spyOn(lienzo, "getBoundingClientRect").mockReturnValue({
    left: 0, top: 0, width: 600, height: 200, right: 600, bottom: 200, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  Object.assign(lienzo, { setPointerCapture: () => {}, releasePointerCapture: () => {} });
  return lienzo;
}

function trazar(lienzo: HTMLCanvasElement, x: number, y: number, id = 1): void {
  fireEvent.pointerDown(lienzo, { clientX: x, clientY: y, pointerId: id });
  fireEvent.pointerMove(lienzo, { clientX: x + 12, clientY: y + 6, pointerId: id });
  fireEvent.pointerUp(lienzo, { pointerId: id });
}

describe("availableModes", () => {
  it("hides type without a name but keeps the camera", () => {
    // La cámara se ofrece siempre: en escritorio el input `capture` degrada a
    // selector de archivo, y ocultarla dejaba fuera a tablets y kioscos.
    expect(availableModes({})).toEqual(["draw", "upload", "camera"]);
    expect(availableModes({ name: "Ana" })).toEqual([
      "draw",
      "type",
      "upload",
      "camera",
    ]);
  });

  it("keeps the caller's order and selection", () => {
    expect(availableModes({ modes: ["upload", "draw"] })).toEqual([
      "upload",
      "draw",
    ]);
  });
});

describe("<SignatureField />", () => {
  it("offers every mode, camera included, and hides type without a name", () => {
    render(<SignatureField />);
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["Draw", "Upload", "Camera"]);
  });

  it("offers type when there is a name", () => {
    render(<SignatureField name="Ana" />);
    expect(screen.getAllByRole("tab")).toHaveLength(4);
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

  it("guides the person until there is a stroke, then gets out of the way", () => {
    const { container } = render(<SignatureField />);
    expect(container.querySelector(".signature__hint")).not.toBeNull();

    const lienzo = container.querySelector("canvas")!;
    vi.spyOn(lienzo, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, width: 600, height: 200, right: 600, bottom: 200, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    Object.assign(lienzo, { setPointerCapture: () => {}, releasePointerCapture: () => {} });
    fireEvent.pointerDown(lienzo, { clientX: 30, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(lienzo, { pointerId: 1 });

    // La guía es aria-hidden y desaparece al primer trazo.
    expect(container.querySelector(".signature__hint")).toBeNull();
  });

  it("shows the image the person picked before confirming it", async () => {
    const { container } = render(<SignatureField modes={["upload"]} encoder={encoder()} />);
    const archivo = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "firma.png", {
      type: "image/png",
    });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      fireEvent.change(input, { target: { files: [archivo] } });
    });
    expect(screen.getByAltText("The image you selected").getAttribute("src")).toBe("blob:firma");
  });

  it("undoes the last stroke without losing the previous one", () => {
    const { container } = render(<SignatureField />);
    const lienzo = container.querySelector("canvas")!;
    // jsdom devuelve un rect de 0×0 y no implementa la captura de puntero: sin
    // estas dos líneas no hay coordenadas y el test no probaría nada.
    vi.spyOn(lienzo, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, width: 600, height: 200, right: 600, bottom: 200, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    Object.assign(lienzo, { setPointerCapture: () => {}, releasePointerCapture: () => {} });

    const deshacer = screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;
    expect(deshacer.disabled).toBe(true);

    const trazo = (x: number) => {
      fireEvent.pointerDown(lienzo, { clientX: x, clientY: 100, pointerId: 1 });
      fireEvent.pointerMove(lienzo, { clientX: x + 10, clientY: 110, pointerId: 1 });
      fireEvent.pointerUp(lienzo, { pointerId: 1 });
    };
    trazo(20);
    expect(deshacer.disabled).toBe(false);
    trazo(120);

    fireEvent.click(deshacer);
    // Queda un trazo: el botón sigue disponible.
    expect(deshacer.disabled).toBe(false);
    fireEvent.click(deshacer);
    expect(deshacer.disabled).toBe(true);
  });

  it("redoes what was undone and forgets the stack after a new stroke", () => {
    const { container } = render(<SignatureField />);
    const lienzo = prepararLienzo(container);
    const rehacer = screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement;
    const deshacer = screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;

    trazar(lienzo, 20, 100);
    trazar(lienzo, 120, 140);
    expect(rehacer.disabled).toBe(true);

    fireEvent.click(deshacer);
    expect(rehacer.disabled).toBe(false);

    fireEvent.click(rehacer);
    // La pila se consumió y el trazo volvió.
    expect(rehacer.disabled).toBe(true);
    expect(deshacer.disabled).toBe(false);

    fireEvent.click(deshacer);
    trazar(lienzo, 200, 60);
    // Un trazo nuevo invalida lo que había para rehacer.
    expect(rehacer.disabled).toBe(true);
  });

  it("erases the stroke under the pointer and lets it be redone", () => {
    const { container } = render(<SignatureField />);
    const lienzo = prepararLienzo(container);
    const deshacer = screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;
    trazar(lienzo, 30, 100, 1);
    trazar(lienzo, 300, 120, 2);
    expect(deshacer.disabled).toBe(false);

    const borrador = screen.getByRole("button", { name: "Erase" });
    fireEvent.click(borrador);
    expect(borrador.getAttribute("aria-pressed")).toBe("true");
    // El puntero toca el segundo trazo y lo borra; el primero queda.
    fireEvent.pointerDown(lienzo, { clientX: 306, clientY: 123, pointerId: 3 });
    fireEvent.pointerUp(lienzo, { pointerId: 3 });

    const rehacer = screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement;
    expect(rehacer.disabled).toBe(false);
    fireEvent.click(rehacer);
    expect(rehacer.disabled).toBe(true);
  });

  it("offers full screen and marks the tools it toggles", () => {
    const { container } = render(<SignatureField />);
    const pantalla = screen.getByRole("button", { name: "Full screen" });
    expect(pantalla.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(pantalla);
    expect(pantalla.getAttribute("aria-pressed")).toBe("true");
    expect(
      container.querySelector(".signature__canvas-wrap--expanded")
    ).not.toBeNull();
    // La salida vive dentro del overlay, donde el pulgar la alcanza.
    fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
    expect(container.querySelector(".signature__canvas-wrap--expanded")).toBeNull();
    expect(pantalla.getAttribute("aria-pressed")).toBe("false");
  });

  it("slides one rule to the active tab instead of bordering each one", () => {
    const { container } = render(<SignatureField />);
    expect(container.querySelectorAll(".signature__tab-rule")).toHaveLength(1);
  });

  it("marks the canvas while drawing so the grid steps aside", () => {
    const { container } = render(<SignatureField />);
    const lienzo = prepararLienzo(container);
    const envoltorio = container.querySelector(".signature__canvas-wrap")!;
    expect(envoltorio.getAttribute("data-drawing")).toBe("false");
    fireEvent.pointerDown(lienzo, { clientX: 40, clientY: 90, pointerId: 1 });
    expect(envoltorio.getAttribute("data-drawing")).toBe("true");
    fireEvent.pointerUp(lienzo, { pointerId: 1 });
    expect(envoltorio.getAttribute("data-drawing")).toBe("false");
  });

  it("switches the cursor to the eraser while erasing", () => {
    const { container } = render(<SignatureField />);
    const lienzo = container.querySelector("canvas")!;
    expect(lienzo.className).not.toContain("--erase");
    fireEvent.click(screen.getByRole("button", { name: "Erase" }));
    expect(lienzo.className).toContain("--erase");
  });

  it("gives the impression an ink filter of its own", async () => {
    const { container } = render(
      <SignatureField
        name="Ana Muñoz"
        encoder={encoder()}
        measurer={measurer}
        rasterizer={inkRasterizer}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Type" }));
    fireEvent.click(screen.getByRole("button", { name: "Use this signature" }));
    const imagen = await screen.findByRole("img", { name: /signature generated/i });
    const filtro = container.querySelector("filter");
    expect(filtro).not.toBeNull();
    // El id es único por instancia y la imagen lo referencia por variable: así
    // jsdom no descarta el valor al no entender `url(#…)` en `filter`.
    expect(
      (imagen as HTMLElement).style.getPropertyValue("--signature-ink")
    ).toBe(`url(#${filtro!.id})`);
  });

  it("shows the signing line while drawing", () => {
    const { container } = render(<SignatureField />);
    expect(container.querySelector(".signature__baseline")).not.toBeNull();
  });

  it("shows the generated signature with its size", async () => {
    // Antes solo aparecía el texto "lista": la persona confirmaba a ciegas.
    render(
      <SignatureField
        name="Ana Muñoz"
        encoder={encoder()}
        measurer={measurer}
        rasterizer={inkRasterizer}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Type" }));
    fireEvent.click(screen.getByRole("button", { name: "Use this signature" }));

    const imagen = await screen.findByRole("img", { name: /signature generated/i });
    expect(imagen.getAttribute("src")).toBe("blob:firma");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
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

    // Las cuatro del paquete, como radios de verdad, dentro de su grupo (el modo
    // escribir tiene además el grupo de líneas).
    const grupo = screen.getByRole("radiogroup", { name: /handwriting/i });
    const opciones = within(grupo).getAllByRole("radio");
    expect(opciones.map((o) => o.getAttribute("value"))).toEqual([
      "Caveat",
      "Pacifico",
      "Great Vibes",
      "Sacramento",
    ]);

    fireEvent.click(within(grupo).getByRole("radio", { name: "Pacifico" }));
    fireEvent.click(screen.getByRole("button", { name: "Use this signature" }));
    await waitFor(() => expect(familias.length).toBeGreaterThan(0));
    expect(familias.at(-1)).toBe("Pacifico");
  });

  it("hides the style chooser when only one style is offered", () => {
    render(<SignatureField name="Ana" fonts={["Caveat"]} />);
    fireEvent.click(screen.getByRole("tab", { name: "Type" }));
    expect(screen.queryByRole("radiogroup", { name: /handwriting/i })).toBeNull();
    // El grupo de líneas sigue disponible.
    expect(screen.getByRole("radiogroup", { name: /lines/i })).toBeTruthy();
  });

  it("lets the parent control the style", () => {
    render(<SignatureField name="Ana" font="Great Vibes" onFontChange={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "Type" }));
    const grupo = screen.getByRole("radiogroup", { name: /handwriting/i });
    const elegida = within(grupo)
      .getAllByRole("radio")
      .find((o) => (o as HTMLInputElement).checked);
    expect(elegida?.getAttribute("value")).toBe("Great Vibes");
  });

  it("exposes the size the stylesheet keys on, with md as default", () => {
    const { container, unmount } = render(<SignatureField size="lg" />);
    expect(container.querySelector(".signature")?.getAttribute("data-size")).toBe("lg");
    unmount();
    const porDefecto = render(<SignatureField />);
    expect(
      porDefecto.container.querySelector(".signature")?.getAttribute("data-size")
    ).toBe("md");
  });

  it("renders a live preview of the typed name", () => {
    render(<SignatureField name="Ana Muñoz" />);
    fireEvent.click(screen.getByRole("tab", { name: "Type" }));
    expect(screen.getByLabelText(/live preview/i)).toBeTruthy();
  });

  it("sizes the written sheet by the chosen number of lines", async () => {
    let alto = 0;
    const rasterizer: TextRasterizer = {
      rasterize: (_lineas, _estilo, _interlineado, caja) => {
        alto = caja.height;
        const data = new Uint8ClampedArray(caja.width * caja.height * 4).fill(255);
        for (let y = 20; y < 40; y++) {
          for (let x = 20; x < 200; x++) {
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
        maxLines={1}
        encoder={encoder()}
        measurer={measurer}
        rasterizer={rasterizer}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Type" }));
    fireEvent.click(screen.getByRole("button", { name: "Use this signature" }));
    await waitFor(() => expect(alto).toBeGreaterThan(0));
    // Una línea usa una hoja más baja que dos.
    expect(alto).toBe(120);
  });

  it("lets the host override the theme tokens inline", () => {
    // La vía corta de personalización: pasar los tokens como estilo del campo.
    const { container } = render(
      <SignatureField
        style={{ "--signature-focus": "#7c3aed" } as React.CSSProperties}
      />
    );
    const raiz = container.querySelector(".signature") as HTMLElement;
    expect(raiz.style.getPropertyValue("--signature-focus")).toBe("#7c3aed");
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

describe("barra de acciones", () => {
  const botones = (container: HTMLElement) =>
    within(container.querySelector<HTMLElement>(".signature__actions")!).getAllByRole("button");

  it("pinta las acciones en el orden pedido", () => {
    const { container } = render(<SignatureField toolbar={["confirm", "clear"]} />);
    expect(botones(container).map((boton) => boton.textContent)).toEqual([
      "Use this signature",
      "Clear",
    ]);
  });

  it("deja el campo sin barra cuando la lista va vacía", () => {
    const { container } = render(<SignatureField toolbar={[]} />);
    expect(
      within(container.querySelector<HTMLElement>(".signature__actions")!).queryAllByRole("button")
    ).toHaveLength(0);
  });

  it("omite las acciones de dibujo cuando el modo activo no las usa", () => {
    // «Undo» en el modo escribir no tiene sentido: se omite en vez de aparecer
    // deshabilitado.
    const { container } = render(
      <SignatureField name="María" modes={["type"]} toolbar={["undo", "confirm"]} />
    );
    expect(botones(container).map((boton) => boton.textContent)).toEqual([
      "Use this signature",
    ]);
  });

  it("mantiene el orden de siempre si no se pide otro", () => {
    const { container } = render(<SignatureField />);
    expect(botones(container).map((boton) => boton.textContent)).toEqual([
      "Undo",
      "Redo",
      "Erase",
      "Full screen",
      "Clear",
      "Use this signature",
    ]);
  });
});

describe("modo escribir y cámara", () => {
  const lineas = (container: HTMLElement, etiqueta: string) =>
    within(container).getByLabelText(etiqueta) as HTMLInputElement;

  it("sigue la prop maxLines cuando el padre la cambia", () => {
    // Antes la prop solo se leía al montar: un panel que la cambiara no hacía nada.
    const { container, rerender } = render(
      <SignatureField name="María" modes={["type"]} maxLines={2} />
    );
    expect(lineas(container, "Two lines").checked).toBe(true);

    rerender(<SignatureField name="María" modes={["type"]} maxLines={1} />);
    expect(lineas(container, "One line").checked).toBe(true);
  });

  it("dice «Open camera» en vez del texto del sistema para elegir archivo", () => {
    const { container } = render(<SignatureField modes={["camera"]} />);
    expect(screen.getByText("Open camera")).toBeDefined();
    expect(screen.getByText(/on a phone this opens the camera/i)).toBeDefined();
    // El input sigue ahí —es el que abre la cámara—, pero no lleva texto propio.
    const input = container.querySelector<HTMLInputElement>(".signature__file input");
    expect(input?.type).toBe("file");
  });

  it("traduce la cámara al español", () => {
    render(<SignatureField modes={["camera"]} locale="es" />);
    expect(screen.getByText("Abrir cámara")).toBeDefined();
    expect(screen.getByText(/abre la cámara/i)).toBeDefined();
  });

  it("muestra las cursivas para que quepan en una fila", () => {
    render(<SignatureField name="María" modes={["type"]} />);
    expect(screen.getByLabelText("Handwriting style")).toBeDefined();
    expect(screen.getAllByRole("radio").length).toBeGreaterThanOrEqual(4);
  });
});
