-- ════════════════════════════════════════════════════════════════════════════
-- Envio à UPA feito da escuta inicial: a ficha da UBS fecha como encaminhamento
-- (decisão do RT em 25/11/2026, teste de fluxo A, item A-13).
--
-- Quando o médico envia o paciente à UPA antes de abrir o atendimento (da
-- escuta), encaminhar_upa encerra a ficha da UBS. Ela fechava sem conduta: no
-- prontuário e na carga do SISAB não aparecia como encaminhamento. Agora fecha
-- com a conduta "encaminhamento_urgencia" (lista da ficha de atendimento
-- individual). O que a escuta registrou (queixa, sinais, classificação) já fica
-- no prontuário e segue sem mudança.
--
-- 1. encaminhar_upa: o encerramento pela escuta grava conduta_aps.
-- 2. Acerto das fichas já encerradas assim (sem conduta, com envio à UPA e sem
--    atendimento aberto): recebem a mesma conduta. Idempotente.
--
-- Não muda a regra da carga do SISAB: a ficha de atendimento individual sem
-- problema, CID nem CIAP continua retida (private.ledi_carga_fai).
--
-- Rollback: a troca invertida em encaminhar_upa; para os dados,
--   UPDATE public.episodios SET conduta_aps = NULL
--    WHERE conduta_aps = ARRAY['encaminhamento_urgencia'] AND atendimento_iniciado_em IS NULL
--      AND desfecho_motivo LIKE 'Enviado à %'
--      AND id IN (SELECT episodio_origem_id FROM public.encaminhamentos_upa);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.fa_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    CONTINUE WHEN position(p_pares[k + 1] IN novo) > 0;
    IF position(p_pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, p_pares[k], p_pares[k + 1]);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

SELECT pg_temp.fa_trocar('public.encaminhar_upa(uuid, uuid, text)',
$a$       SET etapa = 'encerrado', desfecho_motivo = 'Enviado à ' || u_destino.nome || ': ' || btrim(p_motivo),$a$,
$b$       SET etapa = 'encerrado', conduta_aps = ARRAY['encaminhamento_urgencia'],
           desfecho_motivo = 'Enviado à ' || u_destino.nome || ': ' || btrim(p_motivo),$b$);

DROP FUNCTION pg_temp.fa_trocar(regprocedure, text[]);

UPDATE public.episodios e
   SET conduta_aps = ARRAY['encaminhamento_urgencia']
 WHERE e.etapa = 'encerrado' AND e.tipo_atendimento_aps IS NOT NULL
   AND e.atendimento_iniciado_em IS NULL
   AND coalesce(cardinality(e.conduta_aps), 0) = 0
   AND e.desfecho_motivo LIKE 'Enviado à %'
   AND EXISTS (SELECT 1 FROM public.encaminhamentos_upa x WHERE x.episodio_origem_id = e.id);
