import { describe, expect, it } from "vitest";
import { formatBytes, isMaterialPath, materialKind, materialPath, safeFileName } from "@/lib/materials";

const S = "10000000-0000-0000-0000-00000000000a";
const F = "a0000000-0000-0000-0000-0000000000a1";

describe("materiales", () => {
  it("limpia el nombre del archivo", () => {
    expect(safeFileName("Técnica de Giros (1).PDF")).toBe("tecnica-de-giros-1-.pdf");
    expect(safeFileName("   ")).toBe("archivo");
  });

  it("arma y valida la ruta en la carpeta de la formación", () => {
    const path = materialPath(S, F, "Apunte 1.pdf", 1760000000000);
    expect(path).toBe(`${S}/${F}/1760000000000-apunte-1.pdf`);
    expect(isMaterialPath(S, F, path)).toBe(true);
    expect(isMaterialPath(S, "otra", path)).toBe(false);
    expect(isMaterialPath(S, F, `${S}/${F}/../x.pdf`)).toBe(false);
  });

  it("tipo y tamaño", () => {
    expect(materialKind({ kind: "file", mime_type: "audio/mpeg" })).toBe("audio");
    expect(materialKind({ kind: "link", mime_type: null })).toBe("link");
    expect(formatBytes(2_500_000)).toBe("2,4 MB");
    expect(formatBytes(3000)).toBe("3 KB");
  });
});
