import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdsDisclosure } from "./AdsDisclosure";

describe("AdsDisclosure", () => {
  it("says what Google requires about third-party cookies", () => {
    const { container } = render(<AdsDisclosure />);
    const text = container.textContent ?? "";

    expect(text).toContain("Los proveedores externos, incluido Google, utilizan cookies");
    expect(text).toContain("según las visitas anteriores");
    expect(text).toContain("Google y a sus socios");
    expect(text).toContain("pueden colocar y leer cookies en su navegador");
    expect(text).toContain("balizas web, direcciones IP u otros identificadores");
  });

  it("links to every way of opting out, in a new tab", () => {
    render(<AdsDisclosure />);
    const expected = {
      "Configuración de anuncios de Google": "https://www.google.com/settings/ads",
      "aboutads.info": "https://www.aboutads.info/choices/",
      "Cómo utiliza Google los datos de los sitios de sus socios":
        "https://www.google.com/policies/privacy/partners/",
    };

    for (const [name, href] of Object.entries(expected)) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
});
