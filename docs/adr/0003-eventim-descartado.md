# Eventim descartado

O Eventim tem um endpoint JSON que devolve exatamente o que queremos
(`public-api.eventim.com/websearch/search/api/exploration/v2/productGroups`,
sem API key, Joinville é `city_ids=1840`), e ainda assim não vamos usá-lo.
Três motivos independentes, cada um suficiente sozinho:

1. **O `robots.txt` proíbe.** `public-api.eventim.com/robots.txt` libera
   `/websearch/` para o Googlebot e é `Disallow: /` para todo o resto —
   exatamente o path que chamaríamos. O `www.eventim.com.br` também tem
   `Disallow: /api/`.
2. **Akamai bloqueia cliente não-browser.** `curl` morre no TLS; a chamada
   direta à API devolve 403 da edge. Só passa mandando User-Agent de
   Googlebot, que é justamente a evasão que o item 1 torna indefensável —
   ainda mais num repo público.
3. **Não tem inventário.** `totalResults: 1` para Joinville, e o sitemap de
   eventos (640 URLs) não tem nenhuma entrada de Joinville.

Ou seja: seria evasão de bot e violação explícita de robots.txt em troca de
um evento. O stub fica no repo com um comentário apontando para cá, para
que a pesquisa não seja refeita do zero daqui a seis meses.
