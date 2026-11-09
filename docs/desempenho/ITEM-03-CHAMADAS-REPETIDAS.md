# Item 03 — Chamadas repetidas da casca

Trilha de desempenho (kit de 31 passos), pedido do RT em 08/11/2026. Auditoria em `docs/desempenho/AUDITORIA.md` (PR da branch `docs/desempenho-auditoria`).

## Diagnóstico

A medição com login na homologação (auditoria, seção 1.3) achou a casca repetindo leituras em toda recarga, em todas as telas:

| Leitura | Vezes | Por quê |
|---|---|---|
| `perfis` | 3 | `getSession` e os eventos `INITIAL_SESSION` e `SIGNED_IN` do Supabase chegam quase juntos, e cada um chamava `loadPerfil` (`src/contexts/AuthContext.tsx`) |
| `meu_plantao_agora` | 2 a 3 | Cinco lugares chamam com chaves de cache próprias: `AppShell.tsx`, `casca/FaixaDoPapel.tsx`, `plantonista/central/CartaoTurno.tsx`, `hooks/useChat.ts`, `hooks/useFaixaPlantonista.ts` |
| `turno_atual` | 2 | `hooks/useFaixaPlantonista.ts` e `hooks/usePlantao.ts` |
| `setores_na_escala_agora` | 2 | `CartaoTurno.tsx`, `useFaixaPlantonista.ts` e mais seis telas (triagem 2×, enfermagem, fila do PS, recepção, escala, episódios anteriores) |
| `contexto_sem_conexao` | 2 | `hooks/useFilaOffline.ts` e `lib/offline/sincronizar.ts`, uma logo depois da outra |

## Correção (só frontend, sem migration)

- `src/lib/chamadaCompartilhada.ts`: junta as chamadas que chegam ao mesmo tempo e devolve o último resultado bom por alguns segundos. Resposta com erro e exceção nunca ficam guardadas. `limparCompartilhadas()` esquece tudo, e a resposta de uma chamada em curso antes da limpeza não volta a ser guardada (troca de pessoa no aparelho).
- `src/lib/rpcCasca.ts`: `meuPlantaoAgora()`, `turnoAtual()` e `setoresNaEscalaAgora()`, com validade de 15 s. Os intervalos de atualização das telas (30 s e 60 s) continuam valendo.
- `src/lib/offline/relogio.ts`: uma sincronização do relógio feita há menos de 10 s vale para quem pedir de novo.
- `src/contexts/AuthContext.tsx`: o perfil é lido uma vez por pessoa. Lê de novo quando a pessoa muda, em `USER_UPDATED`, ou quando a última leitura veio do perfil guardado na aba (sem rede). Sair (`SIGNED_OUT` ou `encerrarLocal`) zera a carga e limpa as leituras compartilhadas.

## Teste

`src/lib/chamadaCompartilhada.test.ts` (9 casos), escrito antes da correção. Falhou sem o módulo e passa com ele:

- duas leituras ao mesmo tempo viram uma chamada;
- dentro da validade não chama de novo; passada a validade, chama;
- erro e exceção não ficam guardados;
- `limparCompartilhadas` esquece todas; resposta antiga não volta depois da limpeza;
- perfil: mesma pessoa carregada ou em carga não lê de novo; pessoa nova, primeira vez e `USER_UPDATED` leem.

Também passaram: `npm run lint`, `npm run typecheck`, `npm run build`, `node --test scripts/padrao-frontend.test.mjs` e os 453 testes de `src/lib/*.test.ts` e `src/lib/offline/*.test.ts`.

## Medição antes e depois (homologação, médico, 08/11/2026)

Mesma conta (`medico.upa.f5`), mesmo Chrome do RT, recarga completa de cada tela, Performance API depois de 8 s, sem limitar a rede. Antes: master `c4f2cb41`. Depois: homolog `0d1a0f19` (homolog anterior `ee5db1e9` + os 17 arquivos deste item).

| Tela | Chamadas antes | Chamadas depois | Repetidas antes | Repetidas depois | Dados prontos antes | Dados prontos depois |
|---|---|---|---|---|---|---|
| `/plantonista` | 33 | **27** | 4 leituras | nenhuma | 2.113 ms | 952 ms |
| `/plantao` | 30 | **23** | 4 leituras | nenhuma | 2.433 ms | 1.587 ms |
| `/atendimento` | 30 | **26** | 3 leituras | `episodios` 2× (da tela) | 2.378 ms | 2.736 ms |
| `/plantao/observacao` | 25 | **20** | 2 leituras | nenhuma | 2.457 ms | 1.259 ms |
| `/plantao/internacao/pacientes` | 28 | **24** | 2 leituras | nenhuma | 2.439 ms | 1.372 ms |
| `/regulacao` | 26 | **22** | 2 leituras | nenhuma | 2.471 ms | 1.646 ms |
| `/agenda` | 28 | **23** | 3 leituras | `escala_da_unidade` 2× (da tela) | 2.514 ms | 1.290 ms |

Resultado: **4 a 7 chamadas a menos por recarga (15 a 23%)**, e nenhuma repetição da casca. "Dados prontos" varia de uma recarga para outra na rede do RT (a 2ª medição de `/agenda` antes da correção deu 1.446 ms); a contagem de chamadas é a medida firme.

Ficam de fora deste item, porque são da própria tela e não da casca: `episodios` 2× em `/atendimento` e `escala_da_unidade` 2× em `/agenda`.

**LCP sem mudança:** ficou em cerca de 2,4 s em todas as telas, antes e depois, mesmo com os dados prontos em 1,3 s. O elemento do LCP em `/agenda` é o subtítulo da página (texto, sem animação nem transparência). A aba medida estava no Chrome do RT possivelmente em segundo plano, o que atrasa a pintura. Precisa de medição com a aba à frente antes de concluir; fica anotado, sem correção neste item.

## Como reverter

Reverter o commit deste item. Não há banco nem configuração envolvidos.
