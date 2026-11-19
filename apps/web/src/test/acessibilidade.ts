import axe from "axe-core";

export async function violacoesDeAcessibilidade(container: Element) {
  const { violations } = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
  });
  return violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} elemento(s))`);
}
