-- ════════════════════════════════════════════════════════════════════════════
-- Achado C P2-C1 do teste da rede (C05, 07/11/2026): a remuneração de plantão
-- (valor que vai ao ERP de pagamento) era gravada sem autor (criado_por nulo,
-- a tela manda null) e sem auditoria. Decisão: A em M1 e M2 (recomendação
-- aplicada por delegação do RT em 08/11/2026;
-- docs/teste-rede/fila/ITEM-09-remuneracao-autor.md).
--
-- M1. O autor é o login, gravado pelo servidor: criado_por = quem inclui (o
--     que vem da tela é ignorado); atualizado_por (coluna nova) = quem muda
--     ou desativa; criado_por não muda depois. updated_at acompanha.
-- M2. Inclusão, mudança e desativação vão a log_auditoria
--     ("remuneracao_incluida", "remuneracao_alterada",
--     "remuneracao_desativada"), com o setor, o turno (tipo), o valor
--     (quantidade) e o valor anterior (anterior), chaves que a
--     payload_auditoria já deixa passar (nenhum dado de pessoa).
-- As linhas antigas ficam com criado_por nulo (não se inventa autor).
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_remuneracao_autor ON public.remuneracoes_plantao;
--   DROP TRIGGER IF EXISTS trg_remuneracao_auditoria ON public.remuneracoes_plantao;
--   DROP FUNCTION IF EXISTS private.remuneracao_autor(), private.remuneracao_auditoria();
--   (a coluna atualizado_por pode ficar)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.remuneracoes_plantao ADD COLUMN IF NOT EXISTS atualizado_por uuid REFERENCES public.perfis(id);
COMMENT ON COLUMN public.remuneracoes_plantao.criado_por IS 'Quem incluiu o valor (login), gravado pelo servidor (C P2-C1).';
COMMENT ON COLUMN public.remuneracoes_plantao.atualizado_por IS 'Quem mudou ou desativou o valor por último (login), gravado pelo servidor (C P2-C1).';

CREATE OR REPLACE FUNCTION private.remuneracao_autor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.criado_por := coalesce(private.meu_perfil_id(), NEW.criado_por);
    NEW.atualizado_por := NULL;
  ELSE
    NEW.criado_por := OLD.criado_por;
    NEW.atualizado_por := coalesce(private.meu_perfil_id(), NEW.atualizado_por);
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION private.remuneracao_auditoria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.registrar_auditoria(
    CASE WHEN TG_OP = 'INSERT' THEN 'remuneracao_incluida'
         WHEN OLD.ativo AND NOT NEW.ativo THEN 'remuneracao_desativada'
         ELSE 'remuneracao_alterada' END,
    'remuneracoes_plantao', NEW.id, NEW.unidade_id,
    jsonb_build_object('setor_id', NEW.setor_id, 'tipo', NEW.turno, 'quantidade', NEW.valor, 'ativo', NEW.ativo,
                       'anterior', CASE WHEN TG_OP = 'UPDATE' THEN OLD.valor END));
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION private.remuneracao_autor(), private.remuneracao_auditoria() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_remuneracao_autor ON public.remuneracoes_plantao;
CREATE TRIGGER trg_remuneracao_autor BEFORE INSERT OR UPDATE ON public.remuneracoes_plantao
  FOR EACH ROW EXECUTE FUNCTION private.remuneracao_autor();
DROP TRIGGER IF EXISTS trg_remuneracao_auditoria ON public.remuneracoes_plantao;
CREATE TRIGGER trg_remuneracao_auditoria AFTER INSERT OR UPDATE ON public.remuneracoes_plantao
  FOR EACH ROW EXECUTE FUNCTION private.remuneracao_auditoria();
