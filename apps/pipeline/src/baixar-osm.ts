import { mkdir, writeFile } from "node:fs/promises";

const destino = new URL("../../../data/tmp/osm/", import.meta.url);
const AREA = 'area["name"="São Paulo"]["admin_level"="8"]["boundary"="administrative"]->.sp;';
const consultas = {
  ruas: `[out:json][timeout:300];${AREA}way["highway"]["name"](area.sp);out tags center qt;`,
  lugares: `[out:json][timeout:180];${AREA}(nwr["place"~"^(suburb|neighbourhood|quarter)$"]["name"](area.sp);rel["boundary"="administrative"]["admin_level"~"^(9|10)$"]["name"](area.sp););out tags center qt;`,

};

const SERVIDORES = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

async function baixar(consulta: string, nome: string) {
  let espera = 30_000;
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const servidor = SERVIDORES[tentativa % SERVIDORES.length] ?? "";
    const r = await fetch(servidor, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "street-index-pipeline/0.1" },
      body: new URLSearchParams({ data: consulta }),
    }).catch((e: Error) => ({ ok: false, status: e.message, text: async () => "" }) as const);
    if (r.ok) return r.text();
    console.error(`${nome}: ${servidor} respondeu ${r.status}, nova tentativa em ${espera / 1000} s`);
    await new Promise((ok) => setTimeout(ok, espera));
    espera *= 2;
  }
  throw new Error(`${nome}: sem resposta depois de 6 tentativas`);
}

await mkdir(destino, { recursive: true });
const pedidas = process.argv.slice(2);
for (const [nome, consulta] of Object.entries(consultas).filter(([n]) => !pedidas.length || pedidas.includes(n))) {
  const t0 = performance.now();
  const texto = await baixar(consulta, nome);
  await writeFile(new URL(`${nome}.json`, destino), texto);
  console.log(JSON.stringify({ nome, elementos: (JSON.parse(texto) as { elements: unknown[] }).elements.length, MB: Math.round(texto.length / 1e5) / 10, s: Math.round((performance.now() - t0) / 100) / 10 }));
  await new Promise((ok) => setTimeout(ok, 5000));
}
