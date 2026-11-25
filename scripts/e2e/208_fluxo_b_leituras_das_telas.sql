-- ════════════════════════════════════════════════════════════════════════════
-- Teste de fluxo B, fase 8: leituras que as telas fazem (só leitura), para
-- conferir fila, contagens, prazos ("evol."), linha do tempo e documento de
-- transferência quando o navegador não está logado. Nada é gravado além do
-- resultado em e2e.resultados.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
CREATE TEMP TABLE _r (o serial, txt text) ON COMMIT DROP;
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.16.fila_central', 'reg', 'Console da central: quem está na fila (esperado B09 em pendência e B10 enviada) e os prazos',
  format($q$SELECT string_agg('nº ' || (s ->> 'numero') || ' ' || (s ->> 'status') || ' prioridade ' || coalesce(s ->> 'prioridade_efetiva', s ->> 'prioridade') || ' sla ' || left((s -> 'sla')::text, 330), ' || ')
    FROM jsonb_array_elements(public.regulacao_fila(%L::uuid, '{}'::jsonb)) s WHERE s ->> 'id' = ANY (%L::text[])$q$, e2e.fb_central(), (SELECT array_agg(e2e.fbv(c.n, 'reg')) FROM e2e.fb_coorte c)), 'registrar');
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.16.fila_central_contagem', 'reg', 'Só B09 e B10 seguem na fila da central; os outros 8 saíram dela',
  format($q$SELECT e2e.fb_confere(count(*) = 2, count(*) || ' pedidos B na fila: ' || string_agg(s ->> 'numero', ', '))
    FROM jsonb_array_elements(public.regulacao_fila(%L::uuid, '{}'::jsonb)) s WHERE s ->> 'id' = ANY (%L::text[])$q$, e2e.fb_central(), (SELECT array_agg(e2e.fbv(c.n, 'reg')) FROM e2e.fb_coorte c)));
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.16.lista_origem', 'med', 'Console da origem (UPA): situação dos 10 pedidos',
  format($q$SELECT string_agg((s ->> 'numero') || '=' || (s ->> 'status'), ', ' ORDER BY (s ->> 'numero')::int)
    FROM jsonb_array_elements(public.regulacao_lista(%L::uuid)) s WHERE s ->> 'id' = ANY (%L::text[])$q$, e2e.fb_upa(), (SELECT array_agg(e2e.fbv(c.n, 'reg')) FROM e2e.fb_coorte c)), 'registrar');
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.16.pendencias_unidade', 'nir', 'NIR › Pendências com médicos: abertas e resolvidas nas últimas 24 h',
  format($q$SELECT left(public.regulacao_pendencias_da_unidade(%L::uuid)::text, 900)$q$, e2e.fb_upa()), 'registrar');
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.16.mapa_leitos_nir', 'nir', 'NIR › Mapa de leitos: leitos da UPA depois das saídas (higienização nos que saíram, B04, B08, B09 e B10 seguem)',
  format($q$SELECT string_agg((l ->> 'identificador') || '=' || coalesce(l ->> 'situacao', l ->> 'status', '?'), ', ')
    FROM jsonb_array_elements(public.nir_mapa_leitos(%L::uuid) -> 'setores') st, jsonb_array_elements(st -> 'leitos') l$q$, e2e.fb_upa()), 'registrar');
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.16.detalhe', 'med', 'Detalhe do pedido na origem: prazos, evoluções (versão e papel), conversa e o que a origem pode fazer',
  format($q$SELECT 'status ' || (d ->> 'status') || '; pode_evoluir ' || coalesce(d ->> 'pode_evoluir', '?') || '; evoluções ' || coalesce(left((d -> 'evolucoes')::text, 260), '-') || '; sla ' || left((d -> 'sla')::text, 380)
    FROM (SELECT public.regulacao_detalhe(%L::uuid) d) z$q$, e2e.fbu(c.n, 'reg')), 'registrar')
  FROM e2e.fb_coorte c WHERE c.n IN (9, 10);
INSERT INTO _r (txt)
SELECT e2e.fb(2, 'FB.16.documento_transferencia', 'med', 'Documento de transferência do B02: o que a fotografia traz sobre isolamento',
  format($q$SELECT coalesce((SELECT string_agg(left(m[1], 200), ' … ') FROM regexp_matches(d.conteudo, '.{0,40}isolamento.{0,120}', 'g') m), 'sem a palavra isolamento')
    FROM (SELECT (public.transferencia_da_regulacao(%L::uuid))::text AS conteudo) d$q$, e2e.fbu(2, 'reg')), 'registrar');
INSERT INTO _r (txt)
SELECT e2e.fb(2, 'FB.16.historico_paciente', 'reg', 'Histórico de regulação do paciente visto pela central: pedido realizado',
  format($q$SELECT e2e.fb_confere(h::text LIKE '%%realizada%%', left(h::text, 200)) FROM (SELECT public.regulacao_historico_paciente(%L::uuid) h) z$q$, e2e.fbu(2, 'pac')));
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.16.indicadores', 'reg', 'Indicadores da central (registro)',
  format($q$SELECT left(public.regulacao_indicadores(%L::uuid, '{}'::jsonb)::text, 500)$q$, e2e.fb_central()), 'registrar');
SELECT txt FROM _r ORDER BY o;
--FIM
COMMIT;
