export const SUBTRACAO = new Set(["ROUBADO", "FURTADO"]);

export function medir(runtime: string, arquivo: string) {
  const inicio = performance.now();
  let pico = 0;
  const amostrar = setInterval(() => {
    pico = Math.max(pico, process.memoryUsage.rss());
  }, 50);
  return (dados: Record<string, unknown>) => {
    clearInterval(amostrar);
    pico = Math.max(pico, process.memoryUsage.rss());
    console.log(
      JSON.stringify({
        runtime: `${runtime} (node ${process.versions.node})`,
        arquivo: arquivo.split("/").pop(),
        ...dados,
        segundos_total: Math.round((performance.now() - inicio) / 10) / 100,
        pico_memoria_mb: Math.round(pico / 1024 / 1024 * 10) / 10,
      }),
    );
  };
}
