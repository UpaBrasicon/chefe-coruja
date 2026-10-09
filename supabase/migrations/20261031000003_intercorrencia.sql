-- Fase 2, tarefa 4 do BACKLOG.md — intercorrência estruturada.
--
-- Decisão do RT (08/10/2026): registram médico, enfermeiro e técnico de
-- enfermagem. Antes, a intercorrência era texto solto na evolução ou na
-- passagem de plantão; agora tem tipo, gravidade, hora em que ocorreu,
-- descrição, conduta, quem registrou (o usuário do login, com o papel) e o
-- vínculo ao atendimento da porta e/ou à internação.
--   • a lista de tipos é proposta para o RT revisar (tabela, não texto no
--     código); "Outra" pede o nome;
--   • gravidade em três níveis (leve, moderada, grave), com a definição na
--     tela;
--   • só inserção: corrigir é registrar de novo apontando a anterior
--     (retifica_id); a anterior continua visível como retificada;
--   • relatório do gestor por período, com nomes na trilha de auditoria (1
--     registro a cada 15 min), como nos demais indicadores.
-- Só aditiva.
--
-- ROLLBACK: DROP das funções novas; DROP TABLE public.intercorrencias, public.tipos_intercorrencia.

CREATE TABLE IF NOT EXISTS public.tipos_intercorrencia (
  codigo  text PRIMARY KEY,
  rotulo  text NOT NULL,
  ordem   int NOT NULL,
  ativo   boolean NOT NULL DEFAULT true
);
ALTER TABLE public.tipos_intercorrencia ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.tipos_intercorrencia FROM authenticated, anon;
DROP POLICY IF EXISTS tipos_intercorrencia_select ON public.tipos_intercorrencia;
CREATE POLICY tipos_intercorrencia_select ON public.tipos_intercorrencia FOR SELECT TO authenticated USING (true);
INSERT INTO public.tipos_intercorrencia (codigo, rotulo, ordem) VALUES
  ('pcr', 'Parada cardiorrespiratória', 10),
  ('instabilidade_hemodinamica', 'Instabilidade hemodinâmica (hipotensão, choque)', 20),
  ('insuficiencia_respiratoria', 'Desconforto ou insuficiência respiratória / dessaturação', 30),
  ('rebaixamento_consciencia', 'Rebaixamento do nível de consciência', 40),
  ('convulsao', 'Crise convulsiva', 50),
  ('dor_toracica', 'Dor torácica', 60),
  ('hipoglicemia', 'Hipoglicemia', 70),
  ('hiperglicemia', 'Hiperglicemia', 80),
  ('febre', 'Febre', 90),
  ('vomito_broncoaspiracao', 'Vômito / broncoaspiração', 100),
  ('sangramento', 'Sangramento', 110),
  ('reacao_medicamento', 'Reação adversa a medicamento', 120),
  ('reacao_transfusional', 'Reação transfusional', 130),
  ('erro_medicacao', 'Erro de medicação', 140),
  ('flebite_extravasamento', 'Flebite / infiltração / extravasamento', 150),
  ('perda_dispositivo', 'Perda ou retirada acidental de dispositivo (acesso, sonda, dreno, tubo)', 160),
  ('queda', 'Queda', 170),
  ('lesao_pele', 'Lesão por pressão ou de pele', 180),
  ('agitacao', 'Agitação psicomotora / agressividade', 190),
  ('evasao', 'Evasão do paciente', 200),
  ('outra', 'Outra (descrever)', 999)
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.intercorrencias (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id    uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id    uuid REFERENCES public.episodios(id),
  internacao_id  uuid REFERENCES public.internacoes(id),
  setor_id       uuid REFERENCES public.setores(id),
  tipo           text NOT NULL REFERENCES public.tipos_intercorrencia(codigo),
  tipo_outro     text,
  gravidade      text NOT NULL CHECK (gravidade IN ('leve', 'moderada', 'grave')),
  ocorrida_em    timestamptz NOT NULL,
  descricao      text NOT NULL CHECK (length(btrim(descricao)) >= 10),
  conduta        text NOT NULL CHECK (length(btrim(conduta)) >= 5),
  retifica_id    uuid REFERENCES public.intercorrencias(id),
  registrado_por uuid NOT NULL REFERENCES public.perfis(id),
  papel          text NOT NULL,
  registrado_em  timestamptz NOT NULL DEFAULT now(),
  CHECK (episodio_id IS NOT NULL OR internacao_id IS NOT NULL),
  CHECK (tipo <> 'outra' OR length(btrim(coalesce(tipo_outro, ''))) >= 3)
);
CREATE INDEX IF NOT EXISTS intercorrencias_paciente ON public.intercorrencias (paciente_id, ocorrida_em DESC);
CREATE INDEX IF NOT EXISTS intercorrencias_unidade ON public.intercorrencias (unidade_id, ocorrida_em DESC);
ALTER TABLE public.intercorrencias ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.intercorrencias FROM authenticated, anon;
REVOKE SELECT ON public.intercorrencias FROM authenticated, anon;   -- leitura só pelas RPCs (há nome de paciente no relatório)

CREATE OR REPLACE FUNCTION private.intercorrencia_so_insercao() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'Intercorrência é só de inserção: para corrigir, registre de novo retificando a anterior.'; END $$;
DROP TRIGGER IF EXISTS intercorrencias_so_insercao ON public.intercorrencias;
CREATE TRIGGER intercorrencias_so_insercao BEFORE UPDATE OR DELETE ON public.intercorrencias
  FOR EACH ROW EXECUTE FUNCTION private.intercorrencia_so_insercao();

-- quem registra: médico, enfermeiro ou técnico de enfermagem de plantão com o paciente
CREATE OR REPLACE FUNCTION public.registrar_intercorrencia(
  p_paciente uuid, p_episodio uuid, p_internacao uuid, p_tipo text, p_tipo_outro text, p_gravidade text,
  p_ocorrida_em timestamptz, p_descricao text, p_conduta text, p_retifica uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pa public.pacientes;
  v_papel text;
  v_setor uuid;
  v_id uuid;
  ant public.intercorrencias;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF pa.id IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  v_papel := CASE
    WHEN private.tenho_papel(pa.unidade_id, 'plantonista') IS TRUE THEN 'plantonista'
    WHEN private.tenho_papel(pa.unidade_id, 'enfermeiro') IS TRUE THEN 'enfermeiro'
    WHEN private.tenho_papel(pa.unidade_id, 'tecnico_enfermagem') IS TRUE THEN 'tecnico_enfermagem' END;
  IF v_papel IS NULL OR NOT private.paciente_no_meu_plantao(pa.id) THEN
    RAISE EXCEPTION 'A intercorrência é registrada por médico, enfermeiro ou técnico de enfermagem de plantão com o paciente.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_episodio IS NULL AND p_internacao IS NULL THEN RAISE EXCEPTION 'Diga o atendimento ou a internação.'; END IF;
  IF p_episodio IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios WHERE id = p_episodio AND paciente_id = pa.id) THEN
    RAISE EXCEPTION 'O atendimento não é deste paciente.';
  END IF;
  IF p_internacao IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.internacoes WHERE id = p_internacao AND paciente_id = pa.id) THEN
    RAISE EXCEPTION 'A internação não é deste paciente.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tipos_intercorrencia WHERE codigo = p_tipo AND ativo) THEN RAISE EXCEPTION 'Tipo de intercorrência desconhecido.'; END IF;
  IF p_tipo = 'outra' AND length(btrim(coalesce(p_tipo_outro, ''))) < 3 THEN RAISE EXCEPTION 'Diga qual é a intercorrência.'; END IF;
  IF p_gravidade IS NULL OR p_gravidade NOT IN ('leve', 'moderada', 'grave') THEN RAISE EXCEPTION 'Escolha a gravidade.'; END IF;
  IF p_ocorrida_em IS NULL OR p_ocorrida_em > now() + interval '5 minutes' OR p_ocorrida_em < now() - interval '72 hours' THEN
    RAISE EXCEPTION 'Hora da intercorrência entre as últimas 72 horas e agora.';
  END IF;
  IF length(btrim(coalesce(p_descricao, ''))) < 10 THEN RAISE EXCEPTION 'Descreva o que aconteceu (mínimo de 10 letras).'; END IF;
  IF length(btrim(coalesce(p_conduta, ''))) < 5 THEN RAISE EXCEPTION 'Diga a conduta tomada.'; END IF;
  IF p_retifica IS NOT NULL THEN
    SELECT * INTO ant FROM public.intercorrencias WHERE id = p_retifica;
    IF ant.id IS NULL OR ant.paciente_id <> pa.id THEN RAISE EXCEPTION 'A intercorrência a retificar não é deste paciente.'; END IF;
    IF EXISTS (SELECT 1 FROM public.intercorrencias WHERE retifica_id = p_retifica) THEN
      RAISE EXCEPTION 'Esta intercorrência já foi retificada: retifique a versão mais nova.';
    END IF;
  END IF;
  v_setor := coalesce((SELECT i.setor_atual_id FROM public.internacoes i WHERE i.id = p_internacao),
                      (SELECT e.setor_id FROM public.episodios e WHERE e.id = p_episodio), pa.setor_id);
  INSERT INTO public.intercorrencias (unidade_id, paciente_id, episodio_id, internacao_id, setor_id, tipo, tipo_outro, gravidade,
                                      ocorrida_em, descricao, conduta, retifica_id, registrado_por, papel)
  VALUES (pa.unidade_id, pa.id, p_episodio, p_internacao, v_setor, p_tipo, nullif(btrim(coalesce(p_tipo_outro, '')), ''), p_gravidade,
          p_ocorrida_em, btrim(p_descricao), btrim(p_conduta), p_retifica, private.meu_perfil_id(), v_papel)
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('registrar_intercorrencia', 'pacientes', pa.id, pa.unidade_id,
    jsonb_build_object('intercorrencia', v_id, 'tipo', p_tipo, 'gravidade', p_gravidade, 'retifica', p_retifica));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_intercorrencia(uuid, uuid, uuid, text, text, text, timestamptz, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_intercorrencia(uuid, uuid, uuid, text, text, text, timestamptz, text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.intercorrencia_json(x public.intercorrencias)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', x.id, 'episodio_id', x.episodio_id, 'internacao_id', x.internacao_id,
    'tipo', x.tipo, 'tipo_rotulo', CASE WHEN x.tipo = 'outra' THEN x.tipo_outro ELSE t.rotulo END,
    'gravidade', x.gravidade, 'ocorrida_em', x.ocorrida_em, 'descricao', x.descricao, 'conduta', x.conduta,
    'setor', s.nome, 'registrado_por', p.nome_completo, 'papel', x.papel, 'registrado_em', x.registrado_em,
    'retifica_id', x.retifica_id,
    'retificada', EXISTS (SELECT 1 FROM public.intercorrencias r WHERE r.retifica_id = x.id))
  FROM public.tipos_intercorrencia t
  LEFT JOIN public.setores s ON s.id = x.setor_id
  LEFT JOIN public.perfis p ON p.id = x.registrado_por
  WHERE t.codigo = x.tipo;
$$;
REVOKE ALL ON FUNCTION private.intercorrencia_json(public.intercorrencias) FROM PUBLIC, anon;

-- na tela do atendimento / leito: as intercorrências do paciente, da mais nova
CREATE OR REPLACE FUNCTION public.intercorrencias_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pa public.pacientes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF pa.id IS NULL OR NOT (private.gestor_da_unidade(pa.unidade_id) OR private.pode_atuar_no_paciente(pa.id)
                           OR private.acesso_encerrado_vigente(pa.id)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(private.intercorrencia_json(x) ORDER BY x.ocorrida_em DESC, x.registrado_em DESC)
                     FROM public.intercorrencias x WHERE x.paciente_id = pa.id), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.intercorrencias_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.intercorrencias_do_paciente(uuid) TO authenticated;

-- relatório do gestor: por tipo, gravidade, setor e papel; casos com nome (na trilha)
CREATE OR REPLACE FUNCTION public.relatorio_intercorrencias(p_unidade uuid, p_de date, p_ate date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_res jsonb; v_ator uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: relatório do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_de IS NULL OR p_ate IS NULL OR p_ate < p_de OR p_ate - p_de > 366 THEN RAISE EXCEPTION 'Período inválido (até 1 ano).'; END IF;
  WITH v AS (   -- vale a versão mais nova (a retificada sai da conta)
    SELECT x.* FROM public.intercorrencias x
     WHERE x.unidade_id = p_unidade
       AND x.ocorrida_em >= (p_de::timestamp AT TIME ZONE 'America/Sao_Paulo')
       AND x.ocorrida_em < ((p_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
       AND NOT EXISTS (SELECT 1 FROM public.intercorrencias r WHERE r.retifica_id = x.id))
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM v),
    'por_gravidade', coalesce((SELECT jsonb_object_agg(g, n) FROM (SELECT v.gravidade g, count(*) n FROM v GROUP BY 1) a), '{}'::jsonb),
    'por_tipo', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo', a.rotulo, 'total', a.n, 'graves', a.graves) ORDER BY a.n DESC, a.rotulo)
                            FROM (SELECT t.rotulo, count(*) n, count(*) FILTER (WHERE v.gravidade = 'grave') graves
                                    FROM v JOIN public.tipos_intercorrencia t ON t.codigo = v.tipo GROUP BY t.rotulo) a), '[]'::jsonb),
    'por_setor', coalesce((SELECT jsonb_agg(jsonb_build_object('setor', a.nome, 'total', a.n) ORDER BY a.n DESC)
                             FROM (SELECT coalesce(s.nome, '—') nome, count(*) n FROM v LEFT JOIN public.setores s ON s.id = v.setor_id GROUP BY 1) a), '[]'::jsonb),
    'por_papel', coalesce((SELECT jsonb_object_agg(p, n) FROM (SELECT v.papel p, count(*) n FROM v GROUP BY 1) a), '{}'::jsonb),
    'casos', coalesce((SELECT jsonb_agg(private.intercorrencia_json(c) || jsonb_build_object('paciente', coalesce(pa.nome_social, pa.nome))
                                        ORDER BY c.ocorrida_em DESC)
                         FROM public.intercorrencias c
                         JOIN public.pacientes pa ON pa.id = c.paciente_id
                        WHERE c.id IN (SELECT v.id FROM v ORDER BY v.ocorrida_em DESC LIMIT 300)), '[]'::jsonb))
    INTO v_res;
  -- nome de paciente na tela do gestor: fica na trilha (1 registro a cada 15 min)
  IF jsonb_array_length(v_res -> 'casos') > 0 AND NOT EXISTS (
       SELECT 1 FROM public.log_auditoria a
        WHERE a.ator_id = v_ator AND a.unidade_id = p_unidade AND a.acao = 'ver_intercorrencias'
          AND a.created_at > now() - interval '15 minutes') THEN
    PERFORM private.registrar_auditoria('ver_intercorrencias', 'pacientes', NULL, p_unidade,
      jsonb_build_object('de', p_de, 'ate', p_ate, 'casos', jsonb_array_length(v_res -> 'casos')));
  END IF;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.relatorio_intercorrencias(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_intercorrencias(uuid, date, date) TO authenticated;
