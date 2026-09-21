# Uma Oferta por Fonte, sem reconciliação em Evento

Um mesmo show vendido no Sympla e no Eventbrite gera duas [[Oferta]]s e
aparece como dois cards na agenda. Decidimos aceitar isso em vez de
reconciliar Ofertas num Evento único, porque reconciliar exige casar título,
data e local de forma aproximada — matching fuzzy, com falso positivo que
funde shows diferentes e falso negativo que não resolve nada — e isso não
pode ficar no caminho crítico de um scraper.

A identidade de uma Oferta é o par `(fonte, id na fonte)`. Consequência que
não é óbvia olhando o código: a chave primária de `offers` **não** comporta
um evento de vários dias virar uma linha por dia. Por isso um festival de
sexta a domingo é uma Oferta só, com `starts_at` na sexta e `ends_at` no
domingo, e aparece na agenda apenas na sexta. Representar Evento de verdade
é o que destrava tanto a deduplicação entre fontes quanto a agenda por dia.
