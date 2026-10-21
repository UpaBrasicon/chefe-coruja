import { useCallback, useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Bird, Clock, FlaskConical, Hourglass, Users } from 'lucide-react'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/geist-mono'

import './landing.css'

// Porta pública do produto: quem chega em "/" sem sessão vê esta página; quem
// tem sessão segue direto para a sua tela inicial (ver RequireAuth).
// Direção "Livro da escala" com título em serifa (trilha Revisão visual,
// parte 1; docs/frontend/revisao-visual/landing/DIRECOES.md): a página é a
// própria escala, e as seções são linhas de registro. Sem imagem gerada e sem
// forma de enfeite: o que aparece é peça do produto, com valores ilustrativos.
// Cores: os tokens do app (--cc-*), então a página segue o tema claro/escuro.

// ── a escala do herói ───────────────────────────────────────────────────────
// Régua de 24 h a partir das 07:00. Início e duração em horas desde as 07:00.
const AGORA = { hora: '14:32', desde7: 7 + 32 / 60 }
const HORAS = ['07', '09', '11', '13', '15', '17', '19', '21', '23', '01', '03', '05']

type Linha = { papel: string; turno: string; inicio: number; duracao: number; dentro: boolean; estado: string }

const ESCALA: Linha[] = [
  { papel: 'Plantonista', turno: '12 h · 07–19', inicio: 0, duracao: 12, dentro: true, estado: 'Na escala' },
  { papel: 'Enfermeiro', turno: '12 h · 07–19', inicio: 0, duracao: 12, dentro: true, estado: 'Na escala' },
  { papel: 'Técnico de enfermagem', turno: '6 h · 13–19', inicio: 6, duracao: 6, dentro: true, estado: 'Na escala' },
  { papel: 'Plantonista', turno: '12 h · 19–07', inicio: 12, duracao: 12, dentro: false, estado: 'Entra às 19:00' },
  { papel: 'Farmacêutico', turno: '6 h · 07–13', inicio: 0, duracao: 6, dentro: false, estado: 'Turno encerrado' },
]

const pct = (h: number) => `${(h / 24) * 100}%`

function Escala() {
  const dentro = ESCALA.filter((l) => l.dentro).length
  return (
    <figure className="escala">
      <figcaption className="escala-topo">
        <b>Escala de hoje · Sala amarela</b>
        <span className="mono">{AGORA.hora} no relógio do servidor</span>
      </figcaption>
      <div className="escala-grade" role="table" aria-label={`Escala de hoje às ${AGORA.hora}`}>
        <div className="escala-linha escala-horas" role="row" aria-hidden="true">
          <span />
          <span className="escala-trilho">
            {HORAS.map((h) => (
              <span key={h} className="mono">{h}</span>
            ))}
          </span>
        </div>
        {ESCALA.map((l, i) => (
          <div key={i} className="escala-linha" role="row">
            <span className="escala-quem" role="rowheader">
              {l.papel}
              <small className="mono">{l.turno}</small>
            </span>
            <span className="escala-trilho" role="cell">
              <span className={`escala-turno ${l.dentro ? 'dentro' : 'fora'}`} style={{ left: pct(l.inicio), width: pct(l.duracao) }}>
                {l.estado}
              </span>
              <span className="escala-agora" style={{ left: pct(AGORA.desde7) }} aria-hidden="true">
                {i === 0 && <span className="mono">agora</span>}
              </span>
            </span>
          </div>
        ))}
      </div>
      <p className="escala-nota">
        Às {AGORA.hora}, {dentro} das {ESCALA.length} pessoas estão na escala e veem os pacientes do setor. As outras
        veem o aviso “Você não está na escala agora”. Valores ilustrativos.
      </p>
    </figure>
  )
}

// ── registro: cada grupo é uma linha do livro ───────────────────────────────
function Registro({ id, rotulo, titulo, abertura, aparte, children }: { id?: string; rotulo: string; titulo: string; abertura?: ReactNode; aparte?: ReactNode; children: ReactNode }) {
  return (
    <section className="registro" id={id}>
      <div className="registro-margem">
        <span className="registro-rotulo">{rotulo}</span>
        {aparte}
      </div>
      <div>
        {/* padrao-ok: título da página pública (desenho de marca, landing.css) */}
        <h2>{titulo}</h2>
        {abertura && <p className="registro-abertura">{abertura}</p>}
        <dl className="linhas">{children}</dl>
      </div>
    </section>
  )
}

function Item({ termo, dado, children }: { termo: string; dado?: string; children: ReactNode }) {
  return (
    <div className={dado ? 'linha linha-dado' : 'linha'}>
      <dt>
        {dado && <span className="linha-n mono">{dado}</span>}
        {termo}
      </dt>
      <dd>{children}</dd>
    </div>
  )
}

const PAPEIS: [string, string][] = [
  ['Recepção', 'Abre a ficha do paciente na porta e acompanha as filas.'],
  ['Enfermagem', 'Enfermeiro e técnico: triagem e classificação de risco (só o enfermeiro classifica), checagem da medicação, coleta, observação e internação.'],
  ['Plantonista', 'Atendimento na porta, prescrição, exames, evolução, alta e passagem de plantão.'],
  ['Farmacêutico', 'Dispensação, estoque e alta vigilância. Confere a alteração de prescrição: o que não confere volta para quem alterou.'],
  ['Gestor', 'Escala, presença, painel e listas da unidade, e reabertura de contas.'],
  ['Faturamento', 'Contas do atendimento, BPA, AIH e APAC, pré-auditoria e glosas.'],
  ['Regulador e NIR', 'Fila regulada, decisão, mapa de vagas e cobranças.'],
  ['Telemedicina', 'Apoio remoto ao plantonista.'],
  ['Administrador', 'Todas as unidades da organização, só em agregado: nenhuma tela mostra identidade de paciente.'],
]

/** Id da onda: a tela de login (Login.tsx) a retira quando o próprio véu já cobre a tela. */
const ID_ONDA = 'cc-onda-landing'

// Ir para o login: o verde do botão cresce a partir do ponto clicado até
// cobrir a tela, e o login recolhe esse mesmo verde para a coluna da marca.
// Quem pediu menos movimento vai direto. Clique com modificador abre normal.
function useOndaAteLogin() {
  const navigate = useNavigate()
  const saindo = useRef(false)
  return useCallback(
    (ev: MouseEvent<HTMLAnchorElement>) => {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return
      ev.preventDefault()
      if (saindo.current) return
      saindo.current = true
      void import('@/pages/Login') // a tela chega carregada no fim da onda
      const vai = () => navigate('/login', { state: { daLanding: true } })
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        vai()
        return
      }
      const r = ev.currentTarget.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = r.top + r.height / 2
      const raio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
      const onda = document.createElement('span')
      onda.id = ID_ONDA
      onda.setAttribute('aria-hidden', 'true')
      Object.assign(onda.style, {
        position: 'fixed', zIndex: '90', pointerEvents: 'none', borderRadius: '50%', background: 'var(--color-veu)',
        left: `${x}px`, top: `${y}px`, width: `${raio * 2}px`, height: `${raio * 2}px`,
        margin: `${-raio}px 0 0 ${-raio}px`, transform: 'scale(0.02)', opacity: '0.001',
      })
      document.body.appendChild(onda)
      // Garantia: a onda nunca fica presa na tela se o login não a retirar.
      window.setTimeout(() => onda.remove(), 2500)
      let foi = false
      const uma = () => {
        if (foi) return
        foi = true
        vai()
      }
      if (typeof onda.animate === 'function') {
        onda
          .animate(
            [
              { transform: 'scale(0.02)', opacity: 0.55 },
              { transform: 'scale(0.45)', opacity: 0.9, offset: 0.35 },
              { transform: 'scale(1)', opacity: 1 },
            ],
            { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
          )
          .finished.then(uma, uma)
      }
      // O link nunca fica sem efeito: vale o fim da animação ou o prazo.
      window.setTimeout(uma, 740)
    },
    [navigate],
  )
}

function Acoes({ onda }: { onda: (ev: MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <div className="acoes">
      <Link className="btn btn-primario" to="/login" onClick={onda}>
        Entrar
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
      <Link className="btn btn-secundario" to="/cadastro">Primeiro acesso</Link>
    </div>
  )
}

export default function Landing() {
  const onda = useOndaAteLogin()

  useEffect(() => {
    const anterior = document.title
    document.title = 'Chefe Coruja — a escala é a porta'
    return () => {
      document.title = anterior
    }
  }, [])

  return (
    <div className="lp">
      <header className="topo">
        <div className="env">
          <Link className="marca" to="/">
            <span className="marca-quadrado"><Bird size={17} aria-hidden="true" /></span>
            <span className="marca-nome">Chefe Coruja</span>
          </Link>
          <nav className="menu" aria-label="Seções">
            <a href="#registro">Como funciona</a>
            <a href="#seguranca">Segurança</a>
            <a href="#papeis">Papéis</a>
          </nav>
          <div className="topo-acoes">
            <Link className="topo-link" to="/cadastro">Primeiro acesso</Link>
            <Link className="btn btn-primario" to="/login" onClick={onda}>Entrar</Link>
          </div>
        </div>
      </header>

      <main>
        <div className="folha">
          <div className="env">
            <div className="porta">
              {/* padrao-ok: título da página pública (desenho de marca, landing.css) */}
              <h1>A escala é a porta de entrada.</h1>
              <div>
                <p className="porta-texto">
                  Quem trabalha na unidade só entra se estiver na escala naquele momento, pelo relógio do servidor. O
                  check-in confirma a presença dentro do raio da unidade, e o gestor vê a hora e o lugar.
                </p>
                <Acoes onda={onda} />
              </div>
            </div>
            <Escala />
          </div>
        </div>

        <div className="env">
          <section className="painel">
            <div className="painel-texto">
              {/* padrao-ok: título da página pública (desenho de marca, landing.css) */}
              <h2>O plantão, como a tela mostra.</h2>
              <p>
                A cor do rótulo diz o que é a grandeza: leitos, observação, turno, suprimento. O número usa a cor do
                estado e cresce com ele; ler a tela é procurar o número maior e mais colorido.
              </p>
            </div>
            <div className="faixa-cartao">
              <div className="faixa">
                <div className="param">
                  <span className="param-rot" style={{ color: 'var(--cc-leitos)' }}><Users size={12} aria-hidden="true" />Sob seu cuidado</span>
                  <span className="param-val" style={{ fontSize: 30 }}>8<span className="param-un">pacientes</span></span>
                  <span className="param-est">Leitos 12 a 24</span>
                  <span className="campo"><span className="fill" style={{ width: '61.5%', background: 'var(--cc-leitos)' }} /><span className="lim" style={{ left: '84.6%' }} /></span>
                </div>
                <div className="param">
                  <span className="param-rot" style={{ color: 'var(--cc-observacao)' }}><Clock size={12} aria-hidden="true" />Maior permanência</span>
                  <span className="param-val" style={{ color: 'var(--cc-critico)', fontSize: 42 }}>7h20</span>
                  <span className="param-est" style={{ color: 'var(--cc-critico)' }}>2 pacientes acima do limite de 6h</span>
                  <span className="campo"><span className="fill" style={{ width: '81.4%', background: 'var(--cc-observacao)' }} /><span className="lim" style={{ left: '66.7%' }} /></span>
                </div>
                <div className="param">
                  <span className="param-rot" style={{ color: 'var(--cc-turno)' }}><Hourglass size={12} aria-hidden="true" />Restam no turno</span>
                  <span className="param-val" style={{ fontSize: 30 }}>4h28</span>
                  <span className="param-est">Em plantão desde 07:04</span>
                  <span className="campo"><span className="fill" style={{ width: '63%', background: 'var(--cc-turno)' }} /></span>
                </div>
                <div className="param">
                  <span className="param-rot" style={{ color: 'var(--cc-suprimento)' }}><FlaskConical size={12} aria-hidden="true" />Da farmácia</span>
                  <span className="param-val" style={{ color: 'var(--cc-atencao)', fontSize: 36 }}>1<span className="param-un">aviso</span></span>
                  <span className="param-est" style={{ color: 'var(--cc-atencao)' }}>Falta de noradrenalina 8 mg</span>
                  <span className="campo"><span className="fill" style={{ width: '25%', background: 'var(--cc-suprimento)' }} /><span className="lim" style={{ left: '10%' }} /></span>
                </div>
              </div>
              <p className="faixa-nota">A faixa de parâmetros do plantonista, como aparece na tela. Valores ilustrativos.</p>
            </div>
          </section>

          <div id="registro">
            <Registro rotulo="O plantão" titulo="Três fatos que a tela obedece.">
              <Item termo="A janela de observação" dado="6h">
                O prazo tem consequência clínica. O número que conta as observações vencidas é também o caminho até elas.
              </Item>
              <Item termo="O turno" dado="12h">
                Turnos de 12 h (07–19, 19–07) ou de 6 h, pela escala de cada setor. Fora do turno, a porta fecha.
              </Item>
              <Item termo="Leito antes do nome" dado="12A">
                É assim que o plantonista fala, e é o quanto a tela precisa mostrar. As listas quebram em duas linhas em
                vez de rolar para o lado, porque rolar esconderia a pendência.
              </Item>
            </Registro>

            <Registro rotulo="Prontuário" titulo="O registro acontece dentro do turno.">
              <Item termo="Abre pelo leito">
                12A, 14B, Box 1, com o que o turno anterior deixou na passagem de plantão já em cima.
              </Item>
              <Item termo="Prescrição com o padrão da casa">
                A diluição da unidade chega junto do medicamento. Prescrever fora dela vira pendência para a farmácia
                conferir.
              </Item>
              <Item termo="Cada registro preso ao turno">
                Autor, horário e plantão acompanham a evolução. O que ficou pendente vai para a passagem de plantão.
              </Item>
            </Registro>

            <Registro id="seguranca" rotulo="Segurança" titulo="O sistema sabe quem entrou, de onde e quando." abertura="Não é auditoria feita depois. É a mesma regra que abre a porta: se a escala não autoriza, a tela não abre.">
              <Item termo="O acesso vem da escala">
                Quem não está escalado naquele momento não entra, e o momento é o do relógio do servidor, não o do aparelho.
              </Item>
              <Item termo="Presença com hora e lugar">
                O check-in exige estar dentro do raio da unidade. Fora dele, só com justificativa, que o gestor vê no mesmo
                dia.
              </Item>
              <Item termo="Trilha que não se reescreve">
                Toda alteração tem autor e horário, numa auditoria só de inserção, encadeada para que nada seja apagado
                em silêncio.
              </Item>
            </Registro>

            <Registro rotulo="Dados pessoais" titulo="Menos dado em tela é menos risco." abertura="A LGPD pede finalidade e o mínimo necessário. No plantão isso já era hábito: o paciente é o leito.">
              <Item termo="Administrador não vê paciente">
                As telas de rede mostram ocupação, unidades e pendências técnicas, nunca identidade.
              </Item>
              <Item termo="IA sem identidade de paciente">
                Antes de qualquer consulta a um modelo de IA, o sistema retira os identificadores do paciente. Se não
                conseguir, não envia.
              </Item>
            </Registro>

            <Registro rotulo="Verificação" titulo="Contado no código, não estimado." abertura="Números do próprio app, contados em 29/09/2026: as ferramentas, no registro clínico; as verificações, nos testes do banco.">
              <Item termo="Ferramentas clínicas" dado="200">Em 8 seções do registro, todas na busca.</Item>
              <Item termo="Arquivos de teste do banco" dado="34">Cada um roda numa transação desfeita.</Item>
              <Item termo="Verificações de banco" dado="240">Regras de acesso, escala e registro clínico.</Item>
              <Item termo="Segundo fator" dado="24h">Dado de paciente só aparece com o segundo fator confirmado nas últimas 24 horas, conferido no servidor.</Item>
            </Registro>
          </div>

          <Registro
            id="papeis"
            rotulo="Papéis"
            titulo="Cada papel, o seu produto."
            abertura="Os papéis têm o mesmo peso. Um mesmo usuário pode ter papéis diferentes em unidades diferentes; vale o da unidade selecionada."
            aparte={
              <img
                className="coruja"
                src="/landing/coruja.webp"
                width={860}
                height={960}
                loading="lazy"
                alt="Dr. Coruja, o mascote do Chefe Coruja, de jaleco e estetoscópio"
              />
            }
          >
            {PAPEIS.map(([nome, texto]) => (
              <Item key={nome} termo={nome}>{texto}</Item>
            ))}
          </Registro>

          <section className="fecho">
            {/* padrao-ok: título da página pública (desenho de marca, landing.css) */}
            <h2>Comece pelo papel que você exerce.</h2>
            <div>
              <p>
                O acesso abre no papel que a sua unidade liberou para você. Primeiro acesso? Ative a conta e aguarde a
                liberação do gestor da unidade.
              </p>
              <Acoes onda={onda} />
            </div>
          </section>
        </div>
      </main>

      <footer className="rodape">
        <div className="env">
          <span>© {new Date().getFullYear()} Chefe Coruja</span>
          <span>Prontuário eletrônico centrado no plantão</span>
        </div>
      </footer>
    </div>
  )
}
