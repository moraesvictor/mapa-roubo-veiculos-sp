import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import { violacoesDeAcessibilidade } from "./test/acessibilidade.ts";

afterEach(cleanup);

describe("App", () => {
  it("mostra o título principal", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("roubos e furtos");
  });

  it("não tem violações de acessibilidade detectáveis pelo axe", async () => {
    const { container } = render(<App />);
    expect(await violacoesDeAcessibilidade(container)).toEqual([]);
  });
});
