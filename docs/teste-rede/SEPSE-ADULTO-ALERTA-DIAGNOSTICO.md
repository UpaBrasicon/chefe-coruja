# Alerta de sepse do adulto para o gestor (B P2-1): diagnóstico

**Origem:** teste de ponta a ponta da rede, bloco B, achado P2-1 (`docs/teste-rede/EXECUCAO-B01-B06.md:54`). `alertas_sepse` só vale para menores de 14 anos, então o adulto séptico não aparece para o gestor. O item ficou "parado até o RT indicar a fonte do critério" (`docs/teste-rede/README.md:100`).

O RT pediu em 11/11/2026 que a fila andasse no que não depende do Vercel. Este documento é só diagnóstico, sem código.

## Como é hoje

- **Criança:** `public.alertas_sepse(p_unidade)` (`20270209000002`) percorre os internados e observados abaixo de 14 anos.
  - Usa `private.gatilho_infeccao` (suspeita de infecção marcada pelo médico ou CID de infecção no atendimento ou na internação).
  - Calcula o Phoenix com os dados registrados e devolve o nível: rastreio, sepse ou choque.
  - O gestor vê a lista no painel de internação (`src/pages/InternacaoPainel.tsx:115`).
- **Adulto:** não há alerta.
  - A ferramenta "Sepse no adulto" (`src/clinico/escores/sepseAdulto.ts`) segue Sepsis-3, SSC 2026 e ILAS 2026. Ela diz que o rastreio é pelo NEWS2, porque a SSC 2026 recomenda NEWS, NEWS2, MEWS ou SIRS em vez do qSOFA como ferramenta única (recomendação forte, certeza moderada; rec. 4, p. 15).
  - **O NEWS2 do adulto já é calculado no servidor:** `public.acuidade(paciente)` (`20260928000002`), com os sinais vitais registrados e a escala 1 do RCP 2017. É a acuidade do prontuário, com os mesmos cortes da ferramenta: 5 a 6 média, 7 ou mais alta.

## Opções para o critério do adulto

- **A. Gatilho de infecção mais NEWS2 de 5 ou mais (recomendada).**
  - É o mesmo gatilho da criança. O NEWS2 vem de `acuidade()`, com os sinais vitais das últimas 24 h.
  - Níveis: "rastreio" com NEWS2 de 5 a 6 e "alto" com 7 ou mais.
  - Fontes já lidas e citadas no app: SSC 2026 (rastreio por NEWS2) e RCP 2017 (cortes).
  - Não depende de sinais vitais automáticos: usa os que a enfermagem já registra. Os rótulos e a conduta do NEWS2 (H14) continuam parados como você decidiu; o alerta mostra só o número e a faixa.
- **B. Gatilho de infecção mais SIRS (2 ou mais critérios).** A SSC também aceita SIRS. Mas um dos critérios é a contagem de leucócitos, que só entra quando há hemograma registrado. Não conferi com que frequência esse valor existe para o paciente da porta.
- **C. Esperar os sinais vitais automáticos,** junto com o H14.

## O que muda no código (opção A)

- **Migration de expansão:** `alertas_sepse` passa a incluir o adulto (14 anos ou mais), com o gatilho de infecção e o NEWS2 da `acuidade()`. A saída é a mesma (paciente, nível, total); o adulto traz os níveis "rastreio" e "alto". O caminho da criança não muda.
- **Tela:** no painel de internação, a lista mostra o adulto com o rótulo "NEWS2" no lugar de "Phoenix".
- **Testes:** teste de banco (adulto com infecção e NEWS2 7 entra; sem infecção, ou com NEWS2 4, não entra; a criança continua pelo Phoenix) e homologação antes.

## Decisão do RT

| Pergunta | Recomendação | Decisão |
|---|---|---|
| Critério do alerta de sepse do adulto | A | |
