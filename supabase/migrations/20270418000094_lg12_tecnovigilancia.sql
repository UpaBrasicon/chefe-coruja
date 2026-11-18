-- ════════════════════════════════════════════════════════════════════════════
-- LG12, decisões V1–V5 = A do RT (18/11/2026,
-- docs/regulatorio/LG12-TECNOVIGILANCIA-DIAGNOSTICO.md): tecnovigilância do
-- módulo clínico (RDC 67/2009; RDC 551/2021).
--   V1: relato de problema em cada ferramenta e aviso; vai para a fila da
--       Chefe Coruja (RT médico e super admin); o gestor da unidade vê os da
--       unidade. O texto não pode ter CPF, CNS nem telefone.
--   V2: prazo do art. 8º desde já (óbito 72 h; grave 10 dias; o resto 30
--       dias); andamento só de inclusão; conclusão para quem relatou; relato
--       grave avisa o RT por e-mail (função avisar-tecnovigilancia).
--   V3: guarda de 5 anos depois da conclusão, apagada por rotina com registro.
--   V4: o RT suspende uma versão na rede toda; situacao_ferramenta mostra.
--   V5: designação do responsável e Notivisa ficam nos documentos.
--
-- Expand: cria tabelas, funções e um agendamento; troca situacao_ferramenta
-- (acrescenta só a chave suspensa_rede).
-- Volta: docs/regulatorio/LG12-ROLLBACK-20270418000094.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. tabelas ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.tecnovigilancia_relatos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero        bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  ferramenta_id text NOT NULL CHECK (ferramenta_id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  versao        text CHECK (versao IS NULL OR length(versao) BETWEEN 1 AND 40),
  unidade_id    uuid,
  relatado_por  uuid NOT NULL,
  relatado_em   timestamptz NOT NULL DEFAULT now(),
  tipo          text NOT NULL CHECK (tipo IN ('conteudo', 'sistema', 'paciente')),
  desfecho      text CHECK (desfecho IN ('sem_dano', 'dano_temporario', 'grave', 'obito')),
  descricao     text NOT NULL CHECK (length(btrim(descricao)) BETWEEN 10 AND 2000),
  prazo_em      timestamptz NOT NULL,
  prazo_legal   boolean NOT NULL,
  grave         boolean NOT NULL,
  CHECK ((tipo = 'paciente') = (desfecho IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS tecnovigilancia_relatos_unidade_idx ON private.tecnovigilancia_relatos (unidade_id, relatado_em);
CREATE INDEX IF NOT EXISTS tecnovigilancia_relatos_autor_idx ON private.tecnovigilancia_relatos (relatado_por, relatado_em);

CREATE TABLE IF NOT EXISTS private.tecnovigilancia_andamento (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  relato_id  uuid NOT NULL REFERENCES private.tecnovigilancia_relatos(id) ON DELETE CASCADE,
  em         timestamptz NOT NULL DEFAULT clock_timestamp(),
  por        uuid,
  situacao   text NOT NULL CHECK (situacao IN ('recebido', 'em_investigacao', 'concluido', 'aviso_rt')),
  texto      text CHECK (texto IS NULL OR length(texto) <= 4000),
  causa      text CHECK (causa IS NULL OR length(causa) <= 2000),
  acao       text CHECK (acao IS NULL OR length(acao) <= 2000),
  versao_corrigida text CHECK (versao_corrigida IS NULL OR length(versao_corrigida) <= 40)
);
CREATE INDEX IF NOT EXISTS tecnovigilancia_andamento_relato_idx ON private.tecnovigilancia_andamento (relato_id, em);

CREATE TABLE IF NOT EXISTS private.tecnovigilancia_suspensoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ferramenta_id text NOT NULL,
  versao        text NOT NULL,
  relato_id     uuid REFERENCES private.tecnovigilancia_relatos(id) ON DELETE SET NULL,
  motivo        text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 10 AND 500),
  suspensa_por  uuid NOT NULL,
  suspensa_em   timestamptz NOT NULL DEFAULT now(),
  encerrada_por uuid,
  encerrada_em  timestamptz,
  nota_encerramento text CHECK (nota_encerramento IS NULL OR length(nota_encerramento) <= 500)
);
CREATE UNIQUE INDEX IF NOT EXISTS tecnovigilancia_suspensao_vigente_idx
  ON private.tecnovigilancia_suspensoes (ferramenta_id, versao) WHERE encerrada_em IS NULL;

ALTER TABLE private.tecnovigilancia_relatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.tecnovigilancia_andamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.tecnovigilancia_suspensoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.tecnovigilancia_relatos, private.tecnovigilancia_andamento, private.tecnovigilancia_suspensoes
  FROM PUBLIC, anon, authenticated;

-- relato e andamento: só inclusão (a rotina de guarda apaga a linha inteira)
CREATE OR REPLACE FUNCTION private.tecnovigilancia_so_inclusao()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Registro de tecnovigilância é só de inclusão.';
END $$;
DROP TRIGGER IF EXISTS tecnovigilancia_relatos_so_inclusao ON private.tecnovigilancia_relatos;
CREATE TRIGGER tecnovigilancia_relatos_so_inclusao BEFORE UPDATE ON private.tecnovigilancia_relatos
  FOR EACH ROW EXECUTE FUNCTION private.tecnovigilancia_so_inclusao();
DROP TRIGGER IF EXISTS tecnovigilancia_andamento_so_inclusao ON private.tecnovigilancia_andamento;
CREATE TRIGGER tecnovigilancia_andamento_so_inclusao BEFORE UPDATE ON private.tecnovigilancia_andamento
  FOR EACH ROW EXECUTE FUNCTION private.tecnovigilancia_so_inclusao();

-- ── 2. apoio ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.sou_rt_medico()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.responsaveis_tecnicos r
                  WHERE r.perfil_id = private.meu_perfil_id() AND r.tipo = 'medico' AND r.ativo)
$$;

-- V1: CPF (com ou sem pontos), CNS (15 dígitos) ou telefone com DDD no texto
CREATE OR REPLACE FUNCTION private.tem_dado_pessoal(p_texto text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(p_texto, '') ~ '\d{3}\.\d{3}\.\d{3}-?\d{2}'
      OR regexp_replace(coalesce(p_texto, ''), '[\s.-]', '', 'g') ~ '(^|\D)\d{11}(\D|$)'
      OR regexp_replace(coalesce(p_texto, ''), '\s', '', 'g') ~ '(^|\D)[1-9]\d{14}(\D|$)'
      OR coalesce(p_texto, '') ~ '\(?\d{2}\)?\s?9?\d{4}[\s-]\d{4}'
$$;

CREATE OR REPLACE FUNCTION private.tecnovigilancia_situacao(p_relato uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT a.situacao FROM private.tecnovigilancia_andamento a
   WHERE a.relato_id = p_relato AND a.situacao IN ('recebido', 'em_investigacao', 'concluido')
   ORDER BY a.em DESC, a.id DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.tecnovigilancia_json(r private.tecnovigilancia_relatos, p_completo boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', r.id, 'numero', r.numero, 'ferramenta_id', r.ferramenta_id, 'versao', r.versao,
    'ferramenta_titulo', (SELECT f.titulo FROM public.ferramentas_clinicas f WHERE f.id = r.ferramenta_id),
    'unidade', (SELECT u.nome FROM public.unidades u WHERE u.id = r.unidade_id),
    'relatado_em', r.relatado_em, 'tipo', r.tipo, 'desfecho', r.desfecho, 'descricao', r.descricao,
    'prazo_em', r.prazo_em, 'prazo_legal', r.prazo_legal, 'grave', r.grave,
    'situacao', private.tecnovigilancia_situacao(r.id),
    'relatado_por', CASE WHEN p_completo THEN (SELECT p.nome_completo FROM public.perfis p WHERE p.id = r.relatado_por) END,
    'andamento', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'em', a.em, 'situacao', a.situacao, 'texto', a.texto, 'causa', a.causa, 'acao', a.acao,
        'versao_corrigida', a.versao_corrigida,
        'por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = a.por)) ORDER BY a.em, a.id), '[]'::jsonb)
      FROM private.tecnovigilancia_andamento a
     WHERE a.relato_id = r.id AND (p_completo OR a.situacao <> 'aviso_rt')),
    'suspensao', (SELECT jsonb_build_object('id', s.id, 'motivo', s.motivo, 'em', s.suspensa_em)
                    FROM private.tecnovigilancia_suspensoes s
                   WHERE s.ferramenta_id = r.ferramenta_id AND s.versao = r.versao AND s.encerrada_em IS NULL LIMIT 1))
$$;

-- ── 3. relatar (V1, V2) ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.relatar_tecnovigilancia(
  p_ferramenta text, p_versao text, p_unidade uuid, p_tipo text, p_desfecho text, p_descricao text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_prazo interval; v_legal boolean; v_grave boolean;
  r private.tecnovigilancia_relatos;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Sem sessão' USING ERRCODE = '42501'; END IF;
  IF p_unidade IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = v_perfil
                                              AND v.unidade_id = p_unidade AND v.ativo) THEN
    RAISE EXCEPTION 'Você não tem vínculo com esta unidade.' USING ERRCODE = '42501';
  END IF;
  IF p_tipo IS NULL OR p_tipo NOT IN ('conteudo', 'sistema', 'paciente') THEN
    RAISE EXCEPTION 'Diga o tipo do problema.';
  END IF;
  IF (p_tipo = 'paciente') <> (p_desfecho IS NOT NULL) THEN
    RAISE EXCEPTION 'Quando o problema chegou ao paciente, diga o desfecho; nos outros casos, não.';
  END IF;
  IF length(btrim(coalesce(p_descricao, ''))) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Descreva o problema (de 10 a 2000 caracteres).';
  END IF;
  IF private.tem_dado_pessoal(p_descricao) THEN
    RAISE EXCEPTION 'O texto parece ter CPF, CNS ou telefone. Tire o dado do paciente e envie de novo.';
  END IF;
  -- RDC 67/2009, art. 8º: óbito 72 h; grave 10 dias; queixa técnica 30 dias
  v_grave := p_desfecho IN ('grave', 'obito');
  v_prazo := CASE WHEN p_desfecho = 'obito' THEN interval '72 hours'
                  WHEN p_desfecho = 'grave' THEN interval '10 days'
                  ELSE interval '30 days' END;
  v_legal := p_tipo IN ('conteudo', 'paciente');

  INSERT INTO private.tecnovigilancia_relatos (ferramenta_id, versao, unidade_id, relatado_por, tipo, desfecho, descricao,
                                               prazo_em, prazo_legal, grave)
  VALUES (p_ferramenta, nullif(btrim(p_versao), ''), p_unidade, v_perfil, p_tipo, p_desfecho, btrim(p_descricao),
          now() + v_prazo, v_legal, coalesce(v_grave, false))
  RETURNING * INTO r;
  INSERT INTO private.tecnovigilancia_andamento (relato_id, por, situacao) VALUES (r.id, v_perfil, 'recebido');
  PERFORM private.registrar_auditoria('relatar_tecnovigilancia', 'tecnovigilancia_relatos', r.id, p_unidade,
    jsonb_build_object('tipo', p_tipo, 'gravidade', coalesce(p_desfecho, 'sem_paciente'), 'versao', r.versao));
  RETURN jsonb_build_object('id', r.id, 'numero', r.numero, 'grave', r.grave, 'prazo_em', r.prazo_em);
END $$;

-- ── 4. leitura ──────────────────────────────────────────────────────────────
-- fila da Chefe Coruja: RT médico nomeado ou super admin
CREATE OR REPLACE FUNCTION public.fila_tecnovigilancia()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (private.sou_rt_medico() OR private.eh_super_admin() IS TRUE) THEN
    RAISE EXCEPTION 'A fila de tecnovigilância é do responsável técnico.' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(j ORDER BY (j ->> 'situacao') = 'concluido', (j ->> 'prazo_em')), '[]'::jsonb)
            FROM (SELECT private.tecnovigilancia_json(r, true) j FROM private.tecnovigilancia_relatos r) x);
END $$;

-- cópia do gestor (V1): os relatos da unidade dele
CREATE OR REPLACE FUNCTION public.tecnovigilancia_da_unidade(p_unidade uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (private.tenho_papel(p_unidade, 'gestor') OR private.eh_super_admin() IS TRUE) THEN
    RAISE EXCEPTION 'Só o gestor da unidade vê os relatos da unidade.' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(private.tecnovigilancia_json(r, true) ORDER BY r.relatado_em DESC), '[]'::jsonb)
            FROM private.tecnovigilancia_relatos r WHERE r.unidade_id = p_unidade);
END $$;

-- quem relatou vê o andamento e a conclusão (RDC 67, art. 6º, XI)
CREATE OR REPLACE FUNCTION public.meus_relatos_tecnovigilancia()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(private.tecnovigilancia_json(r, false) ORDER BY r.relatado_em DESC), '[]'::jsonb)
    FROM private.tecnovigilancia_relatos r WHERE r.relatado_por = private.meu_perfil_id()
$$;

-- ── 5. investigação e conclusão (V2) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.andamento_tecnovigilancia(
  p_relato uuid, p_situacao text, p_texto text, p_causa text DEFAULT NULL, p_acao text DEFAULT NULL,
  p_versao_corrigida text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_atual text; v_unidade uuid;
BEGIN
  IF NOT (private.sou_rt_medico() OR private.eh_super_admin() IS TRUE) THEN
    RAISE EXCEPTION 'Só o responsável técnico investiga e conclui.' USING ERRCODE = '42501';
  END IF;
  PERFORM private.exigir_segundo_fator();
  SELECT r.unidade_id INTO v_unidade FROM private.tecnovigilancia_relatos r WHERE r.id = p_relato;
  IF NOT FOUND THEN RAISE EXCEPTION 'Relato não encontrado.'; END IF;
  v_atual := private.tecnovigilancia_situacao(p_relato);
  IF v_atual = 'concluido' THEN RAISE EXCEPTION 'Relato já concluído.'; END IF;
  IF p_situacao IS NULL OR p_situacao NOT IN ('em_investigacao', 'concluido') THEN
    RAISE EXCEPTION 'Situação inválida.';
  END IF;
  IF length(btrim(coalesce(p_texto, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o andamento (pelo menos 10 caracteres).'; END IF;
  IF p_situacao = 'concluido' AND (length(btrim(coalesce(p_causa, ''))) < 5 OR length(btrim(coalesce(p_acao, ''))) < 5) THEN
    RAISE EXCEPTION 'A conclusão diz a causa e a ação tomada.';
  END IF;
  IF private.tem_dado_pessoal(concat_ws(' ', p_texto, p_causa, p_acao)) THEN
    RAISE EXCEPTION 'O texto parece ter CPF, CNS ou telefone. Tire o dado do paciente.';
  END IF;
  INSERT INTO private.tecnovigilancia_andamento (relato_id, por, situacao, texto, causa, acao, versao_corrigida)
  VALUES (p_relato, private.meu_perfil_id(), p_situacao, btrim(p_texto), nullif(btrim(p_causa), ''),
          nullif(btrim(p_acao), ''), nullif(btrim(p_versao_corrigida), ''));
  PERFORM private.registrar_auditoria('andamento_tecnovigilancia', 'tecnovigilancia_relatos', p_relato, v_unidade,
    jsonb_build_object('situacao', p_situacao));
END $$;

-- ── 6. suspensão na rede (V4) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.suspender_versao_rede(p_ferramenta text, p_versao text, p_motivo text, p_relato uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT private.sou_rt_medico() THEN
    RAISE EXCEPTION 'Só o responsável técnico médico suspende uma versão na rede.' USING ERRCODE = '42501';
  END IF;
  PERFORM private.exigir_segundo_fator();
  IF NOT EXISTS (SELECT 1 FROM public.ferramentas_clinicas f WHERE f.id = p_ferramenta) THEN
    RAISE EXCEPTION 'Ferramenta não encontrada: %', p_ferramenta;
  END IF;
  IF length(btrim(coalesce(p_versao, ''))) = 0 THEN RAISE EXCEPTION 'Diga a versão.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Escreva o motivo (de 10 a 500 caracteres).';
  END IF;
  IF EXISTS (SELECT 1 FROM private.tecnovigilancia_suspensoes s
              WHERE s.ferramenta_id = p_ferramenta AND s.versao = btrim(p_versao) AND s.encerrada_em IS NULL) THEN
    RAISE EXCEPTION 'Esta versão já está suspensa.';
  END IF;
  INSERT INTO private.tecnovigilancia_suspensoes (ferramenta_id, versao, relato_id, motivo, suspensa_por)
  VALUES (p_ferramenta, btrim(p_versao), p_relato, btrim(p_motivo), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('suspender_versao_rede', 'tecnovigilancia_suspensoes', v_id, NULL,
    jsonb_build_object('versao', btrim(p_versao), 'situacao', 'suspensa'));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.encerrar_suspensao_rede(p_suspensao uuid, p_nota text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.sou_rt_medico() THEN
    RAISE EXCEPTION 'Só o responsável técnico médico encerra a suspensão.' USING ERRCODE = '42501';
  END IF;
  PERFORM private.exigir_segundo_fator();
  IF length(btrim(coalesce(p_nota, ''))) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Escreva por que a suspensão acaba (de 10 a 500 caracteres).';
  END IF;
  UPDATE private.tecnovigilancia_suspensoes
     SET encerrada_em = now(), encerrada_por = private.meu_perfil_id(), nota_encerramento = btrim(p_nota)
   WHERE id = p_suspensao AND encerrada_em IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Suspensão não encontrada ou já encerrada.'; END IF;
  PERFORM private.registrar_auditoria('encerrar_suspensao_rede', 'tecnovigilancia_suspensoes', p_suspensao, NULL,
    jsonb_build_object('situacao', 'encerrada'));
END $$;

CREATE OR REPLACE FUNCTION public.suspensoes_rede_vigentes()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'ferramenta_id', s.ferramenta_id, 'versao', s.versao,
           'motivo', s.motivo, 'em', s.suspensa_em,
           'relato', (SELECT r.numero FROM private.tecnovigilancia_relatos r WHERE r.id = s.relato_id)) ORDER BY s.suspensa_em), '[]'::jsonb)
    FROM private.tecnovigilancia_suspensoes s WHERE s.encerrada_em IS NULL
$$;

-- situação que a tela mostra (LG13) + suspensão na rede (LG12, V4)
CREATE OR REPLACE FUNCTION public.situacao_ferramenta(p_ferramenta text, p_versao text, p_unidade uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'registrada', v.id IS NOT NULL,
    'status', coalesce(v.status, 'nao_registrada'),
    'decidida_por', p.nome_completo,
    'decisao_registro', v.decisao_registro,
    'decidida_em', v.decidida_em,
    'decisao_nota', v.decisao_nota,
    'revisoes_exigidas', (SELECT to_jsonb(f.revisoes_exigidas) FROM public.ferramentas_clinicas f WHERE f.id = p_ferramenta),
    'revisoes_pendentes', CASE WHEN v.id IS NULL THEN NULL ELSE to_jsonb(private.revisoes_pendentes(v.id, false)) END,
    'unidade', CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object(
      'oculta', u.oculta, 'nota_local', u.nota_local, 'definida_em', u.vigente_desde,
      'definida_por', (SELECT pp.nome_completo FROM public.perfis pp WHERE pp.id = u.definida_por)) END,
    'suspensa_rede', (SELECT jsonb_build_object('motivo', s.motivo, 'em', s.suspensa_em,
                        'relato', (SELECT r.numero FROM private.tecnovigilancia_relatos r WHERE r.id = s.relato_id))
                        FROM private.tecnovigilancia_suspensoes s
                       WHERE s.ferramenta_id = p_ferramenta AND s.versao = p_versao AND s.encerrada_em IS NULL LIMIT 1))
  FROM (SELECT 1) x
  LEFT JOIN public.ferramenta_versoes v ON v.ferramenta_id = p_ferramenta AND v.versao = p_versao
  LEFT JOIN public.perfis p ON p.id = v.decidida_por
  LEFT JOIN public.ferramenta_unidade u ON u.ferramenta_id = p_ferramenta AND u.unidade_id = p_unidade
        AND u.vigente_ate IS NULL
        AND EXISTS (SELECT 1 FROM public.vinculos vv WHERE vv.perfil_id = private.meu_perfil_id()
                     AND vv.unidade_id = p_unidade AND vv.ativo)
$$;

-- ── 7. aviso ao RT por e-mail (V2), só pela função avisar-tecnovigilancia ──
-- p_marcar = false: devolve os dados (relato grave ainda não avisado);
-- p_marcar = true: anota o aviso, depois que o e-mail saiu. Sem dado do paciente.
CREATE OR REPLACE FUNCTION public.aviso_tecnovigilancia(p_relato uuid, p_marcar boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r private.tecnovigilancia_relatos;
BEGIN
  SELECT * INTO r FROM private.tecnovigilancia_relatos WHERE id = p_relato;
  IF NOT FOUND OR NOT r.grave
     OR EXISTS (SELECT 1 FROM private.tecnovigilancia_andamento a WHERE a.relato_id = r.id AND a.situacao = 'aviso_rt') THEN
    RETURN NULL;
  END IF;
  IF p_marcar THEN
    INSERT INTO private.tecnovigilancia_andamento (relato_id, situacao, texto)
    VALUES (r.id, 'aviso_rt', 'E-mail ao responsável técnico enviado.');
    RETURN jsonb_build_object('marcado', true);
  END IF;
  RETURN jsonb_build_object(
    'numero', r.numero, 'ferramenta_id', r.ferramenta_id, 'versao', r.versao, 'tipo', r.tipo, 'desfecho', r.desfecho,
    'unidade', (SELECT u.nome FROM public.unidades u WHERE u.id = r.unidade_id),
    'relatado_em', r.relatado_em, 'prazo_em', r.prazo_em,
    'destinatarios', coalesce(
      (SELECT jsonb_agg(DISTINCT au.email) FROM public.responsaveis_tecnicos t JOIN auth.users au ON au.id = t.perfil_id
        WHERE t.tipo = 'medico' AND t.ativo AND au.email IS NOT NULL),
      (SELECT jsonb_agg(DISTINCT au.email) FROM public.super_admins s JOIN auth.users au ON au.id = s.perfil_id
        WHERE au.email IS NOT NULL),
      '[]'::jsonb));
END $$;

-- ── 8. guarda de 5 anos (V3) ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.apagar_tecnovigilancia_vencida()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int;
BEGIN
  DELETE FROM private.tecnovigilancia_relatos r
   WHERE EXISTS (SELECT 1 FROM private.tecnovigilancia_andamento a
                  WHERE a.relato_id = r.id AND a.situacao = 'concluido' AND a.em < now() - interval '5 years')
     AND NOT EXISTS (SELECT 1 FROM private.tecnovigilancia_suspensoes s WHERE s.relato_id = r.id AND s.encerrada_em IS NULL);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    PERFORM private.registrar_auditoria('apagar_tecnovigilancia_vencida', 'tecnovigilancia_relatos', NULL, NULL,
      jsonb_build_object('quantidade', n, 'limite', 5));
  END IF;
  RETURN n;
END $$;

-- ── 9. permissões e agendamento ────────────────────────────────────────────
REVOKE ALL ON FUNCTION private.tecnovigilancia_so_inclusao(), private.sou_rt_medico(), private.tem_dado_pessoal(text),
  private.tecnovigilancia_situacao(uuid), private.tecnovigilancia_json(private.tecnovigilancia_relatos, boolean),
  private.apagar_tecnovigilancia_vencida() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.relatar_tecnovigilancia(text, text, uuid, text, text, text), public.fila_tecnovigilancia(),
  public.tecnovigilancia_da_unidade(uuid), public.meus_relatos_tecnovigilancia(),
  public.andamento_tecnovigilancia(uuid, text, text, text, text, text),
  public.suspender_versao_rede(text, text, text, uuid), public.encerrar_suspensao_rede(uuid, text),
  public.suspensoes_rede_vigentes(), public.aviso_tecnovigilancia(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatar_tecnovigilancia(text, text, uuid, text, text, text), public.fila_tecnovigilancia(),
  public.tecnovigilancia_da_unidade(uuid), public.meus_relatos_tecnovigilancia(),
  public.andamento_tecnovigilancia(uuid, text, text, text, text, text),
  public.suspender_versao_rede(text, text, text, uuid), public.encerrar_suspensao_rede(uuid, text),
  public.suspensoes_rede_vigentes() TO authenticated;
REVOKE ALL ON FUNCTION public.aviso_tecnovigilancia(uuid, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.aviso_tecnovigilancia(uuid, boolean) TO service_role;

-- idempotente: o pg_cron atualiza o agendamento de mesmo nome
SELECT cron.schedule('lg12-tecnovigilancia-5-anos', '50 6 * * *', 'SELECT private.apagar_tecnovigilancia_vencida();');
