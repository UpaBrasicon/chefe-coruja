# Contraste da plataforma: diagnóstico (CT1 a CT4)

Pedido do RT em 17/11/2026 (pedidos de 17/11, nº 4): "não dá para saber onde ficam as coisas", com o print do atendimento na homologação. Retomado pelo RT em 23/11/2026. Lido na master (0b7499f0). Nada foi programado.

## O que a medição mostra

Contraste WCAG 2.2 dos tokens do tema claro (`src/index.css`), calculado pela fórmula da norma:

| Par | Contraste | Mínimo | Situação |
|---|---|---|---|
| Texto principal (`tinta` #1E293B) sobre branco | 14,6:1 | 4,5:1 (1.4.3) | Passa |
| Texto de apoio (`tinta-apoio` #475569) sobre branco | 7,6:1 | 4,5:1 | Passa |
| Texto fraco (`tinta-sussurro` #58677C) sobre branco | 5,8:1 | 4,5:1 | Passa |
| Cor da ação (`acao` #155E75) sobre branco | 7,3:1 | 4,5:1 | Passa |
| **Borda comum (`fio` #E2E8F0) sobre branco** | **1,23:1** | 3:1 (1.4.11) | **Falha** |
| **Borda forte (`fio-forte` #CBD5E1) sobre branco** | **1,48:1** | 3:1 | **Falha** |
| **Fundo da página (`campo` #F8FAFC) × cartão branco** | **1,05:1** | — | Indistinguível |
| **Faixa (`trilha` #F1F5F9) × cartão branco** | **1,10:1** | — | Quase indistinguível |

**O texto não é o problema; os limites é que somem.** O critério 1.4.11 da WCAG pede 3:1 para o limite de um componente quando é ele que mostra onde o componente está. Hoje:

- **Campos de formulário** (`Input`): borda `fio` (1,23:1) e fundo `campo` sobre cartão branco (1,05:1). No print do atendimento, um campo vazio quase não aparece; é o caso mais grave.
- **Cartões e seções**: cartão branco sobre fundo `campo` com borda `fio`. A página parece uma folha só, sem blocos.
- **Menu lateral**: fica recolhido em 68 px só de ícones e abre ao passar o mouse; quem não conhece os ícones não sabe onde está.
- **Abas**: a ativa tem borda e texto na cor da ação, mas as inativas não têm limite visível; numa tela cheia, as abas se confundem com o texto.

No tema escuro, o texto passa folgado e a borda forte (`fio-forte`) já fecha 3:1; a borda comum fica em 1,41:1.

## Referências reais (Refero)

- **Fingerprint, painel** (refero.design/pages/d26c9612-c8a6-45af-bbce-e665cdfef745): fundo da página cinza claro, cartões brancos com borda visível, menu lateral com rótulo em cada item e grupos com título.
- **Navan, painel do administrador** (refero.design/pages/a156afc7-47d9-42a8-9d39-d273f9aa6e76): mesmo padrão, com o título de cada grupo do menu ("Travel", "Configuration") e o item ativo num bloco destacado.
- **Attio, ficha do registro** (refero.design/pages/705e033f-4db2-4c0d-984c-833bf407a43b): tudo branco, com a separação feita por linhas e colunas; é o mais parecido com o Chefe Coruja de hoje, e funciona lá porque a tela é curta e tem poucos campos.

## Decisões

### CT1. Fundo e blocos

**A (recomendo).** Fundo da página cinza (#EEF2F6, contra branco 1,12:1, o mesmo degrau do Fingerprint) e cartões brancos com borda #CBD5E1. Cada bloco da tela (Conduta, SOAP, Sinais vitais, Pré-natal…) vira um cartão que se vê. O texto fraco segue acima de 4,5:1 sobre o fundo novo (5,1:1).

**B.** Manter tudo branco, como o Attio, e separar por linhas mais escuras entre os blocos. Mexe menos, mas resolve menos numa tela longa como a do atendimento.

### CT2. Campos e controles (o mais grave)

**A (recomendo).** Borda de campo, seleção e caixa de marcar em #7B8799 (3,6:1 sobre branco, acima de 3:1), fundo do campo branco, e foco na cor da ação com anel. Vale no tema claro; no escuro, `fio-forte` (já 3,07:1).

**B.** Só escurecer a borda para #94A3B8 (2,6:1): melhora, mas fica abaixo do mínimo da norma.

### CT3. Menu lateral

**A (recomendo).** Menu aberto por padrão no computador, com o rótulo de cada item e os grupos com título (como Navan e Fingerprint); botão para recolher, e a escolha fica guardada. No celular continua como está.

**B.** Manter recolhido em ícones, com o nome do item ativo no topo da página.

### CT4. Abas

**A (recomendo).** Abas com linha de base visível em todas e a ativa com fundo destacado, além da borda e do texto na cor da ação.

**B.** Só a ativa com a borda mais grossa.

## Como fazer, depois das decisões

Por tokens e componentes de base (`src/index.css`, `src/components/ui/*`), sem tela por tela; um PR por item (CT2 primeiro, que é o mais grave), cada um com capturas antes e depois no tema claro e no escuro e com o padrão do frontend no CI. Só frontend.

## Perguntas ao RT

1. CT1 a CT4: A ou B em cada um?
