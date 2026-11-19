import { createServer, type Server } from "node:http";
import { FILTROS_PADRAO } from "@mapa/core";

const json = (status: number, corpo: unknown) => ({ status, corpo });

function rotear(metodo: string | undefined, caminho: string) {
  if (metodo !== "GET") return json(405, { erro: "método não permitido" });
  if (caminho === "/health") return json(200, { status: "ok" });
  if (caminho === "/v1/filtros") return json(200, FILTROS_PADRAO);
  return json(404, { erro: "não encontrado" });
}

export function criarServidor(): Server {
  return createServer((req, res) => {
    const caminho = new URL(req.url ?? "/", "http://localhost").pathname;
    const { status, corpo } = rotear(req.method, caminho);
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(corpo));
  });
}
