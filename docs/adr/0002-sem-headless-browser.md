# Sem headless browser na v1

Todos os scrapers usam `fetch` puro: API JSON quando existe, senão JSON
embutido no HTML (`__NEXT_DATA__`, payload RSC, JSON-LD), senão cheerio.
Rejeitamos Playwright na v1 porque ele pesa no workflow diário do GitHub
Actions, amplia bastante a superfície de quebra e obrigaria os testes dessa
fonte a rodar num modo diferente do das outras.

O custo é concreto e vale saber: **o Shotgun ficou de fora por causa desta
decisão**, e não por falta de conteúdo. Ele tem Joinville como área de
primeira classe e 20 eventos só em Florianópolis — a melhor cobertura
regional entre as fontes pesquisadas. O bloqueio dele é o Vercel Security
Checkpoint, que devolve 429 pra qualquer cliente HTTP: verificamos que não
adianta replicar o header set completo do Chrome nem reaproveitar cookie, o
fingerprint é de TLS. Ou browser, ou nada.

Como sem o Shotgun sobra essencialmente uma fonte de volume (Sympla), esta
decisão deve ser reaberta assim que as outras estiverem coletando e der pra
medir o ganho real. O stub fica em `packages/scrapers/src/sources/`, fora do
array `sources`.
