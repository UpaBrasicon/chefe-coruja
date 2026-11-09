# Item 08 — Consultas N+1

Trilha de desempenho (kit de 31 passos), pedido do RT em 08/11/2026. Auditoria em `docs/desempenho/AUDITORIA.md`, seção 3.1.

## Diagnóstico

| Tela | Antes | Por quê |
|---|---|---|
| Painel de observação | 2 chamadas por paciente | cada cartão (`CartaoObservacao.tsx`) pedia `alergias_do_paciente` (selo) e `acuidade` |
| Checagem da enfermagem | 1 chamada por paciente | `AlergiaNaTela` em cada cartão pedia `alergias_do_paciente` |
| Receita (receituário e favoritos da porta) | 1 chamada por remédio | `useTravas` pedia `alergia_trava_medicamento` para cada remédio da receita e dos favoritos; incluir um item refazia todas |
| Série de sinais vitais (evolução clínica) | 3 chamadas por sinal escolhido | `getSerieObservacao` abria o prontuário, lia as observações e o conceito, para cada sinal |

Ficaram de fora, por serem pequenos ou raros (auditoria, 3.1): reordenar setores e banners (tela do gestor, 5 a 30 itens), marcar todos os avisos como lidos (2 a 4), anexos da regulação (um envio por arquivo de qualquer jeito).

## Correção

**Banco** — migration `20270320000001_lotes_alergia_acuidade_trava.sql`, só cria funções (expand):

- `alergias_dos_pacientes(uuid[])`, `acuidade_dos_pacientes(uuid[])`: para cada paciente, chamam a função de um paciente que já existe. As regras de acesso e a resposta são as mesmas, por construção. O paciente que daria erro (sem acesso, não encontrado) volta como `{"erro": "..."}` no lugar dele, sem derrubar o lote. Segundo fator vencido derruba a chamada inteira, como antes.
- `alergia_trava_medicamentos(uuid, uuid[])`: chama `alergia_trava_medicamento` para cada remédio. Quem não pode atuar no paciente não recebe nada, como antes.
- Máximo de 200 itens por chamada. `REVOKE` de `PUBLIC` e `anon`; `GRANT` a `authenticated`.

**Tela:**

- `src/lib/loteador.ts`: junta os pedidos feitos no mesmo instante numa chamada só. Erro de um item rejeita só aquele; falha da chamada inteira (rede, segundo fator) rejeita todos com o mesmo erro.
- `useAlergias` passa pelo lote: o painel de observação, a checagem e qualquer outra lista com selo de alergia fazem uma chamada para todos os pacientes, sem mudar os componentes.
- A acuidade do cartão de observação passa pelo lote.
- `useTravas`: uma chamada para todos os remédios.
- `getSeriesObservacao`: abre o prontuário uma vez e lê observações e conceitos com `.in()`; 3 chamadas no total.

## Testes

- `src/lib/loteador.test.ts` (7 casos), escrito antes: falhou sem o módulo e passa com ele.
- `supabase/tests/desempenho_08_lotes.sql`: para cada paciente e remédio, o lote devolve exatamente o que a função de um item devolve; repetido e nulo não duplicam; paciente inexistente volta com o erro sem derrubar os outros; fora do plantão nada é lido (alergia e acuidade voltam "Acesso negado", trava não revela a alergia); `anon` não executa. Depende do `seed.sql` (roda no CI); na homologação o setor do seed não existe.
- Na homologação, numa transação desfeita, como gestor da UPA Fase 5: para os 34 pacientes da unidade, o lote foi igual à leitura de um paciente em alergias e acuidade (0 diferenças).
- `npm run lint`, `npm run typecheck`, `npm run build`, 462 testes de `src/lib`, 1162 clínicos, 10 de observação e a guarda de migrations destrutivas passaram.

## Homologação (09/11/2026)

- Migration aplicada pelo SQL, versão `20270320000001` registrada; as três funções com `anon` sem execução e `authenticated` com.
- Rollback testado numa transação desfeita: os três `DROP FUNCTION` tiram as funções em lote e `alergias_do_paciente` fica intacta.
- Frontend na homolog `0fbefeb0` (homolog anterior `4dcd5c7f` + os 11 arquivos deste item).

**Medição no banco (homologação, 09/11/2026):** transação desfeita, como gestor da UPA Fase 5 (JWT simulado), 34 pacientes, três rodadas:

| Leitura | 34 chamadas de um paciente | 1 chamada em lote |
|---|---|---|
| Alergias | 23,5 a 24,3 ms | 24,7 a 25,3 ms (4.983 bytes) |
| Acuidade | 43,2 a 45,4 ms | 42,6 a 43,3 ms |

O tempo no servidor é o mesmo, como esperado: o lote chama a mesma função para cada paciente. O ganho está na rede: um painel com 34 pacientes passa de 68 chamadas HTTP (2 por cartão) para 2. Na medição com login de 08/11, cada chamada ao banco levou de 50 a 100 ms do navegador da homologação, e o navegador limita as chamadas simultâneas; em 4G cada uma custa mais.

A conta, pelo código: painel com N pacientes passa de 2N chamadas para 2; checagem de N pacientes, de N para 1; receita com M remédios, de M para 1; série com K sinais, de 3K para 3.

**Medição na tela logada:** pendente para quando o RT voltar ao computador (em 09/11 ele está só pelo celular, e o Chrome está desconectado). O item 30 (métricas de usuários reais) passa a medir as telas logadas.

## Produção

Migration `20270320000001` ainda **sem "ok produção"**. Ordem: aplicar a migration na produção, depois mesclar o PR (o merge publica a tela, que já chama as funções novas).

## Como reverter

```sql
DROP FUNCTION IF EXISTS public.alergias_dos_pacientes(uuid[]);
DROP FUNCTION IF EXISTS public.acuidade_dos_pacientes(uuid[]);
DROP FUNCTION IF EXISTS public.alergia_trava_medicamentos(uuid, uuid[]);
```

Antes, reverter o commit da tela, que chama essas funções.
