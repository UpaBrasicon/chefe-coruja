-- ════════════════════════════════════════════════════════════════════════════
-- Volta da migration 20270421000030_agenda_reunioes.sql (agenda do
-- administrador, reuniões com o link colado).
--
-- Rodar primeiro na homologação. Antes, voltar o frontend (o menu "Agenda" do
-- administrador chama minhas_reunioes; sem a função a tela mostra o erro).
-- Apaga as reuniões marcadas: se for preciso guardá-las, exporte antes
--   SELECT * FROM public.reunioes; SELECT * FROM public.reuniao_convidados;
-- Os avisos já entregues (notificacoes_plantonista, tipo 'reuniao_%') ficam:
-- são texto, não dependem das tabelas. Para tirá-los também, descomente o fim.
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DROP FUNCTION IF EXISTS public.salvar_reuniao(uuid, uuid, text, date, time, time, text, text, uuid[]);
DROP FUNCTION IF EXISTS public.cancelar_reuniao(uuid);
DROP FUNCTION IF EXISTS public.minhas_reunioes(date, date);
DROP FUNCTION IF EXISTS public.pessoas_para_reuniao(uuid, text);
DROP FUNCTION IF EXISTS private.reuniao_avisar(uuid, uuid[], text);
DROP FUNCTION IF EXISTS private.pessoa_na_organizacao(uuid, uuid);
DROP FUNCTION IF EXISTS private.pode_organizar_reuniao(uuid);

-- as políticas usam private.reuniao_visivel; o CHECK de reunioes usa private.link_reuniao_ok
DROP TABLE IF EXISTS public.reuniao_convidados;
DROP TABLE IF EXISTS public.reunioes;
DROP FUNCTION IF EXISTS private.reuniao_visivel(uuid);
DROP FUNCTION IF EXISTS private.link_reuniao_ok(text);
DROP FUNCTION IF EXISTS private.plataforma_reuniao(text);

-- DELETE FROM public.notificacoes_plantonista WHERE tipo LIKE 'reuniao\_%';

COMMIT;
