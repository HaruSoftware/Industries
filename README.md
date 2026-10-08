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
  - **Demanda**: as habilidades aumentam diretamente a demanda da linha, mesmo
    sem alterar o preço. A primeira exige 1.500 porcas e R$ 300,00, e adiciona
    12 clientes por minuto.
- Cada trilha gera missões únicas em sequência, com nomes e recompensas
  diferentes. É preciso cumprir a meta de produção e pagar o custo exibido
  para desbloquear cada habilidade. Requisitos, custos e bônus aumentam por
  nível; os bônus desbloqueados são cumulativos.
- Ajuste o preço da linha entre R$ 0,01 e R$ 100,00 em incrementos de um
  centavo, usando o campo ou os botões de ajuste.
- Clientes compram do estoque da linha conforme a demanda estimada para o preço
  escolhido. Preços mais altos reduzem a demanda.
- O caixa aumenta conforme as porcas são vendidas.

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
