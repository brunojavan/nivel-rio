# Nível Rio: plano de desenvolvimento (versão 2)

Escrito em 7 de novembro de 2026. Substitui o projeto de 2023, que fica só como referência no GitHub.

## Objetivo

Consultar as fontes a cada 5 minutos e guardar o nível dos rios Itajaí-Açu e Itajaí-Mirim e a situação das três barragens da bacia, incluindo quais comportas estão abertas. Guardar tudo num histórico próprio, mostrar num site aberto ao público e mandar alertas quando o rio mudar de faixa ou subir rápido.

O histórico é o centro do projeto, porque as fontes oficiais guardam pouco:

| Fonte | Quanto histórico ela mostra |
|---|---|
| Defesa Civil de Itajaí | 12 horas |
| AlertaBlu (Blumenau) | 24 horas |
| Defesa Civil de SC | 90 dias, numa janela que anda (a consulta que começa antes disso é recusada) |

Para comparar uma cheia com a anterior, ou medir quanto tempo a água leva de Rio do Sul até Itajaí, alguém precisa ter guardado os dados. Esse alguém vai ser o projeto.

## O que a pesquisa encontrou (7 nov 2026)

Todas as fontes abaixo foram testadas com requisições reais a partir de um computador no Brasil.

### Fontes que vamos usar

| # | Fonte | O que cobre | Formato | Atualiza | Histórico | Papel |
|---|---|---|---|---|---|---|
| 1 | Defesa Civil SC, Rede Integrada de Monitoramento (`monitoramento.defesacivil.sc.gov.br/graphql`) | As 3 barragens (nível, % de ocupação, volume, vertedouro e o estado de cada comporta) e cerca de 13 estações de rio na bacia: Rio do Sul, Taió, Ituporanga, José Boiteux, Ibirama, Apiúna, Indaial, Timbó, Ilhota, Brusque, Botuverá e Guabiruba. Também tem chuva. | JSON (GraphQL, sem login) | 1 min ao vivo; 10 min no histórico | últimos 90 dias, em passos de 10 min ou de 1 h | principal |
| 2 | Defesa Civil de Itajaí (`monitoramento.defesacivil.itajai.sc.gov.br/data/current/app.json`) | As 11 estações da cidade (DC01 a DC11), chuva e cotas de cada estação. Também copia Rio do Sul, Brusque, Blumenau e as barragens, mas essas cópias não serão usadas (ver "Frequência de coleta"). | JSON estático, sem login | 10 min | 12 h | principal para Itajaí |
| 3 | AlertaBlu, Blumenau (`defesacivil.blumenau.sc.gov.br/static/data/`) | Ponte Adolfo Konder e as cotas oficiais de Blumenau. Também copia cerca de 27 estações do Estado. | JSON estático | 5 min / 1 h | 24 h | reserva |
| 4 | Asthon, a empresa que atende Rio do Sul (`public.asthon.com.br`) | 24 estações em Rio do Sul, com consulta de histórico por período | JSON | 10 min | desde set 2026 | complemento |
| 5 | CEMADEN (`resources.cemaden.gov.br/graficos/interativo/getJson2.php?uf=SC`) | Cerca de 164 pluviômetros nos municípios da bacia. Não mede o rio principal. | JSON | 10 min | só o momento | fase 5 |
| 6 | Epagri/CIRAM, tábua de maré de Itajaí | Previsão de maré alta e baixa para 30 dias | HTML | diária | — | fase 5 |

As fontes 1 e 2 já cobrem quase tudo o que o projeto de 2023 tinha, e ainda acrescentam as barragens com o estado de cada comporta.

### Fontes descartadas

- **CEOPS/FURB**: fora do ar. Segundo o noticiário, a FURB encerrou o centro e o monitoramento passou para o AlertaBlu.
- **ANA, serviço SOAP**: lista as estações, mas não devolve dados de nenhuma.
- **ANA, HidroWebService**: funciona, mas exige cadastro pedido por e-mail (hidro@ana.gov.br). Fica para a fase 5, por causa das séries históricas longas.
- **Site da Defesa Civil de Brusque**: as estações municipais estão paradas. Dom Joaquim e Guarani não mandam leitura desde julho de 2025. O nível de Brusque vem da estação do Estado (DCSC-00019).
- **Epagri "Rios On-Line"**: desativado, com saída do ar marcada para janeiro de 2027. O próprio site manda o usuário para a plataforma do Estado.
- **Marinha (tábua de marés)**: responde 403 a qualquer acesso automático.

### Cuidados que os dados exigem

- **As cotas mudaram desde 2023.** A estação ICMBio/CEPSUL tinha atenção, alerta e emergência em 0,90 / 1,10 / 1,30 m. Hoje são 1,21 / 1,61 / 1,75 m. O coletor precisa ler as cotas da fonte a cada coleta e guardar a data de cada mudança.
- **As fontes discordam entre si.** Rio do Sul aparece com três conjuntos de cotas: 5 / 6 / 7 m na cópia de Itajaí, 4,5 / 5,5 / 6,5 m na Asthon e 3 / 6 / 8 m no projeto antigo. Antes de abrir o site ao público, temos que confirmar qual é a oficial.
- **Sensor quebrado manda o valor 21474836.** Hoje isso acontece em Gaspar e Lontras. Esses valores precisam ser descartados.
- **Estações marcadas "(H)" medem por altitude**, então o número delas não é comparável com o de uma régua comum.
- **A Barragem Norte (José Boiteux) é lida à mão**, mais ou menos duas vezes por dia.
- **O relógio do servidor de Blumenau anda 24 minutos atrasado.** O horário da leitura tem que vir do próprio dado, nunca do servidor.
- **O certificado de segurança do site de Blumenau está incompleto.** Navegadores aceitam, mas programas costumam recusar. Vamos precisar contornar isso ou usar a cópia de Blumenau que vem no arquivo de Itajaí.
- **O Estado só aceita a consulta exata que o próprio site dele faz.** Se eles mudarem essa consulta, a nossa para de funcionar até ser ajustada. O aviso de falha da fase 2 cobre esse caso. As duas consultas (`Tags_data` e `Historic`) estão copiadas em `src/consultas/`.
- **O histórico do Estado não tem as comportas.** Ele guarda nível, chuva e cota das barragens, mas não o estado de cada comporta. A única forma de ter esse histórico é gravar o resumo ao vivo a cada 5 minutos, que é o que o passo zero já faz. (Visto em 7 nov 2026.)
- **O Estado só libera os últimos 90 dias de histórico.** Uma consulta que começa antes disso volta com "Operação bloqueada" (medido em 7 nov 2026: 10 ago passava, 9 ago não). Não há dado mais antigo a recuperar depois que o dia sai da janela.
- **CPU no plano grátis.** Comprimir uma resposta custa de 6 a 16 ms no servidor da Cloudflare, acima dos 10 ms do plano. Até agora nenhuma execução foi interrompida, mas é o primeiro ponto a olhar se uma coleta parar.
- **Linhas lidas no plano grátis.** O D1 grátis permite 5 milhões de linhas lidas e 100 mil gravadas por dia, somando todos os bancos da conta. Em 7 nov à noite o passo zero varria a fila inteira do histórico a cada minuto (150 mil linhas lidas por hora) e teria estourado o limite no dia seguinte; um índice resolveu. Toda consulta nova precisa ler poucas linhas. A página `/api/status` mostra as coletas das últimas 24 horas.
- **Apiúna manda o nível com outro nome no histórico** (`rio_nivel_arbitrario` em vez de `rio_nivel`). O parser aceita os dois.
- **Algumas estações devolvem o histórico vazio para 7 dias e cheio para poucas horas** (Arraial dos Cunhas, 7 nov 2026). O tapa-buraco tenta de novo com uma janela curta.
- **O histórico do Estado devolve o horário de Brasília sem indicar o fuso.** Uma consulta de 1º set 0h UTC volta com o primeiro ponto em "2026-08-31T21:10". O parser da fase 1 precisa somar 3 horas.
- **AlertaBlu: só foi encontrado o nível oficial de hora em hora** (`nivel_oficial.json`, série de 24 h). A leitura de 5 em 5 minutos da Ponte Adolfo Konder não foi localizada na revisão de 7 nov à noite. A fase 2 procura de novo.

### Situação no dia da pesquisa

Há uma cheia em andamento. Às 16h de 7 de novembro:

| Local | Nível | Faixa |
|---|---|---|
| Rio do Sul | 8,38 m | emergência |
| Blumenau | 7,30 m | alerta |
| Brusque | 4,75 m | atenção |
| Itajaí-Mirim, propriedade privada (DC05) | 2,51 m | alerta |
| Ribeirão Canhanduba (DC08) | 2,68 m | alerta |

As barragens de Taió e Ituporanga estavam com todas as comportas fechadas, segurando água. A de Ituporanga estava com 90% de ocupação.

## Frequência de coleta

Medido em 7 de novembro de 2026, entre 16h40 e 17h30. As fontes foram consultadas a cada 1 ou 2 minutos e comparadas com as séries que elas mesmas publicam.

| Fonte | Intervalo entre medições | Tempo até aparecer na fonte | Guarda série? |
|---|---|---|---|
| Estado: estações de rio e barragens Sul e Oeste | 1 min ao vivo; o histórico guarda uma a cada 10 min | menos de 1 min | o ao vivo mostra só a última; o histórico guarda 90 dias |
| Estado: Barragem Norte | duas vezes por dia, às 7h e às 17h (leitura manual) | na hora | sim |
| Itajaí: 11 estações da cidade | 10 min | 2,5 a 6 min em 7 nov; 10 a 14 min em 8 nov, de madrugada (o site só avisa "sem leitura nova" depois de 32 min) | 12 h |
| AlertaBlu: Ponte Adolfo Konder (leitura bruta) | 5 min | 3 a 6 min | não, só a última |
| AlertaBlu: nível oficial de Blumenau | 1 h | cerca de 10 min | 24 h |
| Asthon: Rio do Sul | 10 min | 1 a 4 min | sim |

### Decisão: consultar a cada 5 minutos

O coletor roda em xx:02, xx:07, xx:12 e assim por diante.

- **Blumenau mede a cada 5 minutos e só mostra a última leitura.** Com coleta a cada 10, metade das leituras de Blumenau se perderia.
- **Os sensores do Estado mandam leitura nova a cada minuto**, mas o histórico do Estado só guarda uma a cada 10. Com coleta a cada 5, o nosso histórico fica com o dobro de detalhe do oficial. Isso conta numa subida rápida. No dia da medição, Brusque subiu de 5,00 m para 5,32 m entre 16h40 e 17h26, cerca de 40 cm por hora.
- **Itajaí mede a cada 10 minutos e publica uma série de 12 horas**, então nada se perde. Os 5 minutos só fazem o dado chegar mais cedo ao site.
- **O deslocamento de 2 minutos** dá tempo de cada fonte publicar o que acabou de medir.
- **Coletar a cada 1 minuto** multiplicaria por 5 a carga sobre os servidores públicos, sem mudar nenhuma decisão de quem acompanha uma cheia.

Do Estado, o coletor lê o resumo ao vivo (uma consulta só, com todas as estações) e usa o horário que cada estação informa como horário da medição. Uma vez por hora, ele consulta o histórico de cada estação para preencher eventuais buracos.

### Como evitar a falsa estabilidade

1. **Cada leitura é gravada uma única vez**, pelo horário em que foi medida, e não pelo horário da coleta. Se a mesma leitura aparecer em 6 coletas seguidas, o banco guarda 1.
2. **Cada estação mostra no site o horário da sua última medição.** Se passar o dobro do intervalo esperado sem leitura nova (20 minutos, para quem mede a cada 10), aparece o aviso "sem leitura nova há X min".
3. **Subindo, descendo ou estável sai da comparação com a leitura de 1 hora antes** (e de 3 horas antes), nunca com a coleta anterior. Uma estação que mede de hora em hora é comparada com a leitura da hora anterior, e não consigo mesma.
4. **Os gráficos só marcam ponto onde houve medição.**
5. **As cópias que Itajaí faz de Rio do Sul, Brusque e Blumenau ficam de fora.** Na cópia de Rio do Sul, 62 dos 72 pontos de 5 minutos são a média dos vizinhos, e o horário está deslocado em 5 minutos em relação ao original do Estado. É o problema inverso: leituras que não existiram.
6. **O próprio sensor pode repetir valor.** A estação DC02 (Praça Celso Pereira da Silva) marcou o mesmo número 22 vezes seguidas, 3 horas e 40 minutos, enquanto as vizinhas mudavam. Quando uma estação fica mais de 3 horas no mesmo valor e as vizinhas se mexem, o site mostra "possível sensor travado" para alguém conferir. O valor não é descartado automaticamente, porque às vezes o rio está mesmo parado: abaixo das barragens fechadas, José Boiteux e Ituporanga ficaram 6 horas no mesmo nível.

## Arquitetura

```
 Fontes: Estado (GraphQL), Itajaí (app.json), AlertaBlu, Asthon...
                  │  a cada 5 min (Cron Trigger)
                  ▼
 Coletor (Cloudflare Worker) ── lê, confere, padroniza
                  │                       └─► banco de brutos (D1): guarda a resposta bruta quando o parser falha
                  ▼
 Banco D1 (SQLite na Cloudflare): estações, cotas, leituras, barragens, comportas, log de coletas
                  │
                  ▼
 API (Worker) ──► Site público (arquivos estáticos no mesmo Worker, em niveldorio.net)
                  │
                  └─► Alertas: canal público no Telegram + avisos de falha para você

 GitHub: guarda o código e as versões. Cada push na branch main publica a versão nova.
```

### Por que Cloudflare

Tudo roda na nuvem, sem servidor para manter e sem depender do seu computador ligado. O plano gratuito atende com folga:

| Recurso gratuito | Limite | Uso previsto |
|---|---|---|
| Execuções agendadas (Cron Triggers) | 5 por conta | 2 ou 3 (uma por fonte) |
| Banco D1 | 500 MB por banco, 5 GB e 10 bancos por conta, 100 mil linhas gravadas por dia | cerca de 6.200 leituras novas por dia; horário guardado como número para caber uns 3 anos em 500 MB |
| Requisições ao Worker | 100 mil por dia | ver o risco abaixo |
| Arquivos do site | sem limite | todo o HTML, CSS e JS |

**Por que não o GitHub Actions:** o agendamento de lá atrasa ou pula execuções nos horários de pico, e cada coleta viraria um commit (144 por dia). Você pediu o GitHub só para guardar versões, e é isso que ele vai fazer.

**Dois limites para acompanhar:**

- **CPU de 10 ms por execução.** A resposta do Estado tem cerca de 490 KB. Ler esse JSON cabe nesse tempo, mas por segurança cada fonte roda numa execução separada.
- **100 mil requisições por dia.** Numa cheia com muita gente acompanhando, a API pode passar disso. Para economizar, o site busca um único JSON a cada 5 minutos e só enquanto a aba estiver aberta. Se mesmo assim estourar, o plano pago da Cloudflare custa US$ 5 por mês e sobe o limite para 10 milhões por mês.

**Endereço:** https://niveldorio.net, desde 11 nov 2026. O domínio foi registrado na Locaweb (vence em 11 nov 2027, renovar por lá) e usa os nameservers da Cloudflare (`oswald` e `rihana`), na mesma conta do Worker. Na Cloudflare, niveldorio.net e www.niveldorio.net estão ligados ao Worker como domínios próprios (Workers & Pages → nivel-rio → Domains), e uma regra de redirecionamento (Rules → Redirect Rules) manda o www para o endereço sem www. O endereço antigo, https://nivel-rio.nivel-rio.workers.dev, continua no ar.

**Por que não o R2 para as respostas brutas:** o R2 tem 10 GB grátis, mas a Cloudflare exige um cartão cadastrado para ativá-lo. As respostas brutas ficam num segundo banco D1 (`nivel-rio-brutos`), comprimidas em gzip.

### Ferramentas

- **TypeScript** em tudo: coletor, API e site.
- **Wrangler**, a ferramenta oficial da Cloudflare para publicar.
- **Vitest** para testes. Cada fonte terá amostras reais salvas no repositório, e o teste confirma que o parser continua entendendo a amostra.
- **Site em HTML, CSS e JavaScript puros, com gráficos em uPlot.** O uPlot é uma biblioteca de gráficos de série temporal com cerca de 50 KB, que abre rápido no celular; fica copiado em `public/vendor/`. O plano original previa Vite + TypeScript; para pôr a primeira versão no ar em um dia, o site ficou sem etapa de build. Dá para migrar depois se o código crescer.

## Modelo de dados

| Tabela | Conteúdo |
|---|---|
| `fontes` | Cada fonte: nome, endereço, ativa ou não, último sucesso, último erro |
| `estacoes` | Id próprio, nome, rio, município, coordenadas, ordem rio abaixo, fonte principal, fonte reserva, código em cada fonte |
| `cotas` | Atenção, alerta e emergência de cada estação, com a data a partir da qual valem e de onde vieram |
| `leituras` | Estação, horário da medição (UTC), nível em metros, fonte. Uma leitura por estação e horário, sem duplicar |
| `leituras_barragem` | Nível a montante e a jusante, % de ocupação, volume, vertedouro |
| `comportas` | Barragem, comporta, aberta ou fechada, horário. Grava só quando o estado muda |
| `leituras_chuva` | Acumulados por estação (entra na fase 5) |
| `coletas` | Log de cada execução: fonte, início, duração, quantas leituras, erro |

Regras de gravação:

- Horário sempre em UTC. O fuso de Brasília só entra na hora de mostrar.
- Valores impossíveis (21474836, negativos, picos de mais de 1 m que voltam em até 30 minutos) são descartados e anotados no log; os picos ficam guardados na tabela `descartes`.
- Quando a mesma estação vem de duas fontes, vale a principal. A reserva só preenche os buracos.

## Fases

### Passo zero: coletor provisório na nuvem (no ar desde 7 nov 2026)

**Situação:** ligado junto com a fase 0. O Worker roda a cada minuto e guarda, comprimido, no banco `nivel-rio-brutos`:

| O quê | Quando | Tamanho comprimido |
|---|---|---|
| Resumo ao vivo do Estado (todas as estações de SC, barragens e comportas) | xx:02, xx:07, … | cerca de 38 KB por coleta, 11 MB por dia |
| `app.json` de Itajaí (série de 12 h) | xx:04 e xx:34 | cerca de 21 KB, 1 MB por dia |
| Nível oficial do AlertaBlu (série de 24 h) | xx:14 e xx:44 | menos de 1 KB |
| Histórico do Estado desde 1º ago 2026, em janelas de 7 dias, para as estações da bacia do Itajaí e as 3 barragens | nos outros minutos, 1 janela por vez, até acabar (cerca de 20 horas, terminando em 8 nov à tarde) | cerca de 25 MB no total |

Com cerca de 12 MB por dia, o banco de brutos chega ao limite de 500 MB em uns 40 dias. **A fase 1 precisa importar esses dados e desligar o provisório antes disso** (por volta de 15 de dezembro de 2026). A página inicial mostra o espaço usado.

O texto original deste passo:

O arquivo de Itajaí mostra só as últimas 12 horas. A cada leitura nova, a mais antiga sai. Então o nosso histórico só começa no dia em que o coletor liga, e o que passou antes disso não volta.

Para não perder mais dias enquanto as fases 0 e 1 não ficam prontas, dá para subir na Cloudflare, logo depois de a conta ser criada, um coletor provisório. Ele só guarda as respostas brutas do Estado, de Itajaí e do AlertaBlu a cada 5 minutos, sem interpretar nada, e baixa uma vez o histórico do Estado desde 1º de setembro. Quando o coletor da fase 1 entrar no ar, esses arquivos são importados para o banco e o provisório é desligado.

Nada roda no seu computador, nem neste passo nem nos outros.

### Fase 0: fundação (concluída em 7 nov 2026)

O que você faz:
- Criar uma conta gratuita na Cloudflare. Eu não posso criar contas por você.
- Decidir o repositório (ver "Decisões pendentes").

O que eu faço:
- Repositório novo com a estrutura do projeto, Wrangler, banco D1 criado e publicação automática pelo GitHub a cada push.
- Catálogo de estações num arquivo do próprio repositório, com id, nome, rio, cidade, ordem rio abaixo, coordenadas e fonte principal.

Pronto quando um push no GitHub publica uma página de teste no endereço workers.dev e o banco existe.

**Situação em 7 nov 2026:** repositório `brunojavan/nivel-rio` (público) criado, Worker publicado, os dois bancos D1 criados com as tabelas, catálogo com 45 estações em `catalogo/estacoes.json` (21 com algum ponto marcado para conferir) e 9 testes passando. Publicação automática ligada (Workers Builds, comando `npm run deploy`, que aplica as migrações e publica): o push de teste das 18h49 de Brasília publicou sozinho em 20 segundos. **Fase 0 concluída em 7 nov 2026.** O app da Cloudflare no GitHub tem acesso só ao repositório nivel-rio.

### Fase 1: coletor das duas fontes principais (no ar desde 7 nov 2026)

- Um parser para o Estado e um para Itajaí, cada um testado com amostras reais salvas.
- Execução a cada 5 minutos (xx:02, xx:07…), gravando cada leitura pelo horário da medição, sem duplicar, e registrando cada coleta no log.
- Do Estado: o resumo ao vivo a cada 5 minutos e, uma vez por hora, o histórico para tapar buracos.
- Importação do histórico do Estado desde 1º de setembro e dos arquivos do passo zero.
- O histórico do Estado só alcança os últimos 90 dias. O passo zero está baixando tudo o que existia em 7 nov 2026 (desde 9 ago), então a urgência agora é outra: importar os brutos antes de o banco provisório encher (por volta de 15 dez).

Pronto quando o coletor rodar 72 horas sozinho sem nenhum buraco maior que 20 minutos nas estações ativas.

**Situação em 7 nov 2026, 19h de Brasília:** no ar. A primeira coleta do Estado (19h07) gravou 29 níveis, as 3 barragens e 15 comportas. O que roda em cada minuto:

| Minuto | Tarefa |
|---|---|
| xx:02, xx:07… | Resumo ao vivo do Estado: estações, barragens e comportas |
| xx:03, xx:08… | Monta o resumo que o site lê (`/api/agora`) e confere se o catálogo mudou |
| xx:04, xx:09… | Itajaí (série de 12 h) |
| xx:00, xx:05… | Tapa-buraco: histórico do Estado, 3 estações por vez, cada uma perto de uma vez por hora. Na primeira passada, cada estação busca 7 dias, para o site abrir com uma semana de gráfico |
| xx:16 e xx:46 | AlertaBlu (Blumenau mede de hora em hora e publica uns 10 minutos depois) |
| demais xx:01, xx:06… | Termina o download do histórico do passo zero (fila do Estado, até 10 nov); depois importa tudo para o banco definitivo |

Uma tarefa por minuto por causa da CPU. Na primeira versão, a coleta do Estado montava o resumo do site na mesma execução e gastava 24 a 36 ms, contra 10 ms do plano grátis. A Cloudflare não interrompeu nenhuma, mas não dá para contar com essa tolerância. Depois da separação (medido em 7 nov, 22h27 a 22h48 UTC, todas as execuções concluídas): Estado 9 a 20 ms, AlertaBlu 3 ms, resumo do site 5 a 8 ms, Itajaí 7 a 14 ms, download do passo zero 6 a 13 ms, tapa-buraco 9 a 18 ms (o valor maior é da primeira passada, quando cada estação busca 7 dias). Parte das execuções ainda passa um pouco dos 10 ms, a mesma faixa em que o passo zero rodou sem interrupção desde 7 nov. Se a Cloudflare começar a interromper, a página `/saude` mostra a fonte atrasada; as saídas são ler só as estações do catálogo na resposta do Estado (economiza perto de 2 ms) ou o plano pago de US$ 5 por mês, que dá 30 segundos de CPU por execução.

Decisões tomadas na implementação:

- **O AlertaBlu entrou já na fase 1**, para Blumenau não ficar sem dado no site. O certificado incompleto não atrapalha quando a consulta parte da Cloudflare. As cotas de Blumenau vêm da própria resposta (atenção 4 m, alerta 6 m, alerta máximo 8 m).
- **A resposta bruta só é guardada quando algo dá errado** (a fonte falha ou o parser não entende). Com isso o banco de brutos parou de crescer 12 MB por dia; o risco de enchê-lo em dezembro acabou.
- **Ponto do histórico só entra onde não há leitura a menos de 5 minutos.** A série ao vivo (de 5 em 5 minutos) e a do histórico (de 10 em 10) não se misturam; o histórico só preenche buraco.
- **Descartes:** o valor 21474836, níveis negativos (menos em Itajaí, onde a maré pode levar o nível abaixo de zero) e leituras que o próprio Estado marca como inválidas. Cada coleta conta os descartes no log. Os picos de sensor entraram na fase 2 (veja lá).
- **Cotas:** o Estado não publica cotas no resumo ao vivo. Para Rio do Sul e Brusque o site usa as cotas que a Defesa Civil de Itajaí publica para essas estações, com a origem indicada. As de Rio do Sul aparecem marcadas "a confirmar".
- **Importação com limite diário:** no máximo 50 mil linhas gravadas por dia, para a coleta normal (perto de 12 mil por dia) nunca ficar sem espaço no limite de 100 mil. O histórico de 9 ago a 31 out deve terminar de entrar por volta de 18 nov.
- **O catálogo é copiado para o banco sozinho**: quando `catalogo/estacoes.json` muda, a execução seguinte atualiza a tabela `estacoes`.

### Fase 2: mais fontes e saúde do coletor

- Asthon para Rio do Sul (o AlertaBlu já entrou na fase 1). Taió, Gaspar e Ituporanga entram só se acrescentarem algo que o Estado não tenha.
- Tabela de cotas com vigência e a regra de fonte principal e reserva funcionando.
- Detecção de dado atrasado e de sensor quebrado.
- Página `/saude` com a situação de cada fonte, e mensagem no seu Telegram quando uma fonte ficar mais de 1 hora sem responder.

Pronto quando, ao desligar uma fonte de propósito, o aviso chegar em menos de 1 hora.

**Adiantado em 7 nov 2026:** a tabela de cotas com vigência já funciona (cada mudança de cota ganha uma linha nova com a data). O site já avisa "sem leitura nova" quando passa do dobro do intervalo normal e mostra "possível sensor travado" quando a estação repete o mesmo valor agora, 1 h e 3 h antes, enquanto outra do mesmo rio mudou 5 cm ou mais. A situação de cada fonte aparece em "Sobre os dados", e a página `/saude` mostra cada fonte nas últimas 24 horas, os erros recentes, o andamento do histórico do passo zero e o espaço usado.

**Picos de sensor (8 nov 2026).** Nos 7 dias já gravados apareceram leituras isoladas muito fora da série: Rio do Sul caiu 1,19 m numa leitura e voltou na seguinte (5 nov), Ascurra caiu 2,26 m (4 nov), Ilhota teve quedas de até 6 m durante meia hora (1 nov). A regra adotada: uma leitura que se afasta mais de 1 m da anterior é apagada só se o nível voltar para perto do de antes em até 30 minutos. Nenhum rio da bacia faz esse vaivém de 1 m em meia hora; uma cheia de verdade sobe e não volta, e por isso nunca é apagada. Com 1 m, a oscilação normal de Benedito Novo (até 84 cm em 10 minutos, e volta) fica. Consequências:

- a leitura mais recente, que ainda não tem a seguinte, aparece no site até a próxima coleta decidir (no máximo 5 minutos no ar);
- Blumenau, que mede de hora em hora, nunca entra na conferência;
- a primeira leitura depois de um buraco de mais de 30 minutos não tem com o que comparar e fica (caso de Ilhota, 1 nov, 14h30 UTC, 4,69 m);
- cada pico apagado vai para a tabela `descartes`, aparece na página `/saude` e não volta a entrar pela série de Itajaí, pelo histórico do Estado nem pela importação do passo zero;
- os 13 picos que já estavam no banco saíram pela migração `0005_picos_ate_7nov.sql` (9 deles de Lontras, que está desligada como sensor com defeito);
- a conferência custa uma consulta a mais depois de cada gravação, que só devolve linhas quando alguma estação variou mais de 1 m no trecho. CPU medida depois de ligar (8 nov, 00h04 a 00h14 UTC, todas as execuções concluídas): Estado 10 a 12 ms, Itajaí 7 a 13 ms, tapa-buraco 5 a 11 ms, na mesma faixa de antes.

**Fonte reserva (8 nov 2026): hoje nenhuma estação tem reserva que sirva.** O código do Estado que o catálogo ligava a Blumenau (DCSC-00026) é uma estação meteorológica: manda chuva, vento e temperatura, não o nível do rio. As cópias de Rio do Sul, Brusque e Blumenau no arquivo de Itajaí são, na maior parte, médias de estações vizinhas, e não servem como leitura. A única reserva de verdade seria a Asthon para Rio do Sul, que continua sem endereço conhecido. A regra (a reserva só preenche buraco da principal) fica para quando a Asthon entrar.

Falta: Asthon (e com ela a fonte reserva) e o aviso no Telegram (este depende de você criar um bot no Telegram e me passar o token como segredo da Cloudflare).

### Fase 3: site público

API:
- `/api/agora`: tudo o que a tela inicial precisa num único JSON.
- `/api/estacoes/{id}?de=…&ate=…`: série histórica de uma estação.
- `/api/barragens`: barragens e comportas.

Telas:
- Visão da bacia de cima para baixo: barragens, Rio do Sul, Blumenau, Brusque e Itajaí. Cada estação mostra o nível, a faixa, a tendência e há quanto tempo foi lida.
- Página de cada estação com gráfico de 24 h, 7 dias e 30 dias, com as cotas desenhadas.
- Barragens com o estado de cada comporta e a ocupação ao longo do tempo.
- Aviso visível quando o dado está atrasado.
- Página "Sobre os dados" com as fontes e um aviso de que o site não substitui a Defesa Civil, com os canais oficiais (telefone 199 e alertas por SMS no 40199).

O site é pensado primeiro para o celular, que é onde o pessoal olha durante uma cheia.

Pronto quando a tela inicial abrir em menos de 2 segundos num 4G e mostrar dados com menos de 15 minutos.

**Primeira versão antecipada para 8 nov 2026**, a seu pedido, junto com a fase 1. Já tem:

- tela inicial com as barragens (ocupação, nível e cada comporta) e as estações agrupadas de cima para baixo: Alto Vale, Itajaí-Açu, Itajaí-Mirim e afluentes. Por padrão mostra as estações principais; uma opção mostra todas;
- em cada estação: nível, faixa (quando a fonte publica cotas), tendência em cm por hora comparada com 1 hora antes, e há quanto tempo foi medida, com o aviso "sem leitura nova" quando passa do dobro do intervalo normal;
- faixa de aviso no topo com as estações em alerta ou emergência, e outra quando os dados param de atualizar;
- gráfico de 24 h, 3 dias e 7 dias ao tocar na estação, com as cotas desenhadas e buraco onde não houve medição;
- "Sobre os dados" no fim da página e o aviso da Defesa Civil (199 e SMS 40199) no topo.

**Site novo (8 nov 2026), a seu pedido: visual, com mapa.**

- **Mapa logo no topo** (MapLibre, fundo gratuito do OpenFreeMap, sem chave): os rios da bacia destacados (traçado do OpenStreetMap, 27 KB) e um ponto por estação com o nível e a cidade. A cor do ponto é a faixa (verde, amarelo, laranja, vermelho); azul quando a fonte não publica cota; cinza quando parou de mandar. Barragens com a % de ocupação. Passar o mouse mostra nível, tendência, faixa e o gráfico de 24 h; clicar abre a página da estação. No celular, o toque abre o balão com o link. Botão "Chuva 24 h" mostra a chuva nos pluviômetros. Por cima do mapa, a contagem de estações em cada faixa e quantas sobem e descem.
- **Abaixo do mapa, os níveis por cidade** (cartões em ordem alfabética, com gráfico de 24 h e as cotas), com a opção "por região do rio" (Alto Vale, Itajaí-Açu, Itajaí-Mirim, afluentes), que mostra também quanto cada estação subiu ou desceu em 24 h.
- **Barragens** com anel de ocupação, comportas e gráfico de 24 h; **chuva das últimas 24 h** na bacia; **avisos** das últimas 24 h.
- **Página de cada estação e barragem** (`/estacao/{id}`): nível grande, tendência, régua com as cotas, projeção, gráfico de 24 h / 3 / 7 / 30 dias com as faixas de cota pintadas, máxima, mínima e variação do período, as outras estações do mesmo rio de cima para baixo, as da mesma cidade, mapa, avisos e os detalhes da fonte. Na barragem, a linha do tempo de cada comporta. O título da página leva o nível atual, que aparece quando o link é compartilhado no WhatsApp.
- A página chega com os dados embutidos (uma ida a menos ao servidor). O mapa (perto de 440 KB comprimidos) só carrega depois que a lista aparece.
- Os gráficos de 24 h de todas as estações saem de uma consulta a cada 30 minutos (xx:13 e xx:43), que lê perto de 11 mil linhas: cerca de 550 mil por dia dos 5 milhões do plano grátis.
- CPU medida em produção depois de publicar (8 nov, 00h55 a 01h15 UTC, todas as execuções concluídas): coleta do Estado com a chuva 14 a 18 ms; gráficos de 24 h 9 ms; página inicial 3 ms e página da estação até 10 ms por visita; /api/agora 0 a 5 ms. O resumo com os avisos chegou a 11 a 18 ms porque os avisos faziam duas idas a mais ao banco; elas foram juntadas às que o resumo já faz.

Peso medido em produção (8 nov, 01h UTC, comprimido): para mostrar os níveis, a página com os dados embutidos (8 KB), o estilo (5 KB) e os scripts (15 KB), perto de 28 KB, o que num 4G comum leva de 0,5 a 0,8 s. O mapa vem depois: biblioteca 445 KB, traçado dos rios 27 KB e o fundo do OpenFreeMap. Num computador com banda larga, o primeiro conteúdo apareceu em 0,38 s.

**Novo visual (11 nov 2026), a seu pedido: menos cara de feito por IA, mais cara de serviço público de verdade.** Feito com a skill Impeccable. A avaliação do site anterior deu 22 de 40; os problemas eram a primeira tela que não respondia "e a minha cidade?", cartões e gráficos de enfeite iguais em tudo, e o mapa disputando a atenção com o resto. Das cinco direções desenhadas, você escolheu **"Marcas da enchente"**: o site como a parede da cidade, com a régua pintada, as marcas das cheias passadas e a água de agora. A avaliação, os esboços e as capturas ficam só no Mac, em `.impeccable/` (a skill não os põe no repositório). No repositório ficam o contrato da direção (`.impeccable/surfaces/public-index-html.md`), o produto (`PRODUCT.md`) e o sistema visual (`DESIGN.md`).

A revisão final da skill rodou três vezes sobre capturas do site com dados reais e com uma cheia simulada (Rio do Sul a 7,30 m, Blumenau a 6,40 m). Tudo o que ela marcou como obrigatório foi corrigido e conferido: o nome da cota nunca fica em cima da linha d'água, as cheias de 1983 e 1984 com o traço na altura certa, o gráfico termina na leitura da placa, o mapa do celular sem nome cortado nem colado em outro ponto. Ficaram para depois, como melhorias e não como defeitos: o tema escuro perde um pouco o reboco, a lista "na ordem do rio" é longa e plana, e as marcas pintadas não têm variação de mão.

- **Primeira tela:** uma frase sobre a bacia inteira ("O rio está normal em todas as estações com cota oficial", ou quem está em atenção ou pior); a situação mais grave fora da sua cidade ocupa o topo quando há alerta ou emergência, e o 199 cresce; depois a sua cidade, escolhida numa lista na primeira visita e guardada no navegador.
- **A parede:** régua em metros, as cotas oficiais pintadas na cor da faixa, as marcas das cheias passadas com fonte e a água de agora subindo até o nível (a única animação do site, desligada para quem pede menos movimento). Ao lado, a placa azul esmaltada com o nível, a tendência em palavras e a distância até a próxima cota.
- **Marcas de cheias só com fonte.** Blumenau: 1880, 1983, 1984, 2008, 2011 e 2023, da tabela da Defesa Civil de Blumenau publicada no Mendeley Data (licença CC BY 4.0). Rio do Sul: novembro e outubro de 2023, da NSC Total com dados da Defesa Civil e da prefeitura. Outras cidades entram quando houver fonte citável.
- **Rio do Sul "cota a confirmar"** em todo lugar onde o estado depende dessas cotas (frase da bacia, parede, placa, lista e mapa), porque as fontes divergem: Itajaí copia 5 / 6 / 7 m, a Asthon usa 4,5 / 5,5 / 6,5 m e reportagens citam emergência acima de 6,5 m e inundação em 9,5 m.
- **Maré:** as 12 estações de Itajaí dizem "sobe e desce com a maré" em vez de "subindo" ou "descendo". A tábua de maré da Epagri/CIRAM continua pendente (pede contato com eles).
- **Mapa:** fundo recolorido para o reboco, rios em destaque, Itajaí agrupado em um ponto de longe; no celular, mapa baixo e largo como a bacia, o toque abre um painel embaixo e os nomes da beira vão para dentro.
- **Página da estação:** a mesma parede, e o gráfico como a parede esticada no tempo (água cheia, cotas pintadas com o nome na ponta, a cota mais próxima abaixo e acima sempre na escala, uma linha de texto em vez de legenda); as cheias passadas com a fonte; as estações do mesmo rio de cima para baixo.
- **Letra Overpass** (licença OFL), servida pelo próprio site; ícones em SVG; tema escuro; contraste de pelo menos 4,5:1 em todo texto.
- **Aviso de subida rápida só para estação de régua.** Em 11 nov um salto de sensor em Rio do Oeste, que mede altitude, virou aviso de "+394 cm"; agora esse tipo de estação fica de fora (teste em `test/alertas.test.ts`).

Falta para fechar a fase 3: o histórico de 30 dias completo (a importação acaba por volta de 18 nov; até lá o gráfico de 30 dias mostra só o que já está no banco), medir num celular com 4G de verdade e o contato com as Defesas Civis antes de divulgar.

### Fase 4: alertas

- Canal público no Telegram com mensagens automáticas quando:
  - uma estação muda de faixa;
  - o rio sobe rápido (o limite exato a definir; 30 cm por hora seria um ponto de partida);
  - uma comporta abre ou fecha;
  - uma fonte sai do ar.
- Uma margem antes de repetir o alerta, para não disparar 20 mensagens quando o nível oscila em cima da cota.

Por que Telegram: é grátis, e num canal público o projeto não precisa guardar a lista de quem assina, o que evita lidar com dados pessoais (LGPD). WhatsApp cobra por mensagem. Notificação no navegador fica para depois.

Pronto quando uma simulação com os dados da cheia de 7 de novembro disparar os alertas certos, sem repetição.

**Situação (8 nov 2026): avisos funcionando no site; falta só o Telegram.** O código (`src/alertas.ts`) roda junto com o resumo, de 5 em 5 minutos, e grava cada aviso na tabela `avisos`. Eles aparecem na tela inicial, na página da estação e na `/saude`. Regras adotadas:

- toda mudança precisa aparecer em duas avaliações seguidas (5 minutos), para um pico de sensor não virar aviso;
- para descer de faixa o nível precisa ficar 10 cm abaixo da cota (margem contra o vaivém em cima da cota);
- subida rápida: 30 cm/h comparado com 1 hora antes; perto da foz (estações de Itajaí), 50 cm/h, porque a maré sozinha chegou a 47 cm/h em 7 nov; no máximo um aviso a cada 3 horas por estação;
- comporta que abre ou fecha; fonte sem responder há mais de 1 hora, e quando volta.

A simulação está em `test/alertas.test.ts`: as leituras reais de 5 a 8 nov (`amostras/2026-11-08/cheia-7nov.json.gz`) avaliadas de 5 em 5 minutos. Resultado: Blumenau atenção → alerta → emergência (8,06 m às 21h de 7 nov), Rio do Sul alerta → emergência, Brusque descendo de alerta para normal em 5 nov e subindo de novo em 7 nov, nenhum aviso repetido, no máximo 8 por estação em três dias. As estações de Itajaí perto da foz trocam entre atenção e normal com a maré: é mudança de faixa de verdade, mas pode ser muito para um canal público; decidir depois de ver no Telegram.

Para ligar o Telegram (depende de você): criar o bot no @BotFather, criar o canal público com o bot como administrador e guardar os segredos `TELEGRAM_TOKEN`, `TELEGRAM_CANAL` e `TELEGRAM_ADMIN` (comandos no README). Sem eles, os avisos ficam só no site.

### Fase 5: análise

- Velocidade de subida e uma projeção simples ("nesse ritmo, atinge a cota de alerta em cerca de 3 horas"), sempre marcada como estimativa.
- Tempo que a água leva de Rio do Sul até Blumenau e até Itajaí, medido no nosso próprio histórico.
- Chuva acumulada na bacia, usando o CEMADEN e o Estado.
- Maré na foz ao lado do nível de Itajaí, pela tábua do CIRAM.
- Comparação com cheias anteriores, depois de pedir acesso ao HidroWebService da ANA.

**Adiantado em 8 nov 2026:**

- **Projeção:** a página da estação mostra "nesse ritmo, chega à cota de X em cerca de N horas" quando o rio sobe pelo menos 2 cm/h e a próxima cota está a menos de 24 h nesse ritmo. Conta simples pela última hora, marcada como estimativa.
- **Chuva:** o resumo ao vivo do Estado já traz a chuva acumulada (1 h, 24 h, 72 h) de 61 pluviômetros da bacia, na mesma resposta que o coletor baixa. O coletor guarda só o retrato atual (um registro a cada 5 minutos, sem histórico, para não gastar o limite de gravações): ficam os marcados como válidos pelo Estado e com leitura das últimas 2 horas (56 na amostra de 7 nov). Aparece no mapa (botão "Chuva 24 h") e num cartão da tela inicial. O CEMADEN fica para depois: o Estado já cobre a bacia.

Falta: tempo de viagem da água (Rio do Sul → Blumenau → Itajaí) medido no nosso histórico, depois que o pico desta cheia passar por Itajaí; maré na foz (o CIRAM/Epagri mostra os marégrafos e a previsão no site, mas sem endereço de dados documentado: precisa perguntar ao CIRAM; a outra saída é a Rede Maregráfica do IBGE, que tem API, se tiver estação em Itajaí); comparação com cheias anteriores (precisa do acesso à ANA, pedido por você).

## Riscos

| Risco | O que fazer |
|---|---|
| Uma fonte muda de formato sem avisar. O portal de Itajaí foi refeito em outubro de 2026. | Parser separado por fonte, testes com amostras, resposta bruta guardada quando falha e aviso no Telegram |
| O Estado bloqueia ou muda a consulta | Plano B pelas cópias: Itajaí copia Rio do Sul, Brusque e Blumenau, e o AlertaBlu copia cerca de 27 estações do Estado. E conversar com a Defesa Civil. |
| Estourar o plano gratuito | Medir o uso desde a fase 1. O plano pago custa US$ 5 por mês. |
| Alguém decidir sair ou ficar em casa com base no site | Aviso claro, idade do dado sempre visível, dado atrasado nunca aparece como atual, links para os canais oficiais |
| Cotas diferentes entre as fontes | Mostrar de onde veio cada cota e confirmar com as Defesas Civis antes de abrir ao público |

## Decisões pendentes

Resolvidas em 7 nov 2026: repositório novo `nivel-rio`, público; conta na Cloudflare criada; passo zero ligado junto com a fase 0. O `nivelrio` de 2023 continua intacto no GitHub (e no GitHub Pages); arquivar fica a seu critério.

1. **Contato com as Defesas Civis.** Recomendo avisar a de Itajaí e a do Estado antes de abrir o site ao público, na fase 3. Isso serve para confirmar as cotas e evitar que eles bloqueiem o acesso.
