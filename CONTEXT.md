# Contexto: Compasso

Glossário do domínio. Só vocabulário — nada de decisão de implementação
(essas vão para `docs/adr/`).

## Fonte

Uma plataforma de venda de ingresso da qual o Compasso coleta dados
(Blumie, Meaple, Pixta, Shotgun, Sympla, Eventbrite, Eventim, Nittio,
Ticketmaster). Cada Fonte tem um identificador estável e curto (`sympla`,
`eventim`, …) que acompanha todo dado dela.

## Oferta

Um evento **tal como publicado numa Fonte**. É a unidade que um scraper
devolve e a unidade que é gravada no banco.

Duas Ofertas podem descrever o mesmo show do mundo real: um festival que
vende no Sympla e no Eventbrite gera duas Ofertas, e hoje isso aparece como
dois cards na agenda. Isso é aceito deliberadamente — ver [[Evento]].

A identidade de uma Oferta é o par (Fonte, id do evento dentro da Fonte).

## Descrição da Oferta

Texto publicado pela Fonte que apresenta uma [[Oferta]], seja na listagem
(inclusive um resumo) ou na página da própria Oferta. Texto vazio não é uma
Descrição da Oferta.

## Evento

O show no mundo real: uma apresentação, num lugar, numa data. Um Evento pode
ter várias [[Oferta]]s, uma por Fonte que o vende.

**O Compasso ainda não representa Evento.** Reconciliar Ofertas em Eventos
exige casar título, data e local de forma aproximada, e essa decisão foi
adiada.

A interface do site fala "eventos" com o público, porque é a palavra que o
visitante usa. Internamente — código, banco, glossário — a palavra é
Oferta.

## Coleta

Uma execução do coletor: percorre todas as [[Fonte]]s, pede a listagem de
cada uma e grava o resultado. Roda uma vez por dia.

Uma Coleta é sempre **completa dentro da [[Janela]]**, nunca incremental:
cada Fonte devolve tudo o que tem na Janela, e o que não aparece numa
Coleta é tratado como tendo sumido da Fonte.

## Janela

O horizonte de tempo que interessa: os próximos 90 dias a partir de hoje.
Evento passado não é coletado nem exibido.

## Município

Um município que o Compasso coleta. É a unidade em que as [[Fonte]]s são
consultadas (cada uma tem seu slug, id ou filtro por município) e a lista
de `packages/db/src/municipalities.ts` é a fonte da verdade sobre quais são.

## Cidade Coberta

Uma listagem da agenda: um [[Município]] principal que absorve os vizinhos
próximos. Joinville inclui Jaraguá do Sul, Florianópolis inclui São José e
Balneário Camboriú inclui Itajaí. `packages/db/src/covered-cities.ts` é
sempre a fonte da verdade sobre as Cidades Cobertas e sobre qual Município
cai em qual.

O critério de entrada é **volume de eventos**, não distância de Joinville.
Por isso Florianópolis está na lista e Araquari, que faz divisa com
Joinville, não está. Um Município entra quando passa a ter oferta que
justifique, e a lista é para ser esticada: ele vira uma Cidade Coberta nova
ou é absorvido por uma vizinha.

Toda [[Oferta]] pertence a exatamente uma Cidade Coberta, e **só ela é
guardada**: uma Oferta de Jaraguá do Sul fica registrada como Joinville. Ver
ADR-0005. As [[Fonte]]s devolvem resultados de fora da lista — os feeds
delas são regionais e imprecisos — e o que não resolve para um Município
coberto é descartado na coleta.

## Novidade

Uma [[Oferta]] que o Compasso viu pela primeira vez nos últimos 3 dias. É
sobre quando o Compasso a **descobriu**, não sobre quando a [[Fonte]] a
publicou.

Por isso, quando uma Fonte ou Cidade Coberta entra pela primeira vez, todas
as Ofertas dela são Novidade de uma vez. Isso é aceito.

Na interface, o visitante vê "Novo".
