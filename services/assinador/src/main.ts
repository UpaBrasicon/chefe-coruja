// Assinador ICP-Brasil (LG7): liga as peças reais pelo ambiente e sobe o servidor.
// Variáveis (no .env do VPS; segredos nunca no repositório nem no chat):
//   SUPABASE_URL, SUPABASE_CHAVE_PUBLICA     Supabase (chave publicável; o resto é com o JWT do médico)
//   ASSINADOR_PG_URL                         banco pelo papel assinador_app
//   ASSINADOR_CHAVE                          32 bytes em hex (cifra os tokens dos provedores)
//   ASSINADOR_ARQUIVO_SESSOES                arquivo cifrado das sessões (volume do contêiner)
//   ASSINADOR_BASE                           endereço público (ex.: https://assina.chefecoruja.com.br)
//   ASSINADOR_ORIGENS                        origens do app que podem chamar (separadas por vírgula)
//   ASSINADOR_RETORNO                        endereço de retorno do OAuth (ASSINADOR_BASE + /retorno)
//   CHROMIUM                                 caminho do Chromium do contêiner
//   VIDAAS_*, BIRDID_*, NEOID_*              provedores (BASE, CLIENT_ID, CLIENT_SECRET e caminhos)
//   PORTA                                    porta HTTP (padrão 8090)
import { provedoresDoAmbiente } from './docicp17.ts'
import { bancoDoAssinador, renderizador, supabaseDoMedico } from './real.ts'
import { criarServidor } from './servidor.ts'
import { Cofre, Pendentes, Sessoes } from './sessoes.ts'

const env = process.env
const obrigatoria = (k: string) => {
  const v = env[k]
  if (!v) {
    console.error(`[assinador] falta a variável ${k}`)
    process.exit(1)
  }
  return v
}

const supa = supabaseDoMedico(obrigatoria('SUPABASE_URL'), obrigatoria('SUPABASE_CHAVE_PUBLICA'))
const banco = bancoDoAssinador(obrigatoria('ASSINADOR_PG_URL'))
const render = renderizador(env.CHROMIUM ?? '/usr/bin/chromium-browser')
const sessoes = new Sessoes(new Cofre(obrigatoria('ASSINADOR_CHAVE')), env.ASSINADOR_ARQUIVO_SESSOES ?? '/dados/sessoes.json')
const base = obrigatoria('ASSINADOR_BASE').replace(/\/$/, '')
const provedores = provedoresDoAmbiente(env)
if (!provedores.length) console.warn('[assinador] nenhum provedor configurado: a sessão de assinatura não abre até haver credenciais')

const servidor = criarServidor(
  {
    provedores, sessoes, pendentes: new Pendentes(),
    quemE: supa.quemE, fimDoPlantao: supa.fimDoPlantao, documento: supa.documento,
    folhaPdf: async (jwt, id, conferencia) => render.pdf(await supa.folhaHtml(jwt, id), conferencia),
    urlConferencia: `${base}/v`,
    banco,
    minhaSessao: async (jwt) => {
      const m = await supa.quemE(jwt)
      const s = sessoes.daPessoa(m.perfilId)
      return { ativa: !!s, provedor: s?.provedor ?? null, valida_ate: s?.validaAte ?? null, provedores: provedores.map((p) => ({ id: p.id, nome: p.nome })) }
    },
  },
  { conferir: supa.conferir, pdfAssinado: supa.pdfAssinado },
  { origens: (env.ASSINADOR_ORIGENS ?? '').split(',').map((s) => s.trim()).filter(Boolean), base },
)

const porta = Number(env.PORTA ?? 8090)
servidor.listen(porta, '0.0.0.0', () => console.log(`[assinador] ouvindo na porta ${porta}; ${provedores.length} provedor(es)`))
const limpeza = setInterval(() => sessoes.limpar(), 5 * 60_000)

async function parar() {
  clearInterval(limpeza)
  servidor.close()
  await Promise.allSettled([banco.fechar(), render.fechar()])
  process.exit(0)
}
process.on('SIGTERM', parar)
process.on('SIGINT', parar)
