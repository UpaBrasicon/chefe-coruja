# Revisão do HCFMUSP, lote 6, Q2: cap. 16 (perda transitória da consciência)

Em 14/11/2026 o RT decidiu Q1 a Q4 = A e liberou a produção do lote 6 inteiro. Pela Q2, o cap. 16 segue três passos: ler a diretriz, pôr a lista na ficha e fazer a nota.

## Fonte

- **EUSEM 2024:** Möckel et al., Eur J Emerg Med 2024;31(4):250–259 (PMID 38874507; PMC11198953). Lido no texto integral do PMC; conferi no texto cada trecho usado.
- **Limite:** é um consenso de processo (Delphi), montado sobre a ESC 2018, sem graduação das recomendações. Os autores dizem que o fluxo não é uma diretriz detalhada de conduta. A estratificação de risco remete aos critérios da ESC 2018, que o consenso não reproduz.
- **ESC 2018:** é anterior ao manual (2022) e não foi lida de novo.
- **Manual:** cap. 16 conferido no PDF, p. 237–241.

## O que mudou na Central

- **Ficha `adulto-sincope-san-francisco`, versão 2026-11-14.1:**
  - nova lista `DIRETRIZ_SINCOPE_2024`, com 6 temas e o manual ao lado;
  - na tela da regra de San Francisco, um bloco novo: "EUSEM 2024 — ao lado do manual";
  - o cálculo da regra não mudou.
- **Nota `nota-hcfmusp-cap16-sincope`:** 6 itens. Cada item traz "consenso de processo, sem graduação".
- **Migration:** `20270414000037`.

## Onde o consenso difere do manual

| Tema | EUSEM 2024 | Manual |
|---|---|---|
| ECG | interpretar em até 10 minutos; só o ECG normal é de baixo risco | ECG em todos, com a lista de achados a pesquisar |
| Exames | mínimo glicemia e hemoglobina; troponina e D-dímero conforme a suspeita | conforme a etiologia suspeita |
| Estratificação | categorias da ESC 2018, sem escores | regra de San Francisco (Tabela 3) |
| Risco intermediário | sem alta direta; investigar e monitorizar | não usa a categoria; sem condição preocupante, pode ter alta |

## Ajuste feito na homologação

Na primeira versão, "síncope sem causa definida: posso dar alta?" respondia "não deve ter alta direta". A resposta confundia causa indefinida com o risco intermediário da ESC.

- O tema passou a ser "Risco intermediário pelos critérios da ESC 2018".
- A coluna do manual diz que o manual não usa essa categoria.
- Depois do ajuste, a resposta diz que a alta depende da estratificação de risco, com o manual ao lado.
- Nenhuma frase que não seja do consenso ficou atribuída a ele.

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| exames na síncope | ECG e monitorização (manual e artigo aberto) | EUSEM 2024: glicemia e hemoglobina; troponina e D-dímero conforme a suspeita |
| alta sem causa definida | manual: pode ter alta sem condição preocupante | depende do risco: EUSEM 2024 com o manual ao lado |
| tempo do ECG | "possibilidade" de 10 minutos | EUSEM 2024: até 10 minutos do registro |
| risco intermediário | "o material não traz" | EUSEM 2024: sem alta direta, com o manual ao lado |
| TC de crânio de rotina | manual: sem benefício | igual |
| regra de San Francisco (controle) | ficha | igual |

## Homologação

- A migration foi aplicada, e as duas fichas estão aguardando aprovação.
- A ficha foi ingerida em 2 trechos e a nota em 7. A API foi reiniciada.
- Os testes passam, e o typecheck e o lint estão limpos.

## Produção do #716, 14/11/2026

- A migration `20270414000037` foi aplicada antes do merge. O #716 foi mesclado com o CI verde.
- Foram ingeridos 2 arquivos, e a API foi reiniciada. O Vercel publicou o master.
- As seis respostas saíram como na homologação; a alta da síncope sem causa definida depende da estratificação de risco.
