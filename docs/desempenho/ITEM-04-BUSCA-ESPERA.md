# Item 04: busca espera a pessoa parar de digitar

Trilha de desempenho (kit de 31 passos), pedido do RT em 08/11/2026. Auditoria em `docs/desempenho/AUDITORIA.md`.

## Diagnóstico

18 buscas consultavam o banco a cada tecla (a partir de 2 ou 3 letras). Digitar "dipirona" fazia 6 consultas em vez de 1. Já esperavam: a terminologia (`useTerminologia`), a alta vigilância, a lista da dispensação e a unidade de consumo (temporizador de 300 ms), e o seletor de paciente dos documentos (busca só ao apertar Enter ou Buscar).

## Correção (só frontend, sem migration)

- `src/hooks/useValorAdiado.ts`: devolve o valor só depois de 300 ms sem mudar.
- Nas 18 buscas, a chave e a consulta usam o valor adiado; o campo continua mostrando o que a pessoa digita na hora:
  - pacientes: Hiperdia, pré-natal, agenda, reserva de leito, mãe do recém-nascido;
  - remédios: prescrição da porta, receita do documento, alergia, diluição, dispensação avulsa;
  - procedimentos e exames: SIGTAP (APAC, BPA, conta, materiais), exames do leito e da unidade, CBO do perfil;
  - lista de atendimentos para faturar (BPA).
- O filtro local da alergia (lista de alérgenos comuns, sem banco) continua instantâneo.

## Teste

`src/lib/buscaComEspera.test.ts`: cada uma das 18 buscas usa um valor de `useValorAdiado` na chave da consulta, e o gancho espera 300 ms e limpa o temporizador. Falha no master e passa aqui.

Também passaram: `npm run lint` (inclui as regras dos ganchos do React), `npm run typecheck`, `npm run build`, 457 testes de `src/lib` e 1162 clínicos.

## Medição

Pela conta: uma busca de N letras fazia até N − 2 consultas; agora faz 1 depois da pausa. Medição na tela pendente (o Chrome do RT está desconectado).

## Como reverter

Reverter o commit deste item. Sem banco nem configuração.
