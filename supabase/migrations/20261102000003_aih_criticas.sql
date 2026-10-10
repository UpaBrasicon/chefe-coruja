-- Fase 3, tarefa 2 — críticas da AIH configuráveis (decisões do RT de
-- 09/10/2026, no BACKLOG).
--
--   • Catálogo fixo de críticas, cada uma com o padrão do produto (bloqueante
--     ou aviso). O gestor da unidade troca o padrão, com motivo e histórico
--     (public.aih_criticas_unidade).
--   • private.criticas_aih: CID principal, CID secundário, causa externa em
--     lesão (S/T), procedimento no SIGTAP, CID × procedimento, sexo, idade,
--     dígito do CNS, CBO do solicitante e tabela SIGTAP desatualizada (mais de
--     1 mês). Sem SIGTAP carregado, as críticas que dependem dele viram um aviso
--     e não bloqueiam.
--   • Bloqueia na emissão do laudo (os dois caminhos passam pelo gatilho
--     aih_do_laudo). Laudo sincronizado de quando estava sem conexão não é
--     barrado: as críticas ficam registradas na AIH.
--   • A AIH guarda as críticas e a competência do SIGTAP usada.
--   • CBO no perfil (perfis.cbo), conferido na lista oficial (terminologia.cbo).
--   • Alertas na fila do regulador: 72 h da internação sem decisão; competência
--     além de 3 meses da alta.
--   • conferir_aih mantém "avisos" como antes e ganha "criticas".
--
-- Só aditiva (expand): colunas com default, tabela e funções novas; funções
-- recriadas com a mesma assinatura.

ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS cbo text;
ALTER TABLE public.aihs ADD COLUMN IF NOT EXISTS criticas jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.aihs ADD COLUMN IF NOT EXISTS sigtap_competencia text;

-- ── catálogo e configuração da unidade ──────────────────────────────────────
CREATE OR REPLACE FUNCTION private.catalogo_criticas_aih()
RETURNS TABLE (codigo text, titulo text, bloqueante_padrao boolean, ordem int)
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  VALUES
    ('cid_principal',        'CID principal ausente, fora do formato ou inexistente na CID-10', true, 1),
    ('cid_secundario',       'CID secundário inexistente na CID-10', false, 2),
    ('causa_externa',        'Lesão ou envenenamento (S/T) sem CID de causa externa (V01–Y98)', true, 3),
    ('procedimento_sigtap',  'Procedimento ausente ou fora do SIGTAP carregado', true, 4),
    ('cid_procedimento',     'CID incompatível com o procedimento ou não aceito como principal', true, 5),
    ('sexo',                 'Procedimento exclusivo do outro sexo', true, 6),
    ('idade',                'Idade fora da faixa do procedimento no SIGTAP', true, 7),
    ('cns',                  'Cartão SUS com dígito verificador inválido', true, 8),
    ('cbo',                  'Médico solicitante sem CBO válido no perfil', false, 9),
    ('sigtap_desatualizado', 'Tabela SIGTAP carregada há mais de 1 mês ou não carregada', false, 10)
$$;
REVOKE ALL ON FUNCTION private.catalogo_criticas_aih() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.catalogo_criticas_aih() TO authenticated;

CREATE TABLE IF NOT EXISTS public.aih_criticas_unidade (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id   uuid NOT NULL REFERENCES public.unidades(id),
  critica      text NOT NULL,
  bloqueante   boolean NOT NULL,
  motivo       text NOT NULL CHECK (length(btrim(motivo)) >= 10),
  definido_por uuid NOT NULL REFERENCES public.perfis(id),
  definido_em  timestamptz NOT NULL DEFAULT now(),
  vigente_ate  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS aih_criticas_unidade_vigente ON public.aih_criticas_unidade (unidade_id, critica) WHERE vigente_ate IS NULL;
ALTER TABLE public.aih_criticas_unidade ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.aih_criticas_unidade FROM anon, authenticated;
REVOKE ALL ON public.aih_criticas_unidade FROM anon;
GRANT SELECT ON public.aih_criticas_unidade TO authenticated;
DROP POLICY IF EXISTS aih_criticas_unidade_select ON public.aih_criticas_unidade;
CREATE POLICY aih_criticas_unidade_select ON public.aih_criticas_unidade FOR SELECT TO authenticated
  USING (private.membro_da_unidade(unidade_id));
DROP POLICY IF EXISTS aih_criticas_unidade_segundo_fator ON public.aih_criticas_unidade;
CREATE POLICY aih_criticas_unidade_segundo_fator ON public.aih_criticas_unidade AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok());

CREATE OR REPLACE FUNCTION private.critica_bloqueante(p_unidade uuid, p_codigo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT c.bloqueante FROM public.aih_criticas_unidade c
      WHERE c.unidade_id = p_unidade AND c.critica = p_codigo AND c.vigente_ate IS NULL),
    (SELECT k.bloqueante_padrao FROM private.catalogo_criticas_aih() k WHERE k.codigo = p_codigo),
    false);
$$;
REVOKE ALL ON FUNCTION private.critica_bloqueante(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.critica_bloqueante(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.definir_critica_aih(p_unidade uuid, p_critica text, p_bloqueante boolean, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.tenho_papel(p_unidade, 'gestor') THEN
    RAISE EXCEPTION 'As críticas da AIH são configuradas pelo gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.catalogo_criticas_aih() k WHERE k.codigo = p_critica) THEN
    RAISE EXCEPTION 'Crítica desconhecida.';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  IF private.critica_bloqueante(p_unidade, p_critica) = p_bloqueante THEN
    RAISE EXCEPTION 'A crítica já está como %.', CASE WHEN p_bloqueante THEN 'bloqueante' ELSE 'aviso' END;
  END IF;
  UPDATE public.aih_criticas_unidade SET vigente_ate = now()
   WHERE unidade_id = p_unidade AND critica = p_critica AND vigente_ate IS NULL;
  INSERT INTO public.aih_criticas_unidade (unidade_id, critica, bloqueante, motivo, definido_por)
  VALUES (p_unidade, p_critica, p_bloqueante, btrim(p_motivo), private.meu_perfil_id());
  PERFORM private.registrar_auditoria('aih_critica_configurada', 'aih_criticas_unidade', NULL, p_unidade,
    jsonb_build_object('tipo', p_critica, 'situacao', CASE WHEN p_bloqueante THEN 'bloqueante' ELSE 'aviso' END));
END $$;
REVOKE ALL ON FUNCTION public.definir_critica_aih(uuid, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_critica_aih(uuid, text, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.criticas_aih_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.membro_da_unidade(p_unidade) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN (SELECT jsonb_agg(jsonb_build_object(
            'codigo', k.codigo, 'titulo', k.titulo, 'padrao', k.bloqueante_padrao,
            'bloqueante', private.critica_bloqueante(p_unidade, k.codigo),
            'ajuste', (SELECT jsonb_build_object('motivo', c.motivo, 'por', p.nome_completo, 'em', c.definido_em)
                         FROM public.aih_criticas_unidade c LEFT JOIN public.perfis p ON p.id = c.definido_por
                        WHERE c.unidade_id = p_unidade AND c.critica = k.codigo AND c.vigente_ate IS NULL))
            ORDER BY k.ordem)
    FROM private.catalogo_criticas_aih() k);
END $$;
REVOKE ALL ON FUNCTION public.criticas_aih_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criticas_aih_da_unidade(uuid) TO authenticated;

-- ── as críticas ─────────────────────────────────────────────────────────────
-- competência mais recente da tabela SIGTAP carregada (NULL = não carregada)
CREATE OR REPLACE FUNCTION private.sigtap_competencia()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT max(competencia) FROM terminologia.sigtap_procedimento;
$$;
REVOKE ALL ON FUNCTION private.sigtap_competencia() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.sigtap_competencia() TO authenticated;

-- p_aih: o objeto "aih" do conteúdo do laudo (cid, cidSec, cidAssoc, procCod)
CREATE OR REPLACE FUNCTION private.criticas_aih(p_unidade uuid, p_paciente uuid, p_aih jsonb, p_autor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r jsonb := '[]'::jsonb;
  b jsonb := coalesce(p_aih, '{}'::jsonb);
  v_cid text := private.cid_normalizado(upper(split_part(btrim(coalesce(b ->> 'cid', '')), ' ', 1)));
  v_sec_txt text := split_part(btrim(coalesce(b ->> 'cidSec', '')), ' ', 1);
  v_sec text := private.cid_normalizado(upper(v_sec_txt));
  v_causa text := private.cid_normalizado(upper(split_part(btrim(coalesce(b ->> 'cidAssoc', '')), ' ', 1)));
  v_proc text := nullif(regexp_replace(coalesce(b ->> 'procCod', ''), '\D', '', 'g'), '');
  v_comp text := private.sigtap_competencia();
  v_cbo text;
  sp terminologia.sigtap_procedimento;
  rc terminologia.sigtap_procedimento_cid;
  pa public.pacientes;
  v_meses int;
BEGIN
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;

  IF v_cid IS NULL THEN
    r := r || jsonb_build_object('codigo', 'cid_principal', 'campo', '24', 'texto', 'CID principal ausente ou fora do formato (ex.: J18.9).');
  ELSIF NOT EXISTS (SELECT 1 FROM terminologia.cid10 WHERE codigo = v_cid) THEN
    r := r || jsonb_build_object('codigo', 'cid_principal', 'campo', '24', 'texto', 'CID principal ' || v_cid || ' não existe na tabela CID-10.');
  END IF;
  IF v_sec_txt <> '' AND (v_sec IS NULL OR NOT EXISTS (SELECT 1 FROM terminologia.cid10 WHERE codigo = v_sec)) THEN
    r := r || jsonb_build_object('codigo', 'cid_secundario', 'campo', '25', 'texto', 'CID secundário não encontrado na tabela CID-10.');
  END IF;
  IF v_cid ~ '^[ST]' AND (v_causa IS NULL OR left(v_causa, 3) NOT BETWEEN 'V01' AND 'Y98') THEN
    r := r || jsonb_build_object('codigo', 'causa_externa', 'campo', '26', 'texto', 'CID principal de lesão/envenenamento (S/T): informe a causa externa (V01–Y98) no campo 26.');
  END IF;

  IF v_comp IS NULL THEN
    r := r || jsonb_build_object('codigo', 'sigtap_desatualizado', 'campo', '28',
      'texto', 'Tabela SIGTAP não carregada: procedimento, compatibilidade com o CID, sexo e idade não foram conferidos.');
  ELSE
    IF v_comp < to_char((now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month', 'YYYYMM') THEN
      r := r || jsonb_build_object('codigo', 'sigtap_desatualizado', 'campo', '28',
        'texto', 'Tabela SIGTAP carregada é da competência ' || substr(v_comp, 5, 2) || '/' || left(v_comp, 4) || ': atualize a tabela (administração).');
    END IF;
    IF v_proc IS NULL THEN
      r := r || jsonb_build_object('codigo', 'procedimento_sigtap', 'campo', '28', 'texto', 'Código do procedimento ausente.');
    ELSE
      SELECT * INTO sp FROM terminologia.sigtap_procedimento WHERE codigo = v_proc;
      IF NOT FOUND THEN
        r := r || jsonb_build_object('codigo', 'procedimento_sigtap', 'campo', '28', 'texto', 'Procedimento ' || v_proc || ' não existe no SIGTAP carregado.');
      ELSE
        IF v_cid IS NOT NULL THEN
          SELECT * INTO rc FROM terminologia.sigtap_procedimento_cid WHERE procedimento = v_proc AND cid = v_cid;
          IF NOT FOUND THEN
            r := r || jsonb_build_object('codigo', 'cid_procedimento', 'campo', '28', 'texto', 'Procedimento não é compatível com o CID ' || v_cid || ' no SIGTAP (risco de glosa).');
          ELSIF NOT rc.principal THEN
            r := r || jsonb_build_object('codigo', 'cid_procedimento', 'campo', '24', 'texto', 'O CID ' || v_cid || ' é compatível com o procedimento só como secundário.');
          END IF;
        END IF;
        IF sp.sexo IN ('M', 'F') AND pa.sexo IN ('M', 'F') AND sp.sexo <> pa.sexo THEN
          r := r || jsonb_build_object('codigo', 'sexo', 'campo', '28', 'texto',
            'Procedimento exclusivo do sexo ' || CASE sp.sexo WHEN 'M' THEN 'masculino' ELSE 'feminino' END || '.');
        END IF;
        IF pa.data_nascimento IS NOT NULL THEN
          v_meses := (extract(year FROM age(current_date, pa.data_nascimento)) * 12 + extract(month FROM age(current_date, pa.data_nascimento)))::int;
          IF (sp.idade_min IS NOT NULL AND v_meses < sp.idade_min) OR (sp.idade_max IS NOT NULL AND v_meses > sp.idade_max) THEN
            r := r || jsonb_build_object('codigo', 'idade', 'campo', '28', 'texto',
              'Idade do paciente fora da faixa do procedimento no SIGTAP (' || coalesce(sp.idade_min, 0) || ' a ' || coalesce(sp.idade_max, 0) || ' meses).');
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- CNS vazio já é falta de cadastro; aqui só o número preenchido e inválido
  IF btrim(coalesce(pa.cns, '')) <> '' AND private.cns_valido(pa.cns) IS NOT TRUE THEN
    r := r || jsonb_build_object('codigo', 'cns', 'campo', '9', 'texto', 'Cartão SUS do paciente com dígito verificador inválido: corrija o cadastro.');
  END IF;
  -- CBO do solicitante (sem a lista oficial carregada, não se confere)
  IF EXISTS (SELECT 1 FROM terminologia.cbo) THEN
    SELECT p.cbo INTO v_cbo FROM public.perfis p WHERE p.id = p_autor;
    IF v_cbo IS NULL OR NOT EXISTS (SELECT 1 FROM terminologia.cbo c WHERE c.codigo = v_cbo) THEN
      r := r || jsonb_build_object('codigo', 'cbo', 'campo', '—', 'texto', 'CBO do médico solicitante ausente ou inválido: informe no seu perfil.');
    END IF;
  END IF;

  RETURN (SELECT coalesce(jsonb_agg(x || jsonb_build_object('bloqueante', private.critica_bloqueante(p_unidade, x ->> 'codigo'))), '[]'::jsonb)
            FROM jsonb_array_elements(r) x);
END $$;
REVOKE ALL ON FUNCTION private.criticas_aih(uuid, uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.criticas_aih(uuid, uuid, jsonb, uuid) TO authenticated;

-- conferência na tela do laudo: "avisos" como antes (SIGTAP/CID-10) e "criticas"
CREATE OR REPLACE FUNCTION public.conferir_aih(
  p_paciente uuid, p_cid_principal text, p_cid_secundario text DEFAULT NULL, p_cid_causa text DEFAULT NULL,
  p_procedimento text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c jsonb;
  v_unidade uuid;
BEGIN
  IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  c := private.criticas_aih(v_unidade, p_paciente,
         jsonb_build_object('cid', coalesce(p_cid_principal, ''), 'cidSec', coalesce(p_cid_secundario, ''),
                            'cidAssoc', coalesce(p_cid_causa, ''), 'procCod', coalesce(p_procedimento, '')),
         private.meu_perfil_id());
  RETURN jsonb_build_object(
    'avisos', (SELECT coalesce(jsonb_agg(jsonb_build_object('campo', x ->> 'campo', 'texto', x ->> 'texto')), '[]'::jsonb)
                 FROM jsonb_array_elements(c) x
                WHERE x ->> 'codigo' IN ('cid_principal', 'cid_secundario', 'causa_externa', 'procedimento_sigtap', 'cid_procedimento', 'sexo', 'idade')),
    'criticas', c,
    'competencia', private.sigtap_competencia(),
    'nota', 'Críticas da AIH: as bloqueantes impedem emitir o laudo; os avisos vão para o regulador. O gestor define o que bloqueia. Fonte: SIGTAP (DATASUS) e CID-10 carregados no banco.');
END $$;
REVOKE ALL ON FUNCTION public.conferir_aih(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conferir_aih(uuid, text, text, text, text) TO authenticated;

-- ── bloqueio na emissão e registro na AIH ───────────────────────────────────
CREATE OR REPLACE FUNCTION private.aih_do_laudo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.aihs; v_int uuid; v_antes text; c jsonb; v_bloq text;
BEGIN
  IF NEW.estado = 'ativo' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'ativo') THEN
    c := private.criticas_aih(NEW.unidade_id, NEW.paciente_id, private.json_seguro(NEW.conteudo) -> 'aih', NEW.autor_id);
    SELECT string_agg(x ->> 'texto', ' ') INTO v_bloq FROM jsonb_array_elements(c) x WHERE (x ->> 'bloqueante')::boolean;
    IF v_bloq IS NOT NULL AND NOT coalesce(NEW.sem_conexao, false) THEN
      RAISE EXCEPTION 'Crítica bloqueante da AIH: %', v_bloq;
    END IF;
    SELECT * INTO a FROM public.aihs
     WHERE laudo_raiz_id = NEW.documento_raiz_id AND status IN ('solicitada', 'aprovada') FOR UPDATE;
    IF FOUND THEN
      IF a.status = 'aprovada' THEN
        RAISE EXCEPTION 'AIH já aprovada (nº %): para mudar o laudo, o regulador cancela a AIH antes.', a.numero;
      END IF;
      UPDATE public.aihs SET laudo_id = NEW.id, criticas = c, sigtap_competencia = private.sigtap_competencia(), atualizada_em = now()
       WHERE id = a.id RETURNING * INTO a;
      PERFORM private.evento_aih(a, 'laudo_retificado', 'solicitada', NEW.motivo_retificacao, NEW.autor_id);
      RETURN NULL;
    END IF;
    v_int := coalesce(NEW.internacao_id, private.internacao_aberta(NEW.paciente_id));
    IF EXISTS (SELECT 1 FROM public.aihs x
                WHERE coalesce(x.internacao_id, x.episodio_id, x.paciente_id) = coalesce(v_int, NEW.episodio_id, NEW.paciente_id)
                  AND x.status IN ('solicitada', 'aprovada')) THEN
      RAISE EXCEPTION 'Já existe AIH solicitada ou aprovada para esta internação: retifique o laudo dela ou peça ao regulador que a cancele.';
    END IF;
    INSERT INTO public.aihs (unidade_id, paciente_id, internacao_id, episodio_id, laudo_raiz_id, laudo_id, solicitada_por, solicitada_em,
                             criticas, sigtap_competencia)
    VALUES (NEW.unidade_id, NEW.paciente_id, v_int, NEW.episodio_id, NEW.documento_raiz_id, NEW.id, NEW.autor_id,
            coalesce(NEW.emitido_em, now()), c, private.sigtap_competencia())
    RETURNING * INTO a;
    PERFORM private.evento_aih(a, 'solicitada', NULL, NULL, NEW.autor_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.estado = 'cancelado' AND OLD.estado IS DISTINCT FROM 'cancelado' THEN
    FOR a IN SELECT * FROM public.aihs WHERE laudo_raiz_id = NEW.documento_raiz_id AND status IN ('solicitada', 'aprovada') FOR UPDATE LOOP
      v_antes := a.status;
      UPDATE public.aihs SET status = 'cancelada', motivo = 'Laudo de AIH cancelado', atualizada_em = now()
       WHERE id = a.id RETURNING * INTO a;
      PERFORM private.evento_aih(a, 'cancelada', v_antes, 'Laudo de AIH cancelado', coalesce(NEW.cancelado_por, private.meu_perfil_id()));
    END LOOP;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.aih_do_laudo() FROM PUBLIC, anon, authenticated;

-- ── fila do regulador: críticas e alertas de prazo ──────────────────────────
CREATE OR REPLACE FUNCTION public.aihs_da_unidade(p_unidade uuid, p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.tenho_papel(p_unidade, 'regulador') OR private.tenho_papel(p_unidade, 'gestor') OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'AIH da unidade: regulador ou gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', a.id, 'status', a.status, 'numero', a.numero, 'competencia', a.competencia,
             'competencia_sugerida', private.competencia_sugerida(a.id),
             'paciente_id', a.paciente_id, 'paciente', coalesce(pa.nome_social, pa.nome), 'sexo', pa.sexo,
             'nascimento', pa.data_nascimento, 'cns', pa.cns,
             'local', coalesce((SELECT l.identificador FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id WHERE i.id = a.internacao_id),
                               (SELECT s.nome FROM public.setores s WHERE s.id = pa.setor_id)),
             'internacao_id', a.internacao_id, 'internado_em', it.data_admissao, 'alta_em', it.data_alta,
             'solicitada_por', ps.nome_completo, 'solicitada_em', a.solicitada_em, 'solicitada_por_mim', a.solicitada_por = private.meu_perfil_id(),
             'decidida_por', pd.nome_completo, 'decidida_em', a.decidida_em, 'motivo', a.motivo,
             'laudo_numero', d.numero, 'laudo_versao', d.versao,
             'carater', c->>'carater', 'diagnostico', c->>'diagnostico', 'cid', c->>'cid', 'cid_sec', c->>'cidSec',
             'proc_cod', c->>'procCod', 'proc_desc', c->>'procDesc', 'clinica', c->>'clinica',
             'criticas', a.criticas, 'sigtap_competencia', a.sigtap_competencia,
             -- prazos (pesquisa do NIR): 72 h da internação sem autorização; competência até 3 meses da alta
             'alerta_72h', a.status = 'solicitada' AND now() - coalesce(it.data_admissao, a.solicitada_em) > interval '72 hours',
             'alerta_competencia', a.competencia IS NOT NULL AND it.data_alta IS NOT NULL
                                   AND a.competencia > to_char((it.data_alta AT TIME ZONE 'America/Sao_Paulo') + interval '3 months', 'YYYYMM'))
             ORDER BY (a.status = 'solicitada') DESC, a.solicitada_em DESC)
      FROM public.aihs a
      JOIN public.pacientes pa ON pa.id = a.paciente_id
      JOIN public.documentos_clinicos d ON d.id = a.laudo_id
      LEFT JOIN public.internacoes it ON it.id = a.internacao_id
      LEFT JOIN public.perfis ps ON ps.id = a.solicitada_por
      LEFT JOIN public.perfis pd ON pd.id = a.decidida_por
      CROSS JOIN LATERAL (SELECT coalesce(private.json_seguro(d.conteudo) -> 'aih', '{}'::jsonb) AS c) j
     WHERE a.unidade_id = p_unidade AND (p_status IS NULL OR a.status = p_status)), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.aihs_da_unidade(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aihs_da_unidade(uuid, text) TO authenticated;

-- ── CBO no perfil ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.definir_meu_cbo(p_cbo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v text := nullif(regexp_replace(coalesce(p_cbo, ''), '\D', '', 'g'), ''); v_titulo text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF v IS NOT NULL THEN
    SELECT titulo INTO v_titulo FROM terminologia.cbo WHERE codigo = v;
    IF v_titulo IS NULL THEN RAISE EXCEPTION 'CBO % não está na lista oficial.', v; END IF;
  END IF;
  UPDATE public.perfis SET cbo = v WHERE id = private.meu_perfil_id();
  RETURN jsonb_build_object('cbo', v, 'titulo', v_titulo);
END $$;
REVOKE ALL ON FUNCTION public.definir_meu_cbo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_meu_cbo(text) TO authenticated;

-- busca na lista oficial do CBO (para o campo do perfil)
CREATE OR REPLACE FUNCTION public.buscar_cbo(p_termo text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('codigo', x.codigo, 'titulo', x.titulo)), '[]'::jsonb) FROM (
    SELECT c.codigo, c.titulo FROM terminologia.cbo c
     WHERE private.meu_perfil_id() IS NOT NULL AND length(btrim(coalesce(p_termo, ''))) >= 2
       AND (c.codigo LIKE regexp_replace(p_termo, '\D', '', 'g') || '%' AND regexp_replace(p_termo, '\D', '', 'g') <> ''
            OR c.busca @@ plainto_tsquery('portuguese', terminologia.unaccent_text(p_termo)))
     ORDER BY c.codigo LIMIT 20) x;
$$;
REVOKE ALL ON FUNCTION public.buscar_cbo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_cbo(text) TO authenticated;
