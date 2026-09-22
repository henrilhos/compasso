# Enriquecer descrições de Ofertas uma vez por URL

Depois de salvar as listagens da Coleta diária, o Compasso consulta páginas de
Ofertas sem Descrição da Oferta para obter texto específico do evento. Uma
descrição não vazia da listagem, inclusive um resumo, dispensa essa consulta.
Registramos o resultado por URL: uma página lida com sucesso, mesmo sem
descrição, não é consultada novamente; falhas temporárias podem ser tentadas
em Coletas futuras. Uma URL nova pode ser consultada mesmo quando a Oferta
guarda uma descrição obtida da URL anterior.

Parâmetros conhecidos de rastreamento não mudam a identidade da URL, enquanto
parâmetros que identificam uma página de evento são preservados. Ofertas que
compartilham a mesma página podem reaproveitar o texto e o resultado da
consulta quando a página descreve ambas.

Essa escolha troca atualização automática de páginas já lidas por menos
requisições às Fontes e uma Coleta previsível. O enriquecimento tem limite de
100 páginas por execução e intervalo mínimo de um segundo entre requisições à
mesma Fonte; ambos os valores são configuráveis. A falha de uma página não
interrompe as demais Ofertas. Texto atual fornecido pela Fonte tem preferência
sobre texto extraído da página. Quando uma listagem deixa de trazer descrição,
preservamos o último texto útil. Uma descrição antiga extraída só é substituída
se a URL nova fornecer outra descrição útil.

Buscamos texto específico do evento em dados estruturados ou na seção de
descrição da página, com resumo de metadados específico do evento como
alternativa. Texto geral da página não conta. Respostas 404/410 encerram
tentativas para aquela URL imediatamente; bloqueios de acesso encerram após
duas Coletas, enquanto timeouts e respostas 5xx podem ser tentados em
execuções futuras. A descrição extraída é guardada como texto legível, com
quebras de parágrafo. Se uma Fonte proíbe a consulta
às páginas de evento ou bloqueia consistentemente o coletor, registramos as
URLs como inacessíveis e não tentamos contornar o bloqueio. O julgamento
cultural por IA não faz parte desta decisão.
