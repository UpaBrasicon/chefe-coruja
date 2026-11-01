# VD6 — Fixo quinzenal reinicia a cada mês

Lote "Virada de data" do `BACKLOG.md`. Prioridade: **P1**, decidida pelo RT em 01/11/2026 ("Sim, VD6").

## Diagnóstico

`public.gerar_escala_mensal_detalhada` gera o mês a partir da escala fixa. Para a fixa quinzenal (15/15), escolhia as semanas pela semana do mês:

```sql
v_semana_do_mes := (EXTRACT(day FROM v_dia)::int - 1) / 7;
...
AND (x.quinzenal = false OR v_semana_do_mes % 2 = 0)
```

Gerava nos dias 1–7, 15–21 e 29–31 de cada mês. Quem caía nos dias 29–31 caía de novo nos dias 1–7 do mês seguinte: duas semanas seguidas. Depois disso, a alternância trocava de lado.

Exemplo: uma fixa quinzenal de quarta gerava 29/10/2031 e também 05/11/2031.

`gerar_escala_mensal`, a versão antiga, só chama esta função.

O corpo no repositório (`20270202000003_escala_gestor_categorias.sql`) tem o mesmo md5 que a produção (`5526a342…`) e a homologação, em 01/11/2026. Na produção nenhuma fixa é quinzenal hoje (0 de 126).

## Decisão do RT

Entre as três opções levadas, o RT escolheu **calendário único**:
- as semanas são contadas a partir de uma segunda-feira fixa, sem quebrar na virada de mês ou de ano;
- todo quinzenal trabalha nas mesmas semanas, como antes.

As opções descartadas:
- **contar desde o cadastro da fixa:** a alternância mudaria ao recriar a fixa;
- **gestor escolhe a semana A ou B:** seria funcionalidade nova, com tela.

## Correção

Migration `20270209000005_quinzenal_continuo.sql`:

- **Função nova** `private.semana_quinzenal(dia)`: diz se a semana do dia é de trabalho.
  - As semanas vão de segunda a domingo e são contadas a partir de 03/01/2000, uma segunda-feira.
  - As semanas pares são de trabalho.
  - Nenhum papel a executa direto.
- **Geração do mês:** `gerar_escala_mensal_detalhada` usa a função nova no lugar da semana do mês. O resto do corpo fica igual ao de `20270202000003`.
- Expand, idempotente, sem tela.

Rollback: reaplicar `gerar_escala_mensal_detalhada` de `20270202000003` e `DROP FUNCTION private.semana_quinzenal(date)`.

## Testes

`supabase/tests/vd6_quinzenal_continuo.sql`:

1. **Geração.** O gestor gera de outubro/2031 a janeiro/2032 com duas fixas quinzenais:
   - uma de quarta, porque 29/10/2031 cai nos dias 29–31;
   - uma de segunda, porque 29/12/2031 está na virada do ano.

   Os plantões de cada fixa têm de estar sempre a 14 dias um do outro.
2. **Função nova.** De 2026 a 2032:
   - o mesmo dia da semana seguinte tem sempre a paridade oposta;
   - a semana só vira na segunda-feira;
   - a âncora é semana de trabalho.
3. **Acesso.** `authenticated` não executa o helper.

A seção 1 usa o seed do CI. A homologação não tem esse seed, por isso lá rodam as seções 2 e 3.

Evidência:
- **Sem a migration, falha:**
  - no CI, a seção 1 do commit `0722f209`, só com o teste, recusa os plantões 29/10 e 05/11/2031 a 7 dias;
  - na homologação, as seções 2 e 3 falham porque `private.semana_quinzenal` não existe.
- **Com a migration, passa.**
- **Rollback testado na homologação, em transação desfeita:**
  - a migration aplicada duas vezes não deu erro;
  - depois do rollback, o md5 de `gerar_escala_mensal_detalhada` voltou ao de antes (`5526a342…`) e a função nova saiu;
  - o ACL ficou igual.

## Homologação

Aplicada pelo SQL em 01/11/2026, com a versão `20270209000005` registrada. As seções 2 e 3 passam com a migration aplicada.

## Produção

Migration `20270209000005` aplicada na produção (`saqjrjtrkzkswsxxvdxn`) em 01/11/2026, com o "ok produção" do RT e depois do CI verde. Conferido depois de aplicar:
- versão registrada;
- `gerar_escala_mensal_detalhada` usa a função nova, com md5 `6791e7af…` igual ao da homologação;
- `semana_quinzenal` dá trabalho em 29/10/2031, folga em 05/11 e trabalho em 12/11;
- ACL igual, e ninguém executa o helper direto.

PR #397 mesclado em seguida. Concluído.

## Riscos

- Muda só quais semanas o quinzenal gera. O fixo semanal segue igual.
- Um mês já gerado não é refeito. Gerar de novo não apaga plantões, só acrescenta os que faltam. Hoje não há fixa quinzenal na produção.
- Dois profissionais não conseguem alternar no mesmo posto: todo quinzenal cai nas mesmas semanas. Isso já era assim antes. Mudar exige a opção semana A/B, que é funcionalidade nova.
