import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { NOMES_DE_ICONE, Icone } from "../icones/Icone.tsx";
import { violacoesDeAcessibilidade } from "../test/acessibilidade.ts";
import { Botao } from "./Botao.tsx";
import { Chip } from "./Chip.tsx";

afterEach(cleanup);

function ChipControlado() {
  const [ligado, setLigado] = useState(false);
  return <Chip rotulo="Moto" selecionado={ligado} aoAlternar={() => setLigado((v) => !v)} />;
}

describe("Chip", () => {
  it("alterna aria-pressed e mostra o check só quando selecionado", async () => {
    render(<ChipControlado />);
    const chip = screen.getByRole("button", { name: "Moto" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    expect(chip.querySelector("svg")).toBeNull();
    await userEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(chip.querySelector("svg")).not.toBeNull();
  });

  it("não tem violações do axe", async () => {
    const { container } = render(<ChipControlado />);
    expect(await violacoesDeAcessibilidade(container)).toEqual([]);
  });
});

describe("Botao", () => {
  it("é type=button por padrão e o ícone não entra no nome acessível", () => {
    render(<Botao icone="compartilhar">Compartilhar</Botao>);
    const botao = screen.getByRole("button", { name: "Compartilhar" });
    expect(botao.getAttribute("type")).toBe("button");
  });
});

describe("Icone", () => {
  it.each(NOMES_DE_ICONE)("%s existe no Figma exportado e usa currentColor", (nome) => {
    const { container } = render(<Icone nome={nome} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.innerHTML).toContain("currentColor");
    expect(svg?.innerHTML).not.toContain("#212121");
  });
});
