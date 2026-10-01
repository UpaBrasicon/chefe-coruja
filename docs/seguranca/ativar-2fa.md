# Ativar o segundo fator (2FA) — runbook

A "muralha do login". O mecanismo **já está todo pronto**; ligar é uma ação de
operação, não de código. Enquanto a flag está desligada, nada muda para ninguém.

## Dois métodos (coexistem)
- **Email-OTP (padrão, migration `20261022000001`):** em login de dispositivo
  novo, o sistema envia um código de 6 dígitos ao email cadastrado; a pessoa
  digita e pode marcar "confiar neste dispositivo" (30 dias). **Não exige
  cadastro prévio** — ligar a flag funciona para todos na hora. Dispositivos
  confiáveis são revogáveis no Perfil (mitiga o risco de aparelho perdido).
- **TOTP (app autenticador, migration `20260926000009`):** alternativa mais
  forte; exige a pessoa cadastrar o autenticador antes.

O gate (`private.segundo_fator_valido`) aceita **qualquer um dos dois**:
`aal2`+TOTP OU sessão verificada por email.

### Pré-requisito do email-OTP (uma vez, já quase todo feito)
- Migration `20261022000001` aplicada em prod ✓.
- Edge Function `enviar-codigo-2fa` deployada ✓.
- **Secrets (teu):** Dashboard → Edge Functions → Secrets:
  - `RESEND_API_KEY` = chave do Resend (`re_...`, a senha SMTP).
  - `EMAIL_FROM` = `Chefe Coruja <nao-responda@chefecoruja.com.br>`.
  - (`CC_PUBLISHABLE_KEY` e `APP_ORIGIN` já existem das outras functions.)
- Teste antes do flip: logar, disparar "enviar código", conferir o email chega.

Com o email-OTP, o passo "enrollment do time" abaixo **não é mais obrigatório**
para ligar — só vale se você quiser exigir especificamente o TOTP.

## Como funciona (resumo)
- Flag `exigir_segundo_fator` em `public.configuracao_plataforma` (default `false`).
- Com a flag **ligada**, exige sessão `aal2` + verificação TOTP há menos de 24 h:
  - **RLS restritiva** em toda tabela com dado de paciente (soma AND às permissivas).
  - **RPCs SECURITY DEFINER clínicas** chamam `private.exigir_segundo_fator()`
    (não passam pela RLS) — 201 chamadas em 53 migrations; ~56 writers distintos.
- "Aparelho novo" já pede código de graça: novo login nasce `aal1` (Supabase).
- Janela de 24 h lida do claim `amr` do JWT (`private.ultima_verificacao_totp()`).
- Frontend pronto: `src/components/seguranca/SegundoFator.tsx` +
  `src/hooks/useSegundoFator.ts` (enroll/challengeAndVerify/unenroll/listFactors),
  decisão de UI por `public.segundo_fator_status()`.
- MFA **nativo** do Supabase (aal2/amr), enforcement no **banco** (RLS/RPC) —
  **não** depende do hook de MFA (que exige plano Team).

## Pré-checagens (antes de ligar — não quebrar ninguém)
1. **Enrollment do time.** Cada pessoa que escreve dado clínico precisa ter o
   autenticador cadastrado e verificado **antes** do flip. Conferir:
   ```sql
   -- fatores TOTP verificados por usuário (quem NÃO tem vai ser barrado ao ligar)
   SELECT u.email, f.status
   FROM auth.users u
   LEFT JOIN auth.mfa_factors f ON f.user_id = u.id AND f.factor_type = 'totp'
   ORDER BY f.status NULLS FIRST;
   ```
   Barrar só é aceitável para quem não deve escrever dado de paciente.
2. **Allow-list completo.** Toda RPC SECURITY DEFINER que escreve/le dado de
   paciente chama `private.exigir_segundo_fator()` (verificado no red-team
   2026-10-01). Reconferir se novas RPCs clínicas entraram desde então:
   ```sql
   SELECT p.proname
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef
     AND pg_get_functiondef(p.oid) NOT ILIKE '%exigir_segundo_fator%'
     AND pg_get_functiondef(p.oid) ILIKE ANY (ARRAY['%prescric%','%internac%','%observac%','%episodio%','%paciente%']);
   -- vazio = ok; qualquer nome = RPC clínica sem o guard, corrigir antes do flip
   ```
3. **Hermes não quebra.** O agente não tem sessão TOTP; confirmar que nenhuma RPC
   que o Hermes (`hermes_user`) chama exige segundo fator — as RPCs `hermes_*`
   são leitura/notificação/auditoria e não chamam o guard. As RPCs clínicas de
   escrita (ex. `registrar_prescricao_itens`) são chamadas pelo **app humano**,
   não pelo Hermes.

## Ligar
```sql
UPDATE public.configuracao_plataforma SET valor = true, atualizado_em = now()
WHERE chave = 'exigir_segundo_fator';
```
Efeito imediato: sessões sem `aal2`+TOTP-recente passam a ser barradas no dado de
paciente; a UI mostra "digitar o código" ou "cadastrar autenticador".

## Rollback (se algo travar)
```sql
UPDATE public.configuracao_plataforma SET valor = false, atualizado_em = now()
WHERE chave = 'exigir_segundo_fator';
```
Volta tudo ao estado atual na hora. Sem migration, sem deploy.

## Teste pós-flip
1. Login num aparelho já verificado → acessa dado de paciente normal.
2. Login num aparelho novo (ou >24 h sem TOTP) → pede o código; só depois libera.
3. Usuário sem autenticador → UI manda cadastrar; não acessa dado de paciente até cadastrar+verificar.
