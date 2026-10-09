# Porca Works

Um jogo simples de indústria feito com React, TypeScript e Vite. A primeira
linha de montagem produz porcas manualmente e reúne a produção, o estoque, o
preço e a demanda da linha. O caixa é acompanhado no resumo da fábrica.

## Como jogar

- Na linha de montagem de porcas, clique em **Produzir porca** para adicionar
  uma unidade ao estoque da linha.
- Contrate trabalhadores pelo botão na seção de produção. Cada trabalhador
  custa R$ 100,00 inicialmente e produz uma porca por segundo. O preço de cada
  nova contratação aumenta 15%.
- Há duas trilhas independentes de missões, ambas progredindo com o total de
  porcas produzidas:
  - **Trabalhadores**: as habilidades aumentam a produção de cada trabalhador.
    A primeira, **Trabalhador Eficiente**, exige 1.500 porcas e R$ 150,00, e dá
    +15% de produção.
  - **Demanda**: as habilidades aumentam diretamente o percentual de demanda da
    linha, mesmo sem alterar o preço. A primeira exige 1.500 porcas e R$ 300,00,
    e adiciona 50 pontos percentuais. Cada nova habilidade adiciona mais 50
    pontos percentuais cumulativos.
- Cada trilha gera missões únicas em sequência, com nomes e recompensas
  diferentes. É preciso cumprir a meta de produção e pagar o custo exibido
  para desbloquear cada habilidade. Requisitos, custos e bônus aumentam por
  nível; os bônus desbloqueados são cumulativos.
- As duas próximas missões aparecem em um painel retrátil no lado direito da
  tela, com progresso e opção de desbloqueio. Recolha o painel pela seta para
  deixar apenas uma pequena seta na borda direita.
- Ajuste o preço da linha entre R$ 0,01 e R$ 100,00 em incrementos de um
  centavo, usando o campo ou os botões de ajuste. Cada porca começa custando
  R$ 0,10.
- O total de porcas produzidas mostra também a taxa automática por segundo.
  Lotes grandes são representados por porcas animadas com a quantidade de cada
  lote.
- Eventos aleatórios de empresas surgem sem aviso antecipado: o primeiro após
  45–90 segundos, e os seguintes após intervalos de 60–120 segundos. O evento
  aparece como um aviso colorido na parte inferior da tela; clique antes que a
  barra de prazo desapareça para aceitar a recompensa. Os eventos podem
  conceder dinheiro imediato, aumentar temporariamente a demanda em pontos
  percentuais ou adicionar/multiplicar a produção por segundo. Dinheiro é
  escalado pelo patrimônio da fábrica (caixa, estoque e investimentos em
  trabalhadores/melhorias); bônus de demanda também crescem com o patrimônio.
  Efeitos temporários aceitos aparecem na lista compacta do canto superior
  esquerdo com indicador de duração, enquanto dinheiro é creditado diretamente
  no caixa.
- A demanda é exibida como percentual e varia continuamente com o preço: a
  R$ 0,01 é 500%, a R$ 0,10 é 100% e a R$ 0,30 é 5%. Não há um teto fixo para a
  demanda-base da   linha. Bônus de habilidades e de eventos são somados separadamente à
  demanda definida pelo preço (por exemplo, 500% + 50% = 550%). O percentual
  total também determina a velocidade das vendas: 100% equivale a 60 porcas por
  minuto.
- Clientes compram do estoque da linha conforme a demanda estimada para o preço
  escolhido. Preços mais altos reduzem a demanda.
- O caixa aumenta conforme as porcas são vendidas.
- O progresso é salvo automaticamente no armazenamento local do navegador.
  Use **Salvar / carregar** para ver o save em JSON, copiá-lo como texto,
  exportá-lo como arquivo `.json` ou carregar um save colado/selecionado. Saves
  incluem caixa, preço, produção, estoque, melhorias, progresso fracionário e
  bônus temporários ainda ativos; bônus expirados não são restaurados.

Na primeira versão, a produção manual continua disponível junto com a
automática dos trabalhadores. Ainda não há outros custos de fabricação.

## Requisitos

- Node.js 20.19+ ou 22.12+
- npm

## Executar localmente

```sh
npm install
npm run dev
```

O Vite mostra no terminal o endereço local para abrir no navegador.

## Verificar e gerar a versão de produção

```sh
npm run lint
npm run build
npm run preview
```

## Estrutura

- `src/App.tsx`: interface e lógica da partida.
- `src/App.css`: estilos do jogo.
- `src/index.css`: estilos globais e variáveis de tema.
