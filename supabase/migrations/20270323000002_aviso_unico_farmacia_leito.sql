-- ════════════════════════════════════════════════════════════════════════════
-- Aviso em dobro (achado do diagnóstico da lacuna 3, 10/11/2026; o RT mandou
-- corrigir na hora). Conferido na produção e na homologação, com o mesmo md5:
--   - public.validar_item chamava private.avisar_item_devolvido duas vezes: o
--     médico recebia o aviso do item devolvido em dobro;
--   - public.concluir_higienizacao chamava private.avisar_leito_liberado duas
--     vezes: o NIR e a enfermagem recebiam o aviso do leito liberado em dobro.
-- A duplicação veio de 20261119000007_avisos_farmacia_leito.sql (linhas 99/101
-- e 127/128). A correção tira a chamada repetida; nada mais muda.
--
-- As funções são trocadas pelo texto atual (pg_get_functiondef). Se o trecho
-- duplicado não existir mais, nada é trocado (idempotente). Se a função tiver
-- mudado de outro jeito, a migration não toca nela.
-- Teste: supabase/tests/aviso_unico_farmacia_leito.sql
--
-- Rollback: não há o que voltar (a segunda chamada era defeito). Se for
-- preciso, reaplicar as duas funções de 20261119000007.
-- ════════════════════════════════════════════════════════════════════════════

CREATE FUNCTION pg_temp.tirar_repetido(f regprocedure, duplo text, simples text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text := replace(pg_get_functiondef(f), E'\r', '');
BEGIN
  IF position(duplo IN def) = 0 THEN
    RAISE NOTICE '%: trecho duplicado não encontrado (já corrigido?)', f;
    RETURN;
  END IF;
  EXECUTE replace(def, duplo, simples);
END $$;

SELECT pg_temp.tirar_repetido('public.validar_item(uuid, boolean, text)'::regprocedure,
$a$  -- devolvido: avisa quem prescreveu (e o setor, se ele não está de plantão)
  IF NOT p_confere THEN PERFORM private.avisar_item_devolvido(p_item, p_motivo); END IF;
  -- devolvido: avisa quem prescreveu (e o setor, se ele não está de plantão)
  IF NOT p_confere THEN PERFORM private.avisar_item_devolvido(p_item, p_motivo); END IF;
$a$,
$b$  -- devolvido: avisa quem prescreveu (e o setor, se ele não está de plantão)
  IF NOT p_confere THEN PERFORM private.avisar_item_devolvido(p_item, p_motivo); END IF;
$b$);

SELECT pg_temp.tirar_repetido('public.concluir_higienizacao(uuid)'::regprocedure,
$a$  PERFORM private.avisar_leito_liberado(p_leito);
  PERFORM private.avisar_leito_liberado(p_leito);
$a$,
$b$  PERFORM private.avisar_leito_liberado(p_leito);
$b$);
