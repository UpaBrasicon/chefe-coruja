# Item 24: só as colunas usadas

Trilha de desempenho (kit de 31 passos), pedido do RT em 08/11/2026. Auditoria em `docs/desempenho/AUDITORIA.md`.

## Diagnóstico

A auditoria achou 13 leituras com `select('*')`. O resto do app lê por RPC.

## Correção (só frontend, sem migration)

| Onde | Tabela | Colunas antes | Colunas depois |
|---|---|---|---|
| `src/components/documentos/identificacao.ts` (identificação dos documentos impressos) | `pacientes` | 39 | 19 (as de `LinhaPaciente`) |
| `src/components/documentos/SeletorPaciente.tsx` (editar cadastro) | `pacientes` | 39 | 19 (os campos do formulário, `CADASTRO_VAZIO`) |
| `src/lib/observacao.ts` (série de sinais vitais) | `observacao` | 21 | 7 |
| `src/hooks/useDocumentos.ts` (internação ativa) | `internacoes` | 24 | 5 |
| `src/pages/farmacia/Diluicoes.tsx` | `diluicao` | 38 | 30 (as do tipo `Diluicao`) |
| `src/components/termo/termo.ts` (modelos de termo) | `termos_modelos` | 15 | 11 |
| `src/components/internacao/LeitoAberto.tsx` (pendências do leito) | `pendencias` | 16 | 10 |
| `src/hooks/useBanners.ts` (lido em toda tela) | `banners` | 10 | 6 |
| `src/pages/gestor/Banners.tsx` | `banners` | 10 | 6 |
| `src/components/internacao/caderno/Trilha.tsx` (checklist de admissão) | `checklist_admissao` | 10 | 4 |
| `src/hooks/useDadosUnidade.ts` (censo) | `vw_censo_unidade` | 9 | 9, por nome (não muda o tamanho; trava se a visão crescer) |

`useDocumentos` (lista de documentos do paciente com o conteúdo inteiro) não tinha nenhum uso e saiu.

Exceção, de propósito: o perfil de quem entrou (`src/contexts/AuthContext.tsx`) continua com `select('*')`. É uma linha só por sessão, e o tipo `Perfis['Row']` circula pelo app inteiro e pelo perfil guardado para o modo sem conexão. Trocar ali traz pouco ganho e risco alto.

Além do ganho de tamanho, a tela deixa de receber dados de paciente que não mostra (no cadastro, por exemplo, bairro, CEP e situação de rua não vão à tela de documentos).

## Teste

- `src/lib/semSelectEstrela.test.ts`: falha no master (acha os `select('*')`) e passa com a correção. Impede `select('*')` novo, menos a exceção do perfil, que o teste também confere.
- Cada lista de colunas foi conferida contra `src/types/database.ts`: todas as colunas existem (coluna errada só daria erro 400 na hora da tela).
- Onde o resultado não passa por `as Tipo`, o próprio `tsc` confere as colunas usadas (termos, banners do gestor, série de sinais); foi assim que `ModeloTermoLinha` virou um `Pick` das 11 colunas.
- `npm run lint`, `npm run typecheck`, `npm run build`, 455 testes de `src/lib`, 1162 clínicos e 10 de observação passaram.

## Homologação (08/11/2026)

Publicado na homolog `4dcd5c7f` (homolog anterior `0d1a0f19` + os 12 arquivos deste item). Conferido no Chrome do RT, conta do médico: `/plantonista` e `/plantao/internacao/pacientes` sem nenhuma chamada com erro (nada ≥ 400); a leitura de banners respondeu 200.

Tamanho antes e depois: não deu para medir com os dados da homologação. Não havia internado aberto (pendências e sinais vitais não carregam) nem banner cadastrado. O ganho está na tabela acima, em colunas por leitura; o tamanho real aparece com dado de verdade.

Não conferido na tela: gestor (banners e termos), farmácia (diluição) e documentos impressos, porque pedem outras contas ou um internado aberto.

## Como reverter

Reverter o commit deste item. Não há banco nem configuração envolvidos.
