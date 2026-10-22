import { describe, expect, it } from "vitest";

import { createCanvasTextRasterizer } from "./rasterizer.js";

describe("createCanvasTextRasterizer", () => {
  it("devuelve null cuando no hay contexto 2D, para que el motivo sea explicable", () => {
    const rasterizer = createCanvasTextRasterizer(() => ({
      width: 0,
      height: 0,
      getContext: () => null,
    }) as unknown as HTMLCanvasElement);
    const res = rasterizer.rasterize(
      ["Ana"],
      { family: "Caveat", size: 48 },
      55,
      { width: 400, height: 200 }
    );
    expect(res).toBeNull();
  });
});
