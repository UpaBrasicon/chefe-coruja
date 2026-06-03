import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
// Atualize com o domínio verificado no Resend (ex: noreply@seudominio.com)
// Para testes, use: onboarding@resend.dev  (só envia para o email verificado na conta)
const FROM = 'Chefe Coruja <noreply@chefecoruja.com.br>'

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

function formatarData(dataStr: string) {
  const [, m, d] = dataStr.split('-')
  return `${parseInt(d)} de ${MESES[parseInt(m) - 1]}`
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(data))
  return data
}

function emailLayout(titulo: string, corpo: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;margin:0;padding:24px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0d9488;padding:20px 24px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:26px;">🦉</span>
      <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">Chefe Coruja</span>
    </div>
    <div style="padding:24px 24px 20px;">
      <h2 style="margin:0 0 14px;color:#0f172a;font-size:17px;font-weight:600;">${titulo}</h2>
      ${corpo}
      <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">
        Mensagem automática do Chefe Coruja — não responda este e-mail.
      </p>
    </div>
  </div>
</body>
</html>`
}

function tagSetor(nome: string) {
  return `<span style="background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:20px;font-size:12px;font-weight:600;">${nome}</span>`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const { type, table, record, old_record } = await req.json()

    // ── 1. Troca recebida ───────────────────────────────────────────────────
    if (table === 'trocas' && type === 'INSERT') {
      const [{ data: para }, { data: de }, { data: plantao }] = await Promise.all([
        supabase.from('profissionais').select('nome, email').eq('id', record.para_profissional_id).single(),
        supabase.from('profissionais').select('nome').eq('id', record.de_profissional_id).single(),
        supabase.from('plantoes')
          .select('data, setores(nome), tipos_turno(hora_inicio, hora_fim)')
          .eq('id', record.plantao_id).single(),
      ])

      if (para?.email) {
        await sendEmail(
          para.email,
          '🔄 Você recebeu um pedido de transferência',
          emailLayout(
            'Pedido de transferência de plantão',
            `<p style="color:#475569;line-height:1.7;margin:0 0 12px;">
              Olá, <strong style="color:#0f172a;">${para.nome}</strong>!<br>
              <strong>${de?.nome ?? 'Um colega'}</strong> quer te transferir o seguinte plantão:
            </p>
            <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:14px 16px;margin:0 0 14px;">
              <p style="margin:0;font-weight:600;color:#0f172a;font-size:15px;">📅 ${formatarData(plantao?.data ?? '')}</p>
              ${plantao?.setores?.nome ? `<p style="margin:6px 0 0;">${tagSetor(plantao.setores.nome)}</p>` : ''}
              ${plantao?.tipos_turno ? `<p style="margin:6px 0 0;color:#475569;font-size:13px;">⏰ ${plantao.tipos_turno.hora_inicio?.slice(0,5)} – ${plantao.tipos_turno.hora_fim?.slice(0,5)}</p>` : ''}
            </div>
            ${record.mensagem ? `<p style="background:#f8fafc;border-left:3px solid #cbd5e1;padding:10px 14px;border-radius:0 8px 8px 0;font-style:italic;color:#64748b;margin:0 0 14px;">"${record.mensagem}"</p>` : ''}
            <p style="color:#475569;line-height:1.6;margin:0;">Acesse o app em <strong>Trocas</strong> para aceitar ou recusar este pedido.</p>`,
          ),
        )
      }
    }

    // ── 2. Troca respondida (aceita ou recusada) ────────────────────────────
    if (
      table === 'trocas' && type === 'UPDATE' &&
      (record.status === 'aceita' || record.status === 'recusada') &&
      old_record?.status !== record.status
    ) {
      const [{ data: de }, { data: para }, { data: plantao }] = await Promise.all([
        supabase.from('profissionais').select('nome, email').eq('id', record.de_profissional_id).single(),
        supabase.from('profissionais').select('nome').eq('id', record.para_profissional_id).single(),
        supabase.from('plantoes').select('data, setores(nome)').eq('id', record.plantao_id).single(),
      ])

      if (de?.email) {
        const aceita = record.status === 'aceita'
        await sendEmail(
          de.email,
          aceita ? '✅ Sua transferência foi aceita!' : '❌ Sua transferência foi recusada',
          emailLayout(
            aceita ? 'Transferência aceita!' : 'Transferência recusada',
            `<p style="color:#475569;line-height:1.7;margin:0;">
              Olá, <strong style="color:#0f172a;">${de.nome}</strong>!<br>
              <strong>${para?.nome ?? 'O médico'}</strong>
              ${aceita
                ? '<span style="color:#16a34a;font-weight:600;">aceitou</span>'
                : '<span style="color:#dc2626;font-weight:600;">recusou</span>'}
              sua transferência do plantão de <strong>${formatarData(plantao?.data ?? '')}</strong>
              ${plantao?.setores?.nome ? `(${plantao.setores.nome})` : ''}.
              ${aceita ? '<br><br>O plantão foi transferido com sucesso.' : ''}
            </p>`,
          ),
        )
      }
    }

    // ── 3. Conta aprovada ───────────────────────────────────────────────────
    if (
      table === 'profissionais' && type === 'UPDATE' &&
      record.status_aprovacao === 'aprovado' &&
      old_record?.status_aprovacao !== 'aprovado'
    ) {
      if (record.email) {
        await sendEmail(
          record.email,
          '✅ Sua conta no Chefe Coruja foi aprovada!',
          emailLayout(
            'Bem-vindo ao Chefe Coruja! 🦉',
            `<p style="color:#475569;line-height:1.7;margin:0 0 14px;">
              Olá, <strong style="color:#0f172a;">${record.nome}</strong>!<br>
              Sua conta foi <strong style="color:#16a34a;">aprovada</strong> pelo coordenador.
              Você já pode acessar a escala, solicitar trocas e se candidatar a plantões vagos.
            </p>
            <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:14px 16px;">
              <p style="margin:0;color:#0f172a;font-weight:600;">O que você pode fazer:</p>
              <ul style="margin:8px 0 0;padding-left:18px;color:#475569;line-height:1.8;">
                <li>Visualizar a escala mensal</li>
                <li>Pedir transferência de plantão para um colega</li>
                <li>Registrar desistência e abrir vaga</li>
                <li>Se candidatar a vagas em aberto</li>
              </ul>
            </div>`,
          ),
        )
      }
    }

    // ── 4. Designado para vaga ──────────────────────────────────────────────
    if (
      table === 'desistencias' && type === 'UPDATE' &&
      record.status === 'preenchida' &&
      old_record?.status !== 'preenchida'
    ) {
      const [{ data: prof }, { data: plantao }] = await Promise.all([
        supabase.from('profissionais').select('nome, email').eq('id', record.preenchida_por).single(),
        supabase.from('plantoes')
          .select('data, setores(nome, cor), tipos_turno(hora_inicio, hora_fim)')
          .eq('id', record.plantao_id).single(),
      ])

      if (prof?.email) {
        await sendEmail(
          prof.email,
          '🏥 Você foi designado para cobrir um plantão',
          emailLayout(
            'Novo plantão designado para você',
            `<p style="color:#475569;line-height:1.7;margin:0 0 14px;">
              Olá, <strong style="color:#0f172a;">${prof.nome}</strong>!<br>
              O coordenador te selecionou para cobrir o seguinte plantão:
            </p>
            <div style="background:#f0fdfa;border:2px solid #0d9488;border-radius:10px;padding:16px 18px;">
              <p style="margin:0;font-weight:700;color:#0f172a;font-size:16px;">📅 ${formatarData(plantao?.data ?? '')}</p>
              ${plantao?.setores?.nome ? `<p style="margin:8px 0 0;">${tagSetor(plantao.setores.nome)}</p>` : ''}
              ${plantao?.tipos_turno ? `<p style="margin:8px 0 0;color:#475569;font-size:13px;">⏰ ${plantao.tipos_turno.hora_inicio?.slice(0,5)} – ${plantao.tipos_turno.hora_fim?.slice(0,5)}</p>` : ''}
            </div>
            <p style="color:#475569;line-height:1.6;margin:14px 0 0;">Acesse o app para confirmar seu plantão na escala.</p>`,
          ),
        )
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('notify-email error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
