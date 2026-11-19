import { hc } from "hono/client";
import type { AppHono } from "./app-hono.ts";

const api = hc<AppHono>("http://localhost:3001");

export async function exemplo() {
  const res = await api.v1.zonas.$get({ query: { veiculo: "moto", periodo: "noite" } });
  if (res.status === 200) {
    const corpo = await res.json();
    const primeira: string | undefined = corpo.celulas[0]?.h3;
    return { total: corpo.total, primeira };
  }
  // @ts-expect-error a rota não existe no BFF, então o front nem compila
  await api.v1.zona.$get();
  // @ts-expect-error o campo se chama "veiculo", e "veiculos" não faz parte do contrato
  await api.v1.zonas.$get({ query: { veiculos: "moto" } });
  return null;
}
