-- Fase 5B, etapa 3.1 (ajuste): a sugestão da unidade de consumo procura a
-- forma em qualquer parte da apresentação. O catálogo da produção começa pela
-- forma ("Ampola 10 mL"), mas o da homologação a traz no meio ("solução
-- injetável, ampola 10 mL"; "pó para solução injetável"): lá 49 de 65 ficaram
-- sem unidade. Preenche de novo só quem ficou sem unidade e não foi conferido.

CREATE OR REPLACE FUNCTION private.sugerir_unidade_consumo(p_apresentacao text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  WITH a AS (SELECT translate(lower(btrim(coalesce(p_apresentacao, ''))), 'áàâãéêíóôõúç', 'aaaaeeiooouc') AS t)
  SELECT CASE
    WHEN t ~ '\mfrasco[- ]ampola\M' THEN 'frasco_ampola'
    WHEN t ~ '\mseringa' THEN 'seringa_preenchida'
    WHEN t ~ '\mampola' THEN 'ampola'
    WHEN t ~ '\mbolsa' THEN 'bolsa'
    -- pó para reconstituir (injetável) vem em frasco-ampola
    WHEN t ~ '\m(po|liofilizado)\M' AND t ~ 'injet' THEN 'frasco_ampola'
    WHEN t ~ '\mfrasco' AND t ~ '\m(po|liofilizado)\M' THEN 'frasco_ampola'
    WHEN t ~ '\mfrasco' THEN 'frasco'
    WHEN t ~ '\mcomprimido' THEN 'comprimido'
    WHEN t ~ '\mcapsula' THEN 'capsula'
    WHEN t ~ '\mdragea' THEN 'dragea'
    WHEN t ~ '\msache' THEN 'sache'
    WHEN t ~ '\menvelope' THEN 'envelope'
    WHEN t ~ '\mbisnaga' THEN 'bisnaga'
    WHEN t ~ '\madesivo' THEN 'adesivo'
    WHEN t ~ '\msupositorio' THEN 'supositorio'
    WHEN t ~ '\mcaneta' THEN 'caneta'
    WHEN t ~ '\mflaconete' THEN 'flaconete'
    -- líquido oral sem a embalagem escrita: frasco
    WHEN t ~ '\m(solucao|suspensao|xarope|elixir|emulsao)\M' AND t ~ '\moral\M' THEN 'frasco'
  END FROM a
$$;

UPDATE public.medicamento SET unidade_consumo = private.sugerir_unidade_consumo(apresentacao)
 WHERE unidade_consumo IS NULL AND unidade_consumo_conferida_em IS NULL;
