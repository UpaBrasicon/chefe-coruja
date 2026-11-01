# VD1 — Corte de 14 anos na véspera do aniversário

Lote "Virada de data" do `BACKLOG.md`. Prioridade: **P0 clínico**, por decisão do RT em 01/11/2026 ("Registra, clínicos P0" e "Sim, VD1").

## Diagnóstico

A pediatria da unidade vai até 13 anos, 11 meses e 29 dias. Três RPCs decidiam isso com:

```sql
age(dia, nascimento) < interval '14 years'
```

O Postgres compara intervalos contando o mês como 30 dias. Na véspera dos 14 anos, `age()` empresta os dias do mês do nascimento. Quando esse mês tem 31 dias e o nascimento é do dia 2 em diante, o resultado é `13 years 11 mons 30 days`, que a comparação trata como igual a `14 years`. O `<` dá falso e a criança entra como adulto.

Exemplo: nascido em 31/12/2012, no dia 30/12/2026. Conferido na produção: `age('2026-12-30','2012-12-31')` = `13 years 11 mons 30 days`, e a comparação dá `false`.

| RPC | O que acontecia na véspera |
|---|---|
| `classificar_risco` | Protocolo de classificação do adulto em vez do pediátrico (idade na data de chegada, em Brasília) |
| `registrar_avaliacao` | NIPS e FLACC recusadas; Braden, Morse e pergunta surpresa aceitas |
| `registrar_fugulin` | Fugulin (instrumento do adulto) aceito para a criança |

Na produção, essas três são as únicas funções com `age(...) < interval` (conferido no catálogo em 01/11/2026). O corpo delas no repositório é idêntico ao da produção e ao da homologação (md5 do `prosrc` sem `\r`).

## Correção

Migration `20270209000001_corte_14_anos.sql`:

- Função nova `private.pediatrico_em(nascimento, dia)` = `nascimento > dia - interval '14 years'`. É a mesma conta que `prescrever` e a observação já usam. Nascimento nulo continua dando nulo. Quem nasceu em 29/02 completa os anos em 01/03, igual a `idadeEm` do frontend.
- As três RPCs passam a chamar essa função. Os corpos são os das migrations de origem, com a troca só dessa expressão; assinatura, `SECURITY DEFINER`, `search_path` e grants não mudam.
- `pediatrico_em` sem `EXECUTE` para `PUBLIC`, `anon` e `authenticated`: só as RPCs (`SECURITY DEFINER`) a chamam.
- Expand, idempotente, sem DROP/RENAME, sem tela.

Rollback: reaplicar as três funções das migrations de origem (`20261119000002`, `20270203000006`, `20261119000001`) e `DROP FUNCTION private.pediatrico_em(date, date)`.

## Testes

`supabase/tests/vd1_corte_14_anos.sql`:

1. Fugulin com o relógio da unidade fixado em 30/12/2026 (só na transação): recusado para quem nasceu em 31/12/2012 (véspera) e aceito para quem nasceu em 30/12/2012 (aniversário).
2. A regra com datas fixas: véspera e aniversário, nascimento no dia 31, em mês de 30 dias, em 01/03 e em 29/02, virada do ano, recém-nascido, adulto e nascimento nulo.
3. Nenhuma função de `public` ou `private` compara `age()` com `interval '14 years'`, e as três RPCs chamam `private.pediatrico_em`.

Evidência:

- **Sem a migration, o teste falha no CI.** Commit `f7633c20`, só com o teste: "FALHOU: véspera dos 14 anos: ainda criança, Fugulin recusado — passou sem erro". O código antigo aceitou o Fugulin para a criança.
- **Com a migration, o teste passa no CI** (commit da correção neste PR).
- **Rollback testado na homologação**, em transação desfeita:
  - a migration aplicada duas vezes não deu erro;
  - os corpos mudaram;
  - depois do rollback as três funções voltaram com md5 idêntico ao de antes e o helper saiu;
  - `authenticated` continua com `EXECUTE` nas três RPCs e `anon` continua sem.
- Na homologação as seções 2 e 3 rodam. A seção 1 usa as internações de demonstração do seed do CI, que a homologação não tem.

## Homologação

Aplicada pelo SQL em 01/11/2026, com a versão `20270209000001` registrada. Conferido:
- `pediatrico_em('2012-12-31','2026-12-30')` dá `true` (véspera) e `pediatrico_em('2012-12-31','2026-12-31')` dá `false` (aniversário);
- as três RPCs usam a função nova;
- nenhuma função compara mais `age()` com 14 anos;
- `authenticated` não executa o helper.

Sem tela: nada a ver no navegador.

## Produção

Aguarda o "ok produção" do RT, porque a migration precisa entrar antes do merge.

## Riscos

- Nenhuma mudança de comportamento fora da véspera do aniversário: nos outros dias as duas contas dão o mesmo resultado.
- O VD2 (idade pela data UTC da chegada na tela do médico e na fila do PS) e o VD3 (escores pediátricos com `current_date`) são outros itens do lote.
