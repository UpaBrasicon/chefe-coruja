-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U11, PR 3 (plano em docs/ubs/U11-PLANO.md; N1 decidida pelo
-- RT em 18/11/2026). Achado A10: o recém-nascido ficava cadastrado no hospital
-- e não aparecia na puericultura da UBS.
--
-- 1. pacientes.pre_cadastro: cadastro feito em segundo plano, que ainda não
--    veio à UBS. A primeira ficha na UBS (registrar_ficha) tira a marca.
-- 2. RN cadastrado fora da UBS (hospital ou UPA), ligado à mãe: a UBS da mãe
--    (achada por CNS, CPF ou unificação) ganha o cadastro do RN em segundo plano
--    ("RN de <mãe>", nascimento, sexo, mãe ligada), e médico, enfermagem e
--    gestor dela recebem o aviso.
-- 3. puericultura_painel devolve, por criança, a marca do pré-cadastro e a mãe
--    (nome e telefone) para a UBS entrar em contato.
-- 4. puericultura_bebes_esperados: a gestação da UBS que passou da DPP sem parto
--    registrado (nem saída) vira "bebê esperado", com a mãe, para a UBS procurar.
--    Sai quando o parto é registrado ou a gestação tem saída.
--
-- Idempotente. Teste: supabase/tests/ubs_u11_rn_puericultura.sql
--
-- Rollback (na ordem):
--   DROP TRIGGER trg_u11_rn_na_ubs_da_mae ON public.pacientes;
--   DROP FUNCTION private.u11_rn_na_ubs_da_mae(), public.puericultura_bebes_esperados(uuid);
--   trocas 3 e 5 invertidas (os trechos estão abaixo);
--   a coluna fica (expand); para tirá-la, com janela:
--   ALTER TABLE public.pacientes DROP COLUMN pre_cadastro;
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.u11c_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    CONTINUE WHEN position(replace(p_pares[k + 1], chr(13), '') IN novo) > 0;
    IF position(p_pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, p_pares[k], p_pares[k + 1]);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

-- ── 1. marca do pré-cadastro ────────────────────────────────────────────────
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS pre_cadastro boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.pacientes.pre_cadastro IS
  'Cadastro feito em segundo plano (U11: RN do hospital na UBS da mãe) que ainda não veio à unidade. A primeira ficha tira a marca.';

SELECT pg_temp.u11c_trocar('public.registrar_ficha(uuid,text,uuid,jsonb,text[],boolean)'::regprocedure,
  $a$  UPDATE public.pacientes SET setor_id = p_setor, updated_at = now() WHERE id = v_pac.id RETURNING * INTO v_pac;$a$,
  $b$  UPDATE public.pacientes SET setor_id = p_setor, updated_at = now(), pre_cadastro = false WHERE id = v_pac.id RETURNING * INTO v_pac;  -- U11: veio à unidade$b$);

-- ── 2. RN do hospital na UBS da mãe ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.u11_rn_na_ubs_da_mae()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m record; v_rn uuid; v_origem text;
BEGIN
  -- só o RN cadastrado fora da UBS; o da própria UBS já está nela
  IF EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = NEW.unidade_id AND u.tipo::text = 'ubs') THEN RETURN NULL; END IF;
  SELECT u.nome INTO v_origem FROM public.unidades u WHERE u.id = NEW.unidade_id;
  BEGIN
    FOR m IN
      SELECT pa.id, pa.unidade_id, pa.nome, pa.nome_social FROM public.pacientes pa
        JOIN public.unidades u ON u.id = pa.unidade_id AND u.tipo::text = 'ubs'
       WHERE pa.id IN (SELECT x.paciente_id FROM private.regulacao_mesmo_paciente(NEW.mae_id) x) AND pa.ativo
    LOOP
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.pacientes r WHERE r.mae_id = m.id AND r.data_nascimento = NEW.data_nascimento
                              AND coalesce(r.rn_ordem, 1) = coalesce(NEW.rn_ordem, 1));
      INSERT INTO public.pacientes (unidade_id, nome, prontuario, sexo, data_nascimento, nome_mae, mae_id, rn_ordem, pre_cadastro)
      VALUES (m.unidade_id, 'RN de ' || coalesce(nullif(btrim(m.nome_social), ''), m.nome), private.gerar_prontuario(m.unidade_id),
              NEW.sexo, NEW.data_nascimento, m.nome, m.id, NEW.rn_ordem, true)
      RETURNING id INTO v_rn;
      PERFORM private.registrar_auditoria('criar', 'pacientes', v_rn, m.unidade_id, jsonb_build_object('situacao', 'rn_do_hospital'));
      INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
      SELECT DISTINCT vi.perfil_id, m.unidade_id, current_date, 'ubs_rn_' || v_rn::text,
             'Nasceu o bebê de ' || coalesce(nullif(btrim(m.nome_social), ''), m.nome) || ' em ' || to_char(NEW.data_nascimento, 'DD/MM')
             || ' (' || coalesce(v_origem, 'outra unidade') || '). O cadastro já está na puericultura; ainda não veio à UBS.'
        FROM public.vinculos vi
       WHERE vi.unidade_id = m.unidade_id AND vi.ativo AND vi.papel::text IN ('plantonista', 'enfermeiro', 'gestor')
      ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'U11: RN % não levado à UBS da mãe: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.u11_rn_na_ubs_da_mae() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_u11_rn_na_ubs_da_mae ON public.pacientes;
CREATE TRIGGER trg_u11_rn_na_ubs_da_mae AFTER INSERT ON public.pacientes
  FOR EACH ROW WHEN (NEW.mae_id IS NOT NULL AND NEW.data_nascimento IS NOT NULL)
  EXECUTE FUNCTION private.u11_rn_na_ubs_da_mae();

-- ── 3. a puericultura mostra o pré-cadastro e a mãe ─────────────────────────
SELECT pg_temp.u11c_trocar('public.puericultura_painel(uuid)'::regprocedure,
  $a$                                        'data_nascimento', pa.data_nascimento, 'nome_mae', pa.nome_mae)$a$,
  $b$                                        'data_nascimento', pa.data_nascimento, 'nome_mae', pa.nome_mae, 'pre_cadastro', pa.pre_cadastro, 'mae', (SELECT jsonb_build_object('nome', coalesce(nullif(btrim(mm.nome_social), ''), mm.nome), 'telefone', mm.telefone) FROM public.pacientes mm WHERE mm.id = pa.mae_id))$b$);

-- ── 4. bebê esperado ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.puericultura_bebes_esperados(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT private.hiperdia_ve(p_unidade) THEN
    RAISE EXCEPTION 'A puericultura é vista pelo médico, pela enfermagem e pelo gestor da UBS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('gestacao_id', g.id, 'paciente_id', pa.id,
                                        'nome', coalesce(nullif(btrim(pa.nome_social), ''), pa.nome), 'telefone', pa.telefone,
                                        'dpp', g.dum + 280) ORDER BY g.dum)
      FROM public.pre_natal_gestacoes g JOIN public.pacientes pa ON pa.id = g.paciente_id
     WHERE g.unidade_id = p_unidade AND g.desfecho IS NULL AND g.saida_em IS NULL AND g.dum IS NOT NULL
       AND private.data_atual() >= g.dum + 280
       -- até os 2 anos da criança, como a puericultura
       AND private.data_atual() < g.dum + 280 + 730), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.puericultura_bebes_esperados(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puericultura_bebes_esperados(uuid) TO authenticated;
