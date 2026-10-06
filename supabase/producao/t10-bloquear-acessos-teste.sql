-- Fase 0, tarefa 10 do BACKLOG.md — bloquear os acessos de teste da PRODUÇÃO.
-- Decisão do responsável (06/10/2026): bloquear (não excluir) as 4 contas de
-- teste; manter a conta real koutimxbox@gmail.com como está (super admin + 8
-- papéis, revisado e mantido até o primeiro paciente real).
--
-- Bloquear = vínculos desligados, super admin retirado, escalas futuras
-- desligadas, perfil inativo, login proibido para sempre (banned_until) e
-- sessões derrubadas. A conta continua existindo só como AUTORA de registros
-- antigos: prontuário e trilha de auditoria não perdem a autoria.
--
-- Rodar no SQL Editor da PRODUÇÃO (Chefe-coruja, saqjrjtrkzkswsxxvdxn), inteiro.
-- Tudo numa transação: se algo não bater, nada muda.
BEGIN;

CREATE TEMP TABLE alvo ON COMMIT DROP AS
SELECT u.id, u.email FROM auth.users u
 WHERE lower(u.email) IN ('super@teste.com', 'admin@teste.com', 'gestor@teste.com', 'plantonista@teste.com');

DO $$
DECLARE
  v_rt constant text := 'koutimxbox@gmail.com';
BEGIN
  IF EXISTS (SELECT 1 FROM alvo WHERE lower(email) = v_rt) THEN
    RAISE EXCEPTION 'a conta real não pode estar na lista';
  END IF;
  IF (SELECT count(*) FROM alvo) <> 4 THEN
    RAISE EXCEPTION 'esperava 4 contas de teste, achou %: confira os e-mails antes de seguir', (SELECT count(*) FROM alvo);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u JOIN public.super_admins s ON s.perfil_id = u.id WHERE lower(u.email) = v_rt) THEN
    RAISE EXCEPTION 'a conta real não é super admin: ninguém ficaria administrando — pare e revise';
  END IF;
END $$;

UPDATE public.vinculos SET ativo = false, updated_at = now() WHERE perfil_id IN (SELECT id FROM alvo) AND ativo;
DELETE FROM public.super_admins WHERE perfil_id IN (SELECT id FROM alvo);
UPDATE public.escala_plantao SET ativo = false, updated_at = now()
 WHERE perfil_id IN (SELECT id FROM alvo) AND ativo AND data >= current_date;
UPDATE public.perfis SET ativo = false, updated_at = now() WHERE id IN (SELECT id FROM alvo);
UPDATE auth.users SET banned_until = 'infinity' WHERE id IN (SELECT id FROM alvo);
DELETE FROM auth.sessions WHERE user_id IN (SELECT id FROM alvo);   -- refresh tokens caem em cascata

-- trilha encadeada: quem revogou (o responsável) e quem foi bloqueado
INSERT INTO public.log_auditoria (ator_id, acao, entidade, entidade_id, payload)
SELECT (SELECT id FROM auth.users WHERE lower(email) = 'koutimxbox@gmail.com'),
       'acesso_teste_bloqueado', 'perfis', a.id, jsonb_build_object('motivo_codigo', 'fase0_tarefa10')
  FROM alvo a;

COMMIT;

-- evidência: as 4 contas bloqueadas e sem acesso; a conta real intacta
SELECT u.email,
       (SELECT count(*) FROM public.vinculos v WHERE v.perfil_id = u.id AND v.ativo) AS vinculos_ativos,
       EXISTS (SELECT 1 FROM public.super_admins s WHERE s.perfil_id = u.id) AS super_admin,
       (SELECT p.ativo FROM public.perfis p WHERE p.id = u.id) AS perfil_ativo,
       u.banned_until AS bloqueado_ate,
       (SELECT count(*) FROM auth.sessions s WHERE s.user_id = u.id) AS sessoes
  FROM auth.users u ORDER BY u.created_at;
