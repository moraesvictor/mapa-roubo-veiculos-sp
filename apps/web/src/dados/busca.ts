import { buscarLugares, cepDe, fatiaDe, RespostaCep, type Lugar, type Resultado } from "@mapa/core";
import { useEffect, useState } from "react";
import { z } from "zod";
import { carregar, ErroDaApi } from "./api.ts";

const Fatia = z.array(
  z.object({
    nome: z.string(),
    outros: z.array(z.string()).optional(),
    tipo: z.enum(["rua", "bairro"]),
    perto: z.string(),
    celulas: z.array(z.string()),
    celula: z.string(),
    centro: z.tuple([z.number(), z.number()]),
  }),
);

const fatias = new Map<string, Promise<Lugar[]>>();

function carregarFatia(chave: string): Promise<Lugar[]> {
  const emCache = fatias.get(chave);
  if (emCache) return emCache;
  const promessa = fetch(`/busca/${chave}.json`)
    .then(async (res) => (res.status === 404 ? [] : res.ok ? (Fatia.parse(await res.json()) as Lugar[]) : Promise.reject(new Error(`Fatia ${chave}: ${res.status}`))))
    .catch((erro: unknown) => {
      fatias.delete(chave);
      throw erro;
    });
  fatias.set(chave, promessa);
  return promessa;
}

export async function procurar(texto: string): Promise<{ resultados: Resultado[]; cep?: RespostaCep }> {
  const cep = cepDe(texto);
  if (cep) {
    const resposta = await carregar(`/v1/cep/${cep}`, RespostaCep);
    if (!resposta.emSaoPaulo || !resposta.logradouro) return { resultados: [], cep: resposta };
    const consulta = [resposta.logradouro, resposta.bairro].filter(Boolean).join(", ");
    const chave = fatiaDe(resposta.logradouro);
    return { resultados: chave ? buscarLugares(await carregarFatia(chave), consulta, 3) : [], cep: resposta };
  }
  const chave = fatiaDe(texto.split(",")[0] ?? "");
  if (!chave) return { resultados: [] };
  return { resultados: buscarLugares(await carregarFatia(chave), texto, 6) };
}

export type EstadoDaBusca =
  | { estado: "vazio" }
  | { estado: "procurando" }
  | { estado: "pronto"; resultados: Resultado[]; cep?: RespostaCep }
  | { estado: "erro"; mensagem: string };

export function useBusca(texto: string, espera = 150): EstadoDaBusca {
  const [resultado, setResultado] = useState<{ texto: string; estado: EstadoDaBusca } | null>(null);
  const curto = texto.trim().length < 3;

  useEffect(() => {
    if (curto) return;
    let vivo = true;
    const t = setTimeout(() => {
      procurar(texto).then(
        (r) => vivo && setResultado({ texto, estado: { estado: "pronto", ...r } }),
        (erro: unknown) =>
          vivo &&
          setResultado({
            texto,
            estado: {
              estado: "erro",
              mensagem: erro instanceof ErroDaApi && erro.status === 404 ? "CEP não encontrado." : "Não deu pra buscar agora. Tente de novo em instantes.",
            },
          }),
      );
    }, espera);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [texto, curto, espera]);

  if (curto) return { estado: "vazio" };
  return resultado?.texto === texto ? resultado.estado : { estado: "procurando" };
}
