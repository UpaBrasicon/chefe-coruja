-- ════════════════════════════════════════════════════════════════════════════
-- Achado B P1-1 do teste da rede (07/11/2026): a observação que vira
-- internação não abria a conta de internação. Decisões do RT de 07/11/2026:
-- A em P1 a P3 (docs/teste-rede/CONTA-INTERNACAO-OBSERVACAO-DIAGNOSTICO.md).
--
-- Causa: a conversão muda só o status; internado_em é preenchido pelo
-- gatilho BEFORE trg_internacao_tipo_na_conversao. Um gatilho
-- "UPDATE OF internado_em" só olha as colunas da instrução UPDATE, então
-- trg_conta_da_internacao não disparava.
--
-- P1 A: o gatilho da conta passa a disparar também na mudança de status
--       (igual ao trg_webhook). A função não muda: só abre a conta se ainda
--       não existir uma de internação para a internação.
-- P2 A: abre as contas que faltam (internado_em preenchido e sem conta de
--       internação), na hora de internado_em e ligadas à conta da porta, pela
--       própria abrir_conta. Na produção, em 07/11/2026, não havia nenhuma
--       internação; na homologação eram 5.
--
-- Rollback (o gatilho antigo; as contas abertas ficam, são corretas):
--   DROP TRIGGER IF EXISTS trg_conta_da_internacao ON public.internacoes;
--   CREATE TRIGGER trg_conta_da_internacao AFTER INSERT OR UPDATE OF internado_em ON public.internacoes
--     FOR EACH ROW EXECUTE FUNCTION private.trg_conta_da_internacao();
--   DROP FUNCTION IF EXISTS private.abrir_contas_de_internacao_que_faltam();
-- ════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_conta_da_internacao ON public.internacoes;
CREATE TRIGGER trg_conta_da_internacao AFTER INSERT OR UPDATE OF internado_em, status ON public.internacoes
  FOR EACH ROW EXECUTE FUNCTION private.trg_conta_da_internacao();

CREATE OR REPLACE FUNCTION private.abrir_contas_de_internacao_que_faltam()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record; v_n integer := 0;
BEGIN
  FOR r IN SELECT i.* FROM public.internacoes i
            WHERE i.internado_em IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM public.contas c WHERE c.internacao_id = i.id AND c.tipo = 'internacao')
            ORDER BY i.internado_em LOOP
    PERFORM private.abrir_conta('internacao', r.unidade_id, r.paciente_id, NULL, r.id,
      (SELECT c.id FROM public.contas c WHERE c.episodio_id = r.episodio_id AND c.tipo = 'ambulatorial'), r.internado_em);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION private.abrir_contas_de_internacao_que_faltam() FROM PUBLIC, anon, authenticated;

SELECT private.abrir_contas_de_internacao_que_faltam();
