# Revisão do HCFMUSP, lote 5, P2: cap. 100, afogamento

O RT decidiu P1 a P4 = A em 14/11/2026 e liberou a produção do lote 5 inteiro, desde que cada capítulo passe antes pela homologação e pelo CI verde.

## Fonte

- **Diretriz:** Davis CA, Schmidt AC, Sempsrott JR, et al. Wilderness Medical Society Clinical Practice Guidelines for the Treatment and Prevention of Drowning: 2024 Update. Wilderness Environ Med 2024;35(1 Suppl):94S–111S (PMID 38379489).
  - Li o texto integral no site da revista, pelo Chrome do RT.
  - O grau segue o sistema do ACCP.
  - Ficaram de fora o resgate na água e a prevenção.
- **ERC 2025, circunstâncias especiais:** já entra na hipotermia (cap. 102), com uma linha de afogamento.
- **Manual:** o lado do manual vem da ficha de Szpilman e do PDF (cap. 100, p. 1338–1348).

## O que mudou na Central

- **Escore `adulto-szpilman` 2026-11-14.1:**
  - fonte `WMS_AFOGAMENTO_2024`;
  - `DIRETRIZ_AFOGAMENTO`: 11 temas;
  - `DIFERENCAS_AFOGAMENTO`: 3 frases;
  - a tela do escore ganha a tabela (via `EscoreTela` com conteúdo extra, como no Duke).
- **Escore e cortes:** os graus de Szpilman e os cortes do manual não mudam.
- **Nota `nota-hcfmusp-cap100-afogamento`:** 11 itens.
- **Migration:** `20270414000031`.

## Diferenças principais

A WMS 2024 e o manual concordam em antibiótico, corticoide, Heimlich, coluna e alta depois de 4–6 h de observação. A WMS acrescenta:
- adiar o desfibrilador nos primeiros minutos para não atrapalhar a ventilação (forte, evidência alta);
- não pedir de rotina radiografia de tórax, TC de crânio, hemograma e eletrólitos.

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| antibiótico empírico | manual: não | WMS (forte, alta): não, com o manual ao lado |
| Heimlich | manual: não | WMS (forte, moderada): não |
| desfibrilador | ventilação primeiro | WMS: DEA depois da ventilação |
| radiografia de rotina | "o material não traz" | WMS: não pedir |
| observação antes da alta | manual: 4–6 h | WMS: 4–6 h, com o grau |
| Szpilman grau III (controle) | manual | igual |

## Homologação

- Migration aplicada.
- 3 arquivos ingeridos e API reiniciada.
- `test:clinico` (1.252, sem falha), typecheck e padrão do frontend limpos.
- A tela não foi vista com login.

## Produção do #707 (cap. 91), 14/11/2026

- O primeiro CI do #707 falhou no padrão do frontend: um `<h2>` solto na tela da dengue. Troquei por `Bloco` e o CI ficou verde.
- A migration `20270414000030` foi aplicada antes do merge. O #707 foi mesclado com o CI verde.
- Os 2 arquivos foram ingeridos e a API foi reiniciada.
- As 6 respostas saíram como na homologação.
- O Vercel publicou o master.

## Produção do #708 e ajuste de prognóstico (14/11/2026)

- O #708 foi para a produção: migration `20270414000031`, merge com CI verde, 3 arquivos ingeridos, API reiniciada, Vercel ok.
- Cinco respostas saíram pela WMS 2024. A pergunta de controle piorou: o grau III de Szpilman perdeu a sobrevida, porque a ficha do escore não traz a sobrevida por grau e a nota nova tirou da busca o trecho do PDF.
- Ajuste (este PR): a lista ganhou a linha "Prognóstico". A WMS diz que o tempo de submersão é o principal preditor e que acima de 30 min o prognóstico é ruim; o lado do manual traz a sobrevida de cada grau de Szpilman. O escore e a nota passam para 2026-11-14.2. Migration `20270414000032`.
- Na homologação, a pergunta do grau III volta a trazer 95–96%, e a da sobrevida por grau traz a tabela inteira.
