import { execFileSync } from "node:child_process";

const IMAGEM = process.env.IMAGEM ?? "mapa-bff-spike";
const RODADAS = Number(process.env.RODADAS ?? 3);
const PERFIS = [
  { nome: "256 MB, 1 CPU", memoria: "256m", cpus: "1" },
  { nome: "256 MB, 1/4 CPU", memoria: "256m", cpus: "0.25" },
];
const PERIODOS = ["madrugada", "manha", "tarde", "noite", "hora-incerta"];
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const docker = (...args: string[]) => execFileSync("docker", args, { encoding: "utf8" }).trim();
const mediana = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;

const filtroAleatorio = () => {
  const p = PERIODOS.filter(() => Math.random() < 0.5);
  const v = ["carro", "moto", "carro,moto"][Math.floor(Math.random() * 3)];
  return `veiculo=${v}${p.length ? `&periodo=${p.join(",")}` : ""}`;
};

async function carga(base: string, total: number, concorrencia: number) {
  const tempos: number[] = [];
  let erros = 0;
  let feitos = 0;
  const t0 = performance.now();
  await Promise.all(
    Array.from({ length: concorrencia }, async () => {
      while (feitos < total) {
        feitos++;
        const t = performance.now();
        const r = await fetch(`${base}/v1/zonas?${filtroAleatorio()}`).catch(() => null);
        if (!r?.ok) erros++;
        await r?.arrayBuffer();
        tempos.push(performance.now() - t);
      }
    }),
  );
  const s = (performance.now() - t0) / 1000;
  return { reqPorSegundo: Math.round(total / s), p50ms: Math.round(mediana(tempos)), p95ms: Math.round([...tempos].sort((a, b) => a - b)[Math.floor(tempos.length * 0.95)]!), erros };
}

const memoria = (id: string) => {
  const ler = (f: string) => Math.round(Number(docker("exec", id, "cat", `/sys/fs/cgroup/${f}`)) / 2 ** 20);
  return { atualMB: ler("memory.current"), picoMB: ler("memory.peak") };
};

console.log(JSON.stringify({ imagemMB: Math.round(Number(docker("image", "inspect", IMAGEM, "--format", "{{.Size}}")) / 1e6) }));
for (let r = 1; r <= RODADAS; r++)
  for (const p of PERFIS) {
    const porta = 18080 + r;
    const t0 = performance.now();
    const id = docker("run", "-d", "--rm", `--memory=${p.memoria}`, "--memory-swap", p.memoria, `--cpus=${p.cpus}`, "-p", `127.0.0.1:${porta}:8080`, IMAGEM);
    const base = `http://127.0.0.1:${porta}`;
    let primeiraResposta = -1;
    for (let i = 0; i < 300 && primeiraResposta < 0; i++) {
      const ok = await fetch(`${base}/v1/zonas`).then((x) => x.ok).catch(() => false);
      if (ok) primeiraResposta = Math.round(performance.now() - t0);
      else await esperar(50);
    }
    await esperar(1000);
    const ocioso = memoria(id);
    const resultadoCarga = await carga(base, 2000, 20);
    const depois = memoria(id);
    const oom = docker("inspect", id, "--format", "{{.State.OOMKilled}}");
    docker("stop", "-t", "1", id);
    console.log(JSON.stringify({ rodada: r, perfil: p.nome, primeiraRespostaMs: primeiraResposta, ocioso, carga: resultadoCarga, depoisDaCarga: depois, oom }));
  }
