-- ════════════════════════════════════════════════════════════════════════════
-- S6 (A01 P2-2; decisão do RT em 07/11/2026): regulações já "realizada" com a
-- origem ainda aberta. A migration 20270307000006 NÃO muda status antigo; esta
-- consulta, só de leitura, lista os casos para o NIR e o gestor resolverem
-- pelo fluxo normal (alta por transferência na origem).
--
-- Na produção, rodar pelo responsável. A saída tem só números e ids, nenhum
-- dado de paciente.
-- ════════════════════════════════════════════════════════════════════════════
SELECT s.numero, s.id AS regulacao_id, s.tipo, s.realizada_em,
       (SELECT u.nome FROM public.unidades u WHERE u.id = s.unidade_origem_id) AS origem,
       (SELECT count(*) FROM public.episodios e
         WHERE e.paciente_id = s.paciente_id AND e.unidade_id = s.unidade_origem_id AND e.encerrado_em IS NULL) AS episodios_abertos,
       (SELECT count(*) FROM public.internacoes i
         WHERE i.paciente_id = s.paciente_id AND i.unidade_id = s.unidade_origem_id
           AND i.status IN ('admitido', 'em_observacao', 'internado')) AS internacoes_ativas
  FROM public.regulacao_solicitacoes s
 WHERE s.status = 'realizada' AND s.tipo IN ('leito', 'transferencia')
   AND NOT private.regulacao_origem_encerrada(s)
 ORDER BY s.realizada_em;
