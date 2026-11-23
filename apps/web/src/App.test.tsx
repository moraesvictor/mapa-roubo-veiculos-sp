import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import { ABAS } from "./componentes/Moldura.tsx";
import { violacoesDeAcessibilidade } from "./test/acessibilidade.ts";

afterEach(cleanup);

describe("App", () => {
  it.each(ABAS)("abre $rotulo com título, aba ativa e sem violações do axe", async ({ caminho, rotulo }) => {
    const { container } = render(<App caminhoInicial={caminho} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    const navegacao = screen.getByRole("navigation", { name: "Principal" });
    const ativa = navegacao.querySelector('[aria-current="page"]');
    expect(ativa?.textContent?.trim()).toBe(rotulo);
    expect(await violacoesDeAcessibilidade(container)).toEqual([]);
  });

  it("mostra página de não encontrado em caminho desconhecido", () => {
    render(<App caminhoInicial="/nao-existe" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Página não encontrada");
  });

  it("tem atalho pra pular a navegação", () => {
    render(<App caminhoInicial="/" />);
    expect(screen.getByRole("link", { name: "Pular para o conteúdo" }).getAttribute("href")).toBe("#conteudo");
  });
});
