// Gera os modelos de e-mail do Auth (supabase/templates/*.html) a partir de um
// layout só, no visual do Chefe Coruja. Rode: npm run emails:gerar
//
// Os arquivos gerados servem a dois lugares:
//   * supabase/config.toml (banco local: os e-mails aparecem no Mailpit);
//   * o painel do Supabase de produção (Authentication → Emails → Templates),
//     onde o assunto e o HTML de cada um são colados à mão (onda 11).
// Variáveis do Supabase ({{ .ConfirmationURL }}, {{ .Token }}, {{ .Email }},
// {{ .NewEmail }}, {{ .SiteURL }}) ficam como estão: quem troca é o Auth.
// E-mail não carrega CSS externo nem imagem remota: tudo em estilo inline.
import { mkdirSync, writeFileSync } from 'node:fs'

const COR = { acao: '#0F766E', tinta: '#1E293B', apoio: '#475569', sussurro: '#64748B', campo: '#F8FAFC', fio: '#E2E8F0', critico: '#B91C1C' }

const botao = (url, texto) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr><td style="border-radius:10px;background:${COR.acao}">` +
  `<a href="${url}" style="display:inline-block;padding:13px 22px;font:600 15px/1 Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px">${texto}</a>` +
  `</td></tr></table>` +
  `<p style="margin:10px 0 0;font:13px/1.5 Arial,Helvetica,sans-serif;color:${COR.sussurro}">Se o botão não abrir, copie este endereço no navegador:<br>` +
  `<a href="${url}" style="color:${COR.acao};word-break:break-all">${url}</a></p>`

const codigo = (token) =>
  `<p style="margin:20px 0 6px;font:700 30px/1 'Courier New',Courier,monospace;letter-spacing:6px;color:${COR.tinta}">${token}</p>`

const p = (texto) => `<p style="margin:0 0 12px;font:15px/1.6 Arial,Helvetica,sans-serif;color:${COR.apoio}">${texto}</p>`
const aviso = (texto) =>
  `<p style="margin:18px 0 0;padding:12px 14px;background:${COR.campo};border:1px solid ${COR.fio};border-radius:10px;font:13px/1.5 Arial,Helvetica,sans-serif;color:${COR.apoio}">${texto}</p>`

function layout({ titulo, previa, corpo }) {
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title></head>
<body style="margin:0;padding:0;background:${COR.campo}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${previa}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.campo}"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${COR.fio};border-radius:14px">
<tr><td style="padding:22px 26px 0">
<p style="margin:0;font:700 17px/1 Arial,Helvetica,sans-serif;color:${COR.acao}">Chefe Coruja</p>
</td></tr>
<tr><td style="padding:18px 26px 26px">
<h1 style="margin:0 0 14px;font:700 21px/1.25 Arial,Helvetica,sans-serif;color:${COR.tinta}">${titulo}</h1>
${corpo}
</td></tr>
<tr><td style="padding:16px 26px;border-top:1px solid ${COR.fio}">
<p style="margin:0;font:12px/1.5 Arial,Helvetica,sans-serif;color:${COR.sussurro}">Mensagem automática do Chefe Coruja, enviada para {{ .Email }}. Não responda este e-mail.<br>O Chefe Coruja nunca pede a sua senha nem o código do autenticador por e-mail.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>
`
}

// nome do arquivo → { assunto, html }. A tabela no fim do arquivo liga cada um
// ao modelo do painel do Supabase.
export const EMAILS = {
  recuperacao: {
    painel: 'Reset Password',
    assunto: 'Chefe Coruja — redefinir a sua senha',
    html: layout({
      titulo: 'Redefinir a sua senha',
      previa: 'Use o link para escolher uma senha nova.',
      corpo:
        p('Recebemos um pedido para redefinir a senha da conta <strong>{{ .Email }}</strong>.') +
        botao('{{ .ConfirmationURL }}', 'Escolher a senha nova') +
        aviso('O link vale por 1 hora e funciona uma vez só. Se não foi você que pediu, ignore este e-mail: a sua senha continua a mesma.'),
    }),
  },
  confirmacao: {
    painel: 'Confirm signup',
    assunto: 'Chefe Coruja — confirme o seu e-mail',
    html: layout({
      titulo: 'Confirme o seu e-mail',
      previa: 'Falta confirmar o e-mail para terminar o primeiro acesso.',
      corpo:
        p('Para terminar o primeiro acesso ao Chefe Coruja, confirme que este e-mail é seu.') +
        botao('{{ .ConfirmationURL }}', 'Confirmar o e-mail') +
        aviso('Se você não está fazendo um cadastro no Chefe Coruja, ignore este e-mail. Nada é criado sem a confirmação.'),
    }),
  },
  reautenticacao: {
    painel: 'Reauthentication',
    assunto: 'Chefe Coruja — código para confirmar que é você',
    html: layout({
      titulo: 'Confirme que é você',
      previa: 'Código para confirmar a troca de senha.',
      corpo:
        p('Para trocar a senha, digite este código na tela do Chefe Coruja:') +
        codigo('{{ .Token }}') +
        aviso('O código vale por poucos minutos. Se não foi você que pediu, troque a sua senha pelo "Esqueci a senha" e avise a coordenação da unidade.'),
    }),
  },
  convite: {
    painel: 'Invite user',
    assunto: 'Chefe Coruja — você foi convidado',
    html: layout({
      titulo: 'Você foi convidado para o Chefe Coruja',
      previa: 'Aceite o convite para criar o seu acesso.',
      corpo:
        p('A coordenação da sua unidade convidou você para o Chefe Coruja.') +
        botao('{{ .ConfirmationURL }}', 'Aceitar o convite') +
        aviso('O acesso depende da escala: a plataforma abre para você no horário dos seus plantões.'),
    }),
  },
  alteracao_email: {
    painel: 'Change Email Address',
    assunto: 'Chefe Coruja — confirme o novo e-mail',
    html: layout({
      titulo: 'Confirme o novo e-mail',
      previa: 'Confirme a troca do e-mail da sua conta.',
      corpo:
        p('Recebemos um pedido para trocar o e-mail da sua conta de <strong>{{ .Email }}</strong> para <strong>{{ .NewEmail }}</strong>.') +
        botao('{{ .ConfirmationURL }}', 'Confirmar o novo e-mail') +
        aviso('Se não foi você que pediu, não clique: o e-mail continua o mesmo. Avise a coordenação da unidade.'),
    }),
  },
  link_acesso: {
    painel: 'Magic Link',
    assunto: 'Chefe Coruja — o seu link de acesso',
    html: layout({
      titulo: 'O seu link de acesso',
      previa: 'Entre no Chefe Coruja com este link.',
      corpo:
        p('Use o botão abaixo para entrar no Chefe Coruja.') +
        botao('{{ .ConfirmationURL }}', 'Entrar') +
        aviso('O link funciona uma vez só. Se não foi você que pediu, ignore este e-mail.'),
    }),
  },
  senha_alterada: {
    painel: 'Password changed (notificação de segurança)',
    assunto: 'Chefe Coruja — a sua senha foi alterada',
    html: layout({
      titulo: 'A sua senha foi alterada',
      previa: 'Aviso de segurança da sua conta.',
      corpo:
        p('A senha da conta <strong>{{ .Email }}</strong> acabou de ser alterada.') +
        aviso('<strong style="color:' + COR.critico + '">Não foi você?</strong> Use "Esqueci a senha" em <a href="{{ .SiteURL }}/recuperar-senha" style="color:' + COR.acao + '">{{ .SiteURL }}</a> para escolher uma senha nova agora, e avise a coordenação da unidade.'),
    }),
  },
}

const destino = new URL('../supabase/templates/', import.meta.url)
mkdirSync(destino, { recursive: true })
for (const [nome, e] of Object.entries(EMAILS)) writeFileSync(new URL(`${nome}.html`, destino), e.html)

const lista = Object.entries(EMAILS).map(([nome, e]) => `| ${e.painel} | ${e.assunto} | supabase/templates/${nome}.html |`).join('\n')
writeFileSync(new URL('LEIA-ME.md', destino),
  `# Modelos de e-mail do Auth\n\nGerados por \`scripts/gerar-emails.mjs\` (\`npm run emails:gerar\`) — não edite os .html à mão.\n\n` +
  `Em produção, cada um é colado no painel do Supabase (Authentication → Emails → Templates): o assunto no campo *Subject* e o conteúdo do .html no corpo.\n\n` +
  `| Modelo no painel | Assunto | Arquivo |\n|---|---|---|\n${lista}\n`)
console.log(`${Object.keys(EMAILS).length} modelos em supabase/templates/`)
