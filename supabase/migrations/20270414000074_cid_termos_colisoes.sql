-- ════════════════════════════════════════════════════════════════════════════
-- CID de referência da Avaliação: termos para as 5 colisões da varredura G3
-- (docs/porta/CID-CEFALEIA-DIAGNOSTICO.md). A busca de texto trazia primeiro
-- um código sem relação (crise de pânico → epilepsia, falta de ar → falta de
-- água, vômitos → vômitos da gravidez...). Códigos escolhidos pelo RT em
-- 16/11/2026: as 4 propostas, e I10 para a crise hipertensiva (a CID-10 do
-- DATASUS não tem o I16).
--
-- Expand puro e idempotente: só insere na lista curada, e só se o código
-- existir na CID-10 carregada.
-- Volta: DELETE FROM public.cid_termo WHERE fonte = 'RT 16/11/2026, colisões G3';
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.cid_termo (termo, termo_norm, cid, tipo, fonte)
SELECT s.termo, private.norm_cid_termo(s.termo), s.cid, s.tipo, 'RT 16/11/2026, colisões G3'
  FROM (VALUES ('crise de pânico',            'F41.0', 'popular'),
               ('falta de ar',                'R06.0', 'popular'),
               ('parada cardiorrespiratória', 'I46.9', 'preferido'),
               ('PCR',                        'I46.9', 'sigla'),
               ('vômitos',                    'R11',   'preferido'),
               ('crise hipertensiva',         'I10',   'preferido')) AS s(termo, cid, tipo)
  JOIN terminologia.cid10 c ON c.codigo = s.cid
ON CONFLICT ON CONSTRAINT cid_termo_unico DO NOTHING;
