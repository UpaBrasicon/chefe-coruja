// Cria a massa LOADTEST. Roda na máquina do Ricardo, com a service_role do .env.
// Idempotente: rodar 2x não duplica. Grava IDs em dados.json.
// Uso: node setup/criar_massa.mjs
//
// ESTADO: a criação dos USUÁRIOS está pronta (Admin API, sem e-mail). A criação
// das entidades de domínio (organização, unidade com lat/lng/raio, setores,
// leitos, pacientes, internações, escala, chat) está marcada como TODO porque
// depende do schema real (~230 tabelas) e dos RPCs de criação do app, que eu
// ainda não pude ler (a leitura da produção foi bloqueada; falta o schema da
// homolog). Cada TODO aponta a RPC/tabela a usar. Ver DESCOBERTA.md.
import { createClient } from '@supabase/supabase-js'
import { carregarEnv, ORG_LOADTEST, gravarDados } from './_lib.mjs'

const env = carregarEnv()
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PLANO = { plantonista: 40, enfermeiro: 15, gestor: 3, recepcao: 6 }

async function criarUsuarios() {
  const usuarios = []
  for (const [papel, n] of Object.entries(PLANO)) {
    for (let i = 1; i <= n; i++) {
      const email = `carga-${papel}-${String(i).padStart(2, '0')}@loadtest.invalid`
      // idempotência: tenta criar; se já existe, segue
      const { error } = await admin.auth.admin.createUser({
        email,
        password: env.LOADTEST_SENHA,
        email_confirm: true, // nenhum e-mail sai
        user_metadata: { loadtest: true, papel },
      })
      if (error && !/already been registered|already exists/i.test(error.message)) {
        throw new Error(`createUser ${email}: ${error.message}`)
      }
      usuarios.push({ email, papel })
    }
  }
  return usuarios
}

async function criarDominio(_usuarios) {
  // TODO (precisa do schema/RPCs reais — ver DESCOBERTA.md):
  //  1. Organização ORG_LOADTEST "LOADTEST k6 — NÃO USAR" (tabela organizacoes)
  //  2. Unidade "UPA Carga k6" com latitude, longitude e raio_metros (unidades) — o check-in usa GPS
  //  3. 4 setores: Porta/PS, Observação adulto, Observação pediátrica, Sala vermelha
  //  4. 40 leitos distribuídos
  //  5. Vínculos: 1 por usuário, papel correto na unidade (descobrir RPC de convite/vínculo)
  //  6. Escala do mês corrente + próximo, com turnos "agora" (meu_plantao_agora responder)
  //  7. 80 pacientes "PACIENTE CARGA NNN" via salvar_cadastro_paciente (precisa de um JWT de recepção + setor)
  //  8. ~30 internações abertas via abrir_internacao + prescrição via registrar_prescricao_itens
  //  9. 3 conversas de chat com participantes de teste
  // Retornar: { unidade, setores:[], leitos:[], pacientes:[], conversas:[], lat, lng }
  return { unidade: null, setores: [], leitos: [], pacientes: [], conversas: [], lat: null, lng: null }
}

const usuarios = await criarUsuarios()
console.log(`usuários: ${usuarios.length} garantidos`)
const dominio = await criarDominio(usuarios)
gravarDados({ org: ORG_LOADTEST, usuarios, ...dominio })
console.log('dados.json gravado.')
if (!dominio.unidade) {
  console.warn('\n⚠️  Domínio ainda não criado (TODO). Smoke/carga só rodam depois de preencher criarDominio().')
}
