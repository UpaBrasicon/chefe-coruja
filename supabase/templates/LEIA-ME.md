# Modelos de e-mail do Auth

Gerados por `scripts/gerar-emails.mjs` (`npm run emails:gerar`) — não edite os .html à mão.

Em produção, cada um é colado no painel do Supabase (Authentication → Emails → Templates): o assunto no campo *Subject* e o conteúdo do .html no corpo.

| Modelo no painel | Assunto | Arquivo |
|---|---|---|
| Reset Password | Chefe Coruja — redefinir a sua senha | supabase/templates/recuperacao.html |
| Confirm signup | Chefe Coruja — confirme o seu e-mail | supabase/templates/confirmacao.html |
| Reauthentication | Chefe Coruja — código para confirmar que é você | supabase/templates/reautenticacao.html |
| Invite user | Chefe Coruja — você foi convidado | supabase/templates/convite.html |
| Change Email Address | Chefe Coruja — confirme o novo e-mail | supabase/templates/alteracao_email.html |
| Magic Link | Chefe Coruja — o seu link de acesso | supabase/templates/link_acesso.html |
| Password changed (notificação de segurança) | Chefe Coruja — a sua senha foi alterada | supabase/templates/senha_alterada.html |
