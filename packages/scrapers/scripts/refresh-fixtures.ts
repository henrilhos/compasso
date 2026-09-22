/**
 * Regrava as fixtures de extração a partir das fontes ao vivo, para que
 * atualizá-las não vire trabalho manual. Cada fonte se registra aqui
 * quando implementada (issues #6-#10); a lista começa vazia porque
 * nenhum scraper real existe ainda.
 */
const refreshers: Record<string, () => Promise<void>> = {};

async function main() {
  const entries = Object.entries(refreshers);
  if (entries.length === 0) {
    console.log("No fixture refreshers registered yet.");
    return;
  }

  for (const [name, refresh] of entries) {
    console.log(`Refreshing fixtures for ${name}...`);
    await refresh();
  }
}

main();
