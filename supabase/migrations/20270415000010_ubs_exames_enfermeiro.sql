-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U6: exames que o enfermeiro pede na consulta de enfermagem
-- (decisão P1 = A do plano docs/ubs/U6-U7-PLANO.md; lista em
-- docs/ubs/U6-LISTA-EXAMES-ENFERMEIRO.md, E1 = A em 17/11/2026).
--
-- Base: Lei 7.498/1986 e Resolução COFEN 195/1997 (o enfermeiro pede exames de
-- rotina dentro de programa de saúde pública e de protocolo); Cadernos de
-- Atenção Básica nº 32 (pré-natal), 36 (diabetes) e 37 (hipertensão) e
-- Protocolos da Atenção Básica: Saúde das Mulheres (2016). Conferida com o texto
-- em 17/11/2026; decisões C1–C4 = A do RT: sai a hepatite C da gestante (não é
-- rotina), sai o rastreio da população geral (fica com os testes rápidos), entra
-- a eletroforese de hemoglobina, ficam os exames de hipertensão e diabetes.
--
-- 1. private.ubs_exames_enfermagem(): a lista fixa, com código SIGTAP conferido
--    na tabela da homologação em 17/11/2026 e a linha de cuidado de cada exame.
--    A cópia da tela está em src/domain/examesEnfermagemUbs.ts.
-- 2. private.exame_consulta_enfermagem() (gatilho da migration
--    20270415000007): na ficha da UBS com destino enfermagem, quem não é médico
--    só pede exame com código da lista. Texto livre fica de fora (não tem código).
--    O resto do pedido (pedir_exames, catálogo da unidade, resultado) não muda.
--
-- Os exames da parceria da gestante (E3 = A) vêm em PR próprio: o pedido sai em
-- nome da parceria, que precisa estar cadastrada.
--
-- Idempotente. Teste: supabase/tests/ubs_exames_enfermeiro.sql
--
-- Rollback (volta à trava da 20270415000007):
--   recriar private.exame_consulta_enfermagem() de
--     20270415000007_ubs_consulta_enfermagem.sql;
--   DROP FUNCTION private.ubs_exames_enfermagem();
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. lista ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.ubs_exames_enfermagem()
RETURNS TABLE (codigo text, nome text, linhas text[])
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT * FROM (VALUES
    ('0202020380', 'Hemograma completo', ARRAY['pre_natal']),
    ('0202020355', 'Eletroforese de hemoglobina', ARRAY['pre_natal']),
    ('0202120023', 'Grupo ABO', ARRAY['pre_natal']),
    ('0202120082', 'Fator Rh', ARRAY['pre_natal']),
    ('0202120090', 'Coombs indireto', ARRAY['pre_natal']),
    ('0202010473', 'Glicose', ARRAY['pre_natal', 'hiperdia']),
    ('0202010040', 'Curva glicêmica (2 dosagens)', ARRAY['pre_natal']),
    ('0202050017', 'Urina tipo I (EAS)', ARRAY['pre_natal', 'hiperdia']),
    ('0202080080', 'Urocultura', ARRAY['pre_natal']),
    ('0202031179', 'Sífilis (VDRL) em gestante', ARRAY['pre_natal']),
    ('0202031519', 'HIV em gestante', ARRAY['pre_natal']),
    ('0202031454', 'Hepatite B (HBsAg) em gestante', ARRAY['pre_natal']),
    ('0202030768', 'Toxoplasmose IgG', ARRAY['pre_natal']),
    ('0202030873', 'Toxoplasmose IgM', ARRAY['pre_natal']),
    ('0202010503', 'Hemoglobina glicada (HbA1c)', ARRAY['hiperdia']),
    ('0202010317', 'Creatinina', ARRAY['hiperdia']),
    ('0202010600', 'Potássio', ARRAY['hiperdia']),
    ('0202010295', 'Colesterol total', ARRAY['hiperdia']),
    ('0202010279', 'Colesterol HDL', ARRAY['hiperdia']),
    ('0202010678', 'Triglicerídeos', ARRAY['hiperdia']),
    ('0202050092', 'Microalbumina na urina', ARRAY['hiperdia'])
  ) AS t(codigo, nome, linhas)
$$;
REVOKE ALL ON FUNCTION private.ubs_exames_enfermagem() FROM PUBLIC, anon, authenticated;

-- ── 2. o pedido do enfermeiro ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.exame_consulta_enfermagem()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.episodios;
BEGIN
  IF NEW.episodio_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO e FROM public.episodios WHERE id = NEW.episodio_id;
  IF e.destino_aps IS DISTINCT FROM 'enfermagem' OR private.tenho_papel(e.unidade_id, 'plantonista') IS TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.procedimento IS NULL THEN
    RAISE EXCEPTION 'Na consulta de enfermagem o exame sai da lista do protocolo da atenção básica, sem texto livre.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.ubs_exames_enfermagem() x WHERE x.codigo = NEW.procedimento) THEN
    RAISE EXCEPTION 'Exame fora do protocolo de enfermagem da atenção básica: %.', NEW.exame;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.exame_consulta_enfermagem() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_exame_consulta_enfermagem ON public.exames_pedidos;
CREATE TRIGGER trg_exame_consulta_enfermagem BEFORE INSERT ON public.exames_pedidos
  FOR EACH ROW EXECUTE FUNCTION private.exame_consulta_enfermagem();
