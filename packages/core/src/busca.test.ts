import { describe, expect, it } from "vitest";
import { buscarLugares, cepDe, fatiaDe, palavras, pertoDe, separarConsulta, type Lugar } from "./busca.ts";

const entrada = (nome: string, perto: string, tipo: Lugar["tipo"] = "rua", celulas = ["a"]): Lugar => ({ nome, tipo, perto, celulas, celula: celulas[0] ?? "a", centro: [0, 0] });
const indice: { entradas: Lugar[] } = {
  entradas: [
    entrada("Avenida Paulista", "Bela Vista", "rua", ["a", "b", "c"]),
    entrada("Rua Augusta", "Consolação", "rua", ["d", "e"]),
    entrada("Rua São José", "Santo Amaro"),
    entrada("Rua São José", "Penha"),
    entrada("Avenida Jacu-Pêssego/Nova Trabalhadores", "Itaquera"),
    entrada("Rua Vinte e Cinco de Março", "Sé"),
    entrada("Pinheiros", "Pinheiros", "bairro"),
  ],
};
const primeiro = (q: string) => buscarLugares(indice.entradas, q)[0]?.lugar;

describe("busca local de endereço", () => {
  it("entende abreviação, falta de acento e número da casa", () => {
    expect(primeiro("av paulista 1578")?.nome).toBe("Avenida Paulista");
    expect(primeiro("Av. Paulista, 1578 - São Paulo, SP")?.nome).toBe("Avenida Paulista");
  });

  it("autocompleta a última palavra enquanto a pessoa digita", () => {
    expect(primeiro("rua aug")?.nome).toBe("Rua Augusta");
    expect(primeiro("pinh")?.nome).toBe("Pinheiros");
  });

  it("tolera um erro de digitação em palavras longas", () => {
    expect(primeiro("avenida paulsta")?.nome).toBe("Avenida Paulista");
  });

  it("usa o bairro depois da vírgula pra escolher entre ruas com o mesmo nome", () => {
    expect(primeiro("Rua São José, Penha")?.perto).toBe("Penha");
    expect(primeiro("R. S. Jose, santo amaro")?.perto).toBe("Santo Amaro");
  });

  it("mantém nomes com hífen inteiros", () => {
    expect(primeiro("jacu-pessego")?.nome).toContain("Jacu-Pêssego");
  });

  it("não acha nada quando nenhuma palavra bate", () => {
    expect(buscarLugares(indice.entradas, "rua inexistente qualquer")).toEqual([]);
  });

  it("reconhece CEP e só CEP", () => {
    expect(cepDe("01310-200")).toBe("01310200");
    expect(cepDe("01310200")).toBe("01310200");
    expect(cepDe("Rua 01310200")).toBeNull();
  });

  it("descarta cidade e número ao separar as partes", () => {
    expect(separarConsulta("Rua Augusta, 900, Consolação, São Paulo")).toEqual({ principal: "Rua Augusta", contexto: palavras("Consolação") });
  });
});

describe("números e grafias", () => {
  const idx = [entrada("Rua 25 de Março", "Sé"), entrada("Rua 22 de Março", "Vila Granada"), entrada("Avenida Engenheiro Luís Carlos Berrini", "Brooklin")];
  it("mantém número que faz parte do nome e descarta o número da casa", () => {
    expect(buscarLugares(idx, "Rua 25 de Março")[0]?.lugar.nome).toBe("Rua 25 de Março");
    expect(buscarLugares(idx, "Rua 25 de Março, 1000")[0]?.lugar.nome).toBe("Rua 25 de Março");
    expect(buscarLugares(idx, "rua 25 de marco 1000")[0]?.lugar.nome).toBe("Rua 25 de Março");
  });
  it("aceita Luiz por Luís", () => {
    expect(buscarLugares(idx, "Avenida Engenheiro Luiz Carlos Berrini")[0]?.lugar.nome).toContain("Berrini");
  });
});

describe("nomes alternativos", () => {
  it("acha a rua pelo nome alternativo", () => {
    const idx = [{ ...entrada("Rua Vinte e Cinco de Março", "Sé"), outros: ["Rua 25 de Março"] }];
    expect(buscarLugares(idx, "rua 25 de março")[0]?.lugar.nome).toBe("Rua Vinte e Cinco de Março");
  });
});

describe("fatias do índice", () => {
  it("usa as duas primeiras letras da primeira palavra que não é genérica", () => {
    expect(fatiaDe("Avenida Paulista")).toBe("pa");
    expect(fatiaDe("av paul")).toBe("pa");
    expect(fatiaDe("Rua São Jorge")).toBe("jo");
    expect(fatiaDe("Pinheiros")).toBe("pi");
    expect(fatiaDe("av p")).toBeNull();
  });
});

describe("perto de", () => {
  it("escolhe o artigo pelo tipo de via", () => {
    expect(pertoDe("Avenida Paulista")).toBe("Perto da Avenida Paulista");
    expect(pertoDe("Largo do Arouche")).toBe("Perto do Largo do Arouche");
    expect(pertoDe("Pinheiros")).toBe("Perto de Pinheiros");
  });
});
