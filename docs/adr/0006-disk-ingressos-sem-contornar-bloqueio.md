# Disk Ingressos: coletamos a busca da home e não contornamos bloqueio

O site da Disk Ingressos é AngularJS sem SSR, e a listagem vem de
`POST www.diskingressos.com.br/home/_search`, uma passagem direta de
Elasticsearch, same-origin, que o próprio navegador chama com o corpo que
usamos (`finalsale >= now`, ordenado por `data`). Coletamos esse endpoint com
`fetch` puro e o User-Agent do Compasso, na linha do ADR-0002. Ele devolve o
país inteiro de uma vez (238 eventos em 2026-10-02, 146 em Curitiba e
Florianópolis), então a Cidade Coberta é resolvida localmente.

O que sustenta a escolha, e o que vigiar:

1. **Não há `robots.txt`.** A URL devolve a página inicial da SPA, não um
   arquivo de regras, então nada proíbe o path.
2. **A fila Queue-Fair não barrou a API.** A página inicial carrega o
   adaptador da fila, mas a chamada direta à busca respondeu normalmente.

Se isso mudar (HTTP 403 ou 429, ou a fila respondendo HTML no lugar do JSON),
a Fonte falha com uma mensagem que aponta para este ADR, e **não
contornamos**: nada de trocar User-Agent, simular a fila ou reaproveitar
cookie. O mesmo critério do ADR-0003 vale aqui: bloqueio explícito é motivo
para parar, não para evadir. Quando acontecer, o motivo do descarte entra
neste arquivo.

Uma entrada de grupo (`uid` terminando em `-G`, evento com várias datas) é uma
Oferta como qualquer outra. A identidade continua sendo (Fonte, id do evento
dentro da Fonte), e o id dentro da Fonte é o `uid`: o `id` numérico dos grupos
é sempre 0 e os ids de evento e de grupo são sequências separadas (o 3416 é um
evento e um grupo diferentes). O feed não lista as datas de um grupo, só a
primeira, então um grupo vira uma Oferta que começa nela e termina quando as
vendas fecham.
