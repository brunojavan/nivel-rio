# Nível Rio: plano de desenvolvimento (versão 2)

Escrito em 7 de novembro de 2026. Substitui o projeto de 2023, que fica só como referência no GitHub.

## Objetivo

Consultar as fontes a cada 5 minutos e guardar o nível dos rios Itajaí-Açu e Itajaí-Mirim e a situação das três barragens da bacia, incluindo quais comportas estão abertas. Guardar tudo num histórico próprio, mostrar num site aberto ao público e mandar alertas quando o rio mudar de faixa ou subir rápido.

O histórico é o centro do projeto, porque as fontes oficiais guardam pouco:

| Fonte | Quanto histórico ela mostra |
|---|---|
| Defesa Civil de Itajaí | 12 horas |
| AlertaBlu (Blumenau) | 24 horas |
| Defesa Civil de SC | cerca de 2 a 3 meses |

Para comparar uma cheia com a anterior, ou medir quanto tempo a água leva de Rio do Sul até Itajaí, alguém precisa ter guardado os dados. Esse alguém vai ser o projeto.

## O que a pesquisa encontrou (7 nov 2026)

Todas as fontes abaixo foram testadas com requisições reais a partir de um computador no Brasil.

### Fontes que vamos usar

| # | Fonte | O que cobre | Formato | Atualiza | Histórico | Papel |
|---|---|---|---|---|---|---|
| 1 | Defesa Civil SC, Rede Integrada de Monitoramento (`monitoramento.defesacivil.sc.gov.br/graphql`) | As 3 barragens (nível, % de ocupação, volume, vertedouro e o estado de cada comporta) e cerca de 13 estações de rio na bacia: Rio do Sul, Taió, Ituporanga, José Boiteux, Ibirama, Apiúna, Indaial, Timbó, Ilhota, Brusque, Botuverá e Guabiruba. Também tem chuva. | JSON (GraphQL, sem login) | 1 min ao vivo; 10 min no histórico | desde 1º set 2026, em passos de 10 min ou de 1 h | principal |
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
| Estado: estações de rio e barragens Sul e Oeste | 1 min ao vivo; o histórico guarda uma a cada 10 min | menos de 1 min | o ao vivo mostra só a última; o histórico guarda 2 a 3 meses |
| Estado: Barragem Norte | duas vezes por dia, às 7h e às 17h (leitura manual) | na hora | sim |
| Itajaí: 11 estações da cidade | 10 min | 2,5 a 6 min | 12 h |
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
 API (Worker) ──► Site público (arquivos estáticos no mesmo Worker, endereço workers.dev)
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

**Endereço:** https://nivel-rio.nivel-rio.workers.dev, de graça. O Wrangler registrou o subdomínio da conta como `nivel-rio`, por isso o nome repetido; dá para trocar no painel da Cloudflare (Workers & Pages → Subdomain). Um domínio próprio (.com.br) custa cerca de R$ 40 por ano e é opcional.

**Por que não o R2 para as respostas brutas:** o R2 tem 10 GB grátis, mas a Cloudflare exige um cartão cadastrado para ativá-lo. As respostas brutas ficam num segundo banco D1 (`nivel-rio-brutos`), comprimidas em gzip.

### Ferramentas

- **TypeScript** em tudo: coletor, API e site.
- **Wrangler**, a ferramenta oficial da Cloudflare para publicar.
- **Vitest** para testes. Cada fonte terá amostras reais salvas no repositório, e o teste confirma que o parser continua entendendo a amostra.
- **Site em Vite + TypeScript, com gráficos em uPlot.** É uma biblioteca de gráficos de série temporal com cerca de 50 KB, que abre rápido no celular.

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
- Valores impossíveis (21474836, negativos, saltos de vários metros em 10 minutos) são descartados e anotados no log.
- Quando a mesma estação vem de duas fontes, vale a principal. A reserva só preenche os buracos.

## Fases

### Passo zero: coletor provisório na nuvem (no ar desde 7 nov 2026)

**Situação:** ligado junto com a fase 0. O Worker roda a cada minuto e guarda, comprimido, no banco `nivel-rio-brutos`:

| O quê | Quando | Tamanho comprimido |
|---|---|---|
| Resumo ao vivo do Estado (todas as estações de SC, barragens e comportas) | xx:02, xx:07, … | cerca de 38 KB por coleta, 11 MB por dia |
| `app.json` de Itajaí (série de 12 h) | xx:04 e xx:34 | cerca de 21 KB, 1 MB por dia |
| Nível oficial do AlertaBlu (série de 24 h) | xx:14 e xx:44 | menos de 1 KB |
| Histórico do Estado desde 1º ago 2026, em janelas de 7 dias, para as estações da bacia do Itajaí e as 3 barragens | nos outros minutos, 2 janelas por vez, até acabar (cerca de 10 horas) | cerca de 25 MB no total |

Com cerca de 12 MB por dia, o banco de brutos chega ao limite de 500 MB em uns 40 dias. **A fase 1 precisa importar esses dados e desligar o provisório antes disso** (por volta de 15 de dezembro de 2026). A página inicial mostra o espaço usado.

O texto original deste passo:

O arquivo de Itajaí mostra só as últimas 12 horas. A cada leitura nova, a mais antiga sai. Então o nosso histórico só começa no dia em que o coletor liga, e o que passou antes disso não volta.

Para não perder mais dias enquanto as fases 0 e 1 não ficam prontas, dá para subir na Cloudflare, logo depois de a conta ser criada, um coletor provisório. Ele só guarda as respostas brutas do Estado, de Itajaí e do AlertaBlu a cada 5 minutos, sem interpretar nada, e baixa uma vez o histórico do Estado desde 1º de setembro. Quando o coletor da fase 1 entrar no ar, esses arquivos são importados para o banco e o provisório é desligado.

Nada roda no seu computador, nem neste passo nem nos outros.

### Fase 0: fundação

O que você faz:
- Criar uma conta gratuita na Cloudflare. Eu não posso criar contas por você.
- Decidir o repositório (ver "Decisões pendentes").

O que eu faço:
- Repositório novo com a estrutura do projeto, Wrangler, banco D1 criado e publicação automática pelo GitHub a cada push.
- Catálogo de estações num arquivo do próprio repositório, com id, nome, rio, cidade, ordem rio abaixo, coordenadas e fonte principal.

Pronto quando um push no GitHub publica uma página de teste no endereço workers.dev e o banco existe.

**Situação em 7 nov 2026:** repositório `brunojavan/nivel-rio` (público) criado, Worker publicado, os dois bancos D1 criados com as tabelas, catálogo com 45 estações em `catalogo/estacoes.json` (21 com algum ponto marcado para conferir) e 9 testes passando. Falta ligar a publicação automática pelo GitHub (Workers Builds, no painel da Cloudflare) e confirmar com um push.

### Fase 1: coletor das duas fontes principais

- Um parser para o Estado e um para Itajaí, cada um testado com amostras reais salvas.
- Execução a cada 5 minutos (xx:02, xx:07…), gravando cada leitura pelo horário da medição, sem duplicar, e registrando cada coleta no log.
- Do Estado: o resumo ao vivo a cada 5 minutos e, uma vez por hora, o histórico para tapar buracos.
- Importação do histórico do Estado desde 1º de setembro e dos arquivos do passo zero.
- Isso precisa sair logo. O histórico do Estado cobre só cerca de 2 a 3 meses, então setembro deve deixar de estar disponível por volta de dezembro.

Pronto quando o coletor rodar 72 horas sozinho sem nenhum buraco maior que 20 minutos nas estações ativas.

### Fase 2: mais fontes e saúde do coletor

- AlertaBlu (resolvendo o certificado) e Asthon para Rio do Sul. Taió, Gaspar e Ituporanga entram só se acrescentarem algo que o Estado não tenha.
- Tabela de cotas com vigência e a regra de fonte principal e reserva funcionando.
- Detecção de dado atrasado e de sensor quebrado.
- Página `/saude` com a situação de cada fonte, e mensagem no seu Telegram quando uma fonte ficar mais de 1 hora sem responder.

Pronto quando, ao desligar uma fonte de propósito, o aviso chegar em menos de 1 hora.

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

### Fase 4: alertas

- Canal público no Telegram com mensagens automáticas quando:
  - uma estação muda de faixa;
  - o rio sobe rápido (o limite exato a definir; 30 cm por hora seria um ponto de partida);
  - uma comporta abre ou fecha;
  - uma fonte sai do ar.
- Uma margem antes de repetir o alerta, para não disparar 20 mensagens quando o nível oscila em cima da cota.

Por que Telegram: é grátis, e num canal público o projeto não precisa guardar a lista de quem assina, o que evita lidar com dados pessoais (LGPD). WhatsApp cobra por mensagem. Notificação no navegador fica para depois.

Pronto quando uma simulação com os dados da cheia de 7 de novembro disparar os alertas certos, sem repetição.

### Fase 5: análise

- Velocidade de subida e uma projeção simples ("nesse ritmo, atinge a cota de alerta em cerca de 3 horas"), sempre marcada como estimativa.
- Tempo que a água leva de Rio do Sul até Blumenau e até Itajaí, medido no nosso próprio histórico.
- Chuva acumulada na bacia, usando o CEMADEN e o Estado.
- Maré na foz ao lado do nível de Itajaí, pela tábua do CIRAM.
- Comparação com cheias anteriores, depois de pedir acesso ao HidroWebService da ANA.

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
