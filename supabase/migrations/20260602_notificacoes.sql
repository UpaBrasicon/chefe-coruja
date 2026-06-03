-- ── Tabela notificacoes ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notificacoes (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id uuid      NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
  tipo          text        NOT NULL,
  titulo        text        NOT NULL,
  mensagem      text,
  link          text,
  lida          boolean     DEFAULT false,
  criada_em     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notificacoes_prof_lida_idx
  ON notificacoes(profissional_id, lida, criada_em DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select_proprio"  ON notificacoes;
DROP POLICY IF EXISTS "notif_update_proprio"  ON notificacoes;
DROP POLICY IF EXISTS "notif_insert_admin"    ON notificacoes;
DROP POLICY IF EXISTS "notif_delete_proprio"  ON notificacoes;

-- Cada usuário lê apenas as próprias notificações
CREATE POLICY "notif_select_proprio" ON notificacoes
  FOR SELECT TO authenticated
  USING (profissional_id = (
    SELECT id FROM profissionais WHERE auth_user_id = auth.uid() LIMIT 1
  ));

-- Cada usuário pode atualizar (marcar como lida) as próprias
CREATE POLICY "notif_update_proprio" ON notificacoes
  FOR UPDATE TO authenticated
  USING (profissional_id = (
    SELECT id FROM profissionais WHERE auth_user_id = auth.uid() LIMIT 1
  ));

-- Admin pode inserir notificações para qualquer profissional (aviso geral)
CREATE POLICY "notif_insert_admin" ON notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profissionais
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- Usuário pode excluir as próprias
CREATE POLICY "notif_delete_proprio" ON notificacoes
  FOR DELETE TO authenticated
  USING (profissional_id = (
    SELECT id FROM profissionais WHERE auth_user_id = auth.uid() LIMIT 1
  ));

-- ── Trigger: troca solicitada ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_notify_troca_solicitada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_nome  text;
  v_data  text;
BEGIN
  SELECT nome INTO v_nome FROM profissionais WHERE id = NEW.de_profissional_id;
  SELECT to_char(p.data::date, 'DD/MM/YYYY') INTO v_data
    FROM plantoes p WHERE p.id = NEW.plantao_id;

  INSERT INTO notificacoes (profissional_id, tipo, titulo, mensagem, link)
  VALUES (
    NEW.para_profissional_id,
    'troca_solicitada',
    'Pedido de troca de plantão',
    COALESCE(v_nome, 'Um colega') || ' quer trocar o plantão de '
      || COALESCE(v_data, '?') || ' com você.',
    '/trocas'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_troca_solicitada ON trocas;
CREATE TRIGGER trg_notify_troca_solicitada
  AFTER INSERT ON trocas
  FOR EACH ROW EXECUTE FUNCTION fn_notify_troca_solicitada();

-- ── Trigger: troca aceita / recusada ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_notify_troca_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_nome  text;
  v_data  text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('aceita', 'recusada') THEN RETURN NEW; END IF;

  SELECT nome INTO v_nome FROM profissionais WHERE id = NEW.para_profissional_id;
  SELECT to_char(p.data::date, 'DD/MM/YYYY') INTO v_data
    FROM plantoes p WHERE p.id = NEW.plantao_id;

  IF NEW.status = 'aceita' THEN
    INSERT INTO notificacoes (profissional_id, tipo, titulo, mensagem, link)
    VALUES (
      NEW.de_profissional_id,
      'troca_aceita',
      'Troca aceita!',
      COALESCE(v_nome, 'Seu colega') || ' aceitou a troca do plantão de '
        || COALESCE(v_data, '?') || '.',
      '/trocas'
    );
  ELSE
    INSERT INTO notificacoes (profissional_id, tipo, titulo, mensagem, link)
    VALUES (
      NEW.de_profissional_id,
      'troca_recusada',
      'Troca recusada',
      COALESCE(v_nome, 'Seu colega') || ' não pôde aceitar a troca do plantão de '
        || COALESCE(v_data, '?') || '.',
      '/trocas'
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_troca_status ON trocas;
CREATE TRIGGER trg_notify_troca_status
  AFTER UPDATE OF status ON trocas
  FOR EACH ROW EXECUTE FUNCTION fn_notify_troca_status();

-- ── Trigger: designação de plantão ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_notify_designado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_setor text;
  v_turno text;
  v_data  text;
BEGIN
  -- Só dispara quando o profissional muda (e não é remoção)
  IF NEW.profissional_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.profissional_id IS NOT DISTINCT FROM NEW.profissional_id THEN RETURN NEW; END IF;

  SELECT s.nome  INTO v_setor FROM setores     s  WHERE s.id  = NEW.setor_id;
  SELECT t.nome  INTO v_turno FROM tipos_turno t  WHERE t.id  = NEW.tipo_turno_id;
  SELECT to_char(NEW.data::date, 'DD/MM/YYYY') INTO v_data;

  INSERT INTO notificacoes (profissional_id, tipo, titulo, mensagem, link)
  VALUES (
    NEW.profissional_id,
    'designado',
    'Você foi designado para um plantão',
    'Plantão de ' || COALESCE(v_turno, 'turno') || ' em '
      || COALESCE(v_setor, 'setor') || ' no dia ' || COALESCE(v_data, '?') || '.',
    '/escala'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_designado ON plantoes;
CREATE TRIGGER trg_notify_designado
  AFTER UPDATE OF profissional_id ON plantoes
  FOR EACH ROW EXECUTE FUNCTION fn_notify_designado();
