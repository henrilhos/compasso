# Cidade Coberta agrupa Municípios e o Município não é guardado

A agenda mostra uma listagem por [[Cidade Coberta]], e cada uma absorve os
[[Município]]s vizinhos: Jaraguá do Sul entra em Joinville, São José em
Florianópolis e Itajaí em Balneário Camboriú. Quem procura show em Joinville
quer ver também o de Jaraguá, a 50 km, e três filtros separados para
municípios tão próximos só espalhavam a agenda.

A coleta continua por Município, porque é assim que as [[Fonte]]s são
consultadas. O agrupamento acontece na hora de gravar: `offers.city` guarda
a Cidade Coberta, nunca o Município de origem.

O custo é concreto: **o Município original se perde**. Uma Oferta de Jaraguá
do Sul aparece como Joinville no card, e a migração `0005` reescreveu as
linhas já existentes sem como reconstruí-las. O endereço e o local da Oferta
seguem corretos, e é por eles que o visitante percebe a distância. Se um dia
for preciso filtrar ou exibir o Município, é uma coluna nova mais um
reprocessamento da coleta, não uma consulta ao que já está no banco.

A migração também não reverte sozinha, e URLs antigas com
`?city=Jaraguá do Sul` deixam de filtrar: o valor desconhecido é ignorado e
a agenda mostra todas as cidades.
