import { useCallback, useEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bird,
  Building2,
  CalendarClock,
  ClipboardList,
  Clock,
  FlaskConical,
  Hourglass,
  LayoutDashboard,
  MapPin,
  PlayCircle,
  Pill,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  Users,
  type LucideIcon,
} from 'lucide-react'

import './landing.css'

// Porta pública do produto: quem chega em "/" sem sessão vê esta página; quem
// tem sessão segue direto para a sua tela inicial (ver RequireAuth). Porta de
// landing.html do protótipo, com o texto ajustado ao produto real — os links
// que abriam o protótipo agora levam ao login.

type Papel = { nome: string; cor: string; Icone: LucideIcon; texto: string; telas: string }

const PAPEIS: Papel[] = [
  {
    nome: 'Plantonista',
    cor: 'var(--leitos)',
    Icone: Stethoscope,
    texto: 'Atende, prescreve, evolui e consulta as ferramentas clínicas do plantão — com os pacientes sob seu cuidado primeiro.',
    telas: 'Plantão · Meu plantão · Agenda · Avisos',
  },
  {
    nome: 'Enfermagem',
    cor: 'var(--critico)',
    Icone: HeartPulse,
    texto: 'Enfermeiro e técnico: triagem, classificação de risco feita pela enfermagem, sinais vitais e cuidados.',
    telas: 'Triagem · Cuidados · Sinais vitais',
  },
  {
    nome: 'Farmacêutico',
    cor: 'var(--suprimento)',
    Icone: FlaskConical,
    texto: 'Mantém a diluição padrão, responde às faltas e valida alterações de prescrição — o que não confere volta para quem alterou.',
    telas: 'Central do farmacêutico · Avisos',
  },
  {
    nome: 'Recepção',
    cor: 'var(--turno)',
    Icone: ClipboardList,
    texto: 'Abre a ficha de chegada e organiza a fila de atendimento da unidade.',
    telas: 'Ficha de chegada · Fila',
  },
  {
    nome: 'Gestor',
    cor: 'var(--observacao)',
    Icone: LayoutDashboard,
    texto: 'Monta a escala por setor, audita presença, acompanha ocupação e indicadores da unidade.',
    telas: 'Unidade · Escala · Presenças · Indicadores',
  },
  {
    nome: 'Administrador',
    cor: 'var(--tinta-profunda)',
    Icone: Building2,
    texto: 'Enxerga todas as unidades da organização e as pendências técnicas. Sem identidade de paciente em nenhuma tela.',
    telas: 'Rede · Pessoas · Olho de Gavião',
  },
]

function Marcador({ Icone, cor, fundo, titulo, children }: { Icone: LucideIcon; cor: string; fundo: string; titulo: string; children: ReactNode }) {
  return (
    <div className="marcador">
      <span className="marcador-icone" style={{ background: fundo, color: cor }}>
        <Icone size={17} />
      </span>
      <span>
        <b>{titulo}</b>
        {children}
      </span>
    </div>
  )
}

function Barra(style: CSSProperties) {
  return <span className="barra" style={{ transform: 'rotate(-38deg)', ...style }} />
}

// O vídeo se comporta como um GIF: parado no primeiro quadro, anima enquanto o
// ponteiro está em cima (ou com foco/toque). Menos movimento = controles nativos.
function VideoProntuario() {
  const video = useRef<HTMLVideoElement>(null)
  const dica = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const v = video.current
    if (!v) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.controls = true
      dica.current?.remove()
      return
    }
    const anima = () => {
      v.play().catch(() => {})
      if (dica.current) dica.current.style.opacity = '0'
    }
    const para = () => {
      v.pause()
      if (dica.current) dica.current.style.opacity = '1'
    }
    const alterna = () => (v.paused ? anima() : para())
    v.addEventListener('mouseenter', anima)
    v.addEventListener('mouseleave', para)
    v.addEventListener('focus', anima)
    v.addEventListener('blur', para)
    v.addEventListener('click', alterna)
    return () => {
      v.removeEventListener('mouseenter', anima)
      v.removeEventListener('mouseleave', para)
      v.removeEventListener('focus', anima)
      v.removeEventListener('blur', para)
      v.removeEventListener('click', alterna)
    }
  }, [])

  return (
    <>
      <video
        ref={video}
        className="cena-video"
        muted
        loop
        playsInline
        preload="metadata"
        tabIndex={0}
        poster="/landing/prontuario-poster.webp"
        aria-label="Enfermeira interagindo com o prontuário eletrônico em holograma — passe o mouse para animar"
      >
        <source src="/landing/prontuario.mp4" type="video/mp4" />
      </video>
      <span ref={dica} className="dica-video" aria-hidden="true">
        <PlayCircle size={14} />
        Passe o mouse
      </span>
    </>
  )
}

// Verificação: só números contados no próprio código do app, reproduzíveis
// com os comandos da nota. Não há medição de render (contraste, foco,
// transbordo) no projeto — por isso a seção não traz esses números.
// Contagem de 29/09/2026; recontar ao mexer no registro ou nos testes.
const MEDIDAS = [
  { n: '200', rot: 'Ferramentas clínicas', nota: 'em 8 seções do registro, todas na busca' },
  { n: '34', rot: 'Arquivos de teste do banco', nota: 'cada um roda numa transação desfeita' },
  { n: '240', rot: 'Verificações de banco', nota: 'regras de acesso, escala e registro clínico' },
  { n: '24h', rot: 'Janela do segundo fator', nota: 'conferida no servidor, não no aparelho' },
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
        position: 'fixed', zIndex: '90', pointerEvents: 'none', borderRadius: '50%', background: '#0B3B34',
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
      <div className="palco">
        <div className="palco-campo" aria-hidden="true">
          <Barra width={760} height={96} right={-180} top={-60} background="var(--marca)" />
          <Barra width={560} height={96} right={-70} top={170} background="#5EEAD426" />
          <Barra width={380} height={96} right={-120} top={420} background="#FFFFFF14" />
          <span className="bolha" style={{ width: 260, height: 260, left: '2%', bottom: -100, background: '#5EEAD414' }} />
          <span className="anel" style={{ width: 150, height: 150, left: '12%', top: 118 }} />
          <span className="bolha" style={{ width: 14, height: 14, left: '34%', top: 330, background: '#5EEAD4A6' }} />
          <span className="bolha" style={{ width: 9, height: 9, right: '20%', bottom: 74, background: '#5EEAD48C' }} />
          <span className="bolha" style={{ width: 20, height: 20, right: '8%', top: 90, background: '#5EEAD466' }} />
        </div>
        <div className="orbita" aria-hidden="true">
          <span className="disco" style={{ width: 64, height: 64, left: '15%', top: 84, background: 'var(--leitos)' }}><Users size={27} /></span>
          <span className="disco" style={{ width: 56, height: 56, right: 18, top: 146, background: 'var(--observacao)' }}><Clock size={24} /></span>
          <span className="disco disco-claro" style={{ width: 58, height: 58, left: '9%', bottom: 78, color: 'var(--suprimento)' }}><FlaskConical size={24} /></span>
          <span className="disco disco-claro" style={{ width: 50, height: 50, right: '16%', bottom: 28, color: 'var(--acao)' }}><MapPin size={21} /></span>
        </div>

        <header className="topo">
          <div className="env">
            <Link className="marca" to="/">
              <span className="marca-quadrado"><Bird size={18} /></span>
              <span className="marca-nome">Chefe Coruja</span>
            </Link>
            <nav className="menu">
              <a href="#mecanismo">O mecanismo</a>
              <a href="#papeis">Papéis</a>
              <a href="#prontuario">Prontuário</a>
              <a href="#seguranca">Segurança</a>
              <a href="#lgpd">LGPD</a>
              <a href="#prova">Verificação</a>
            </nav>
            <Link className="btn btn-primario" to="/login" onClick={onda}>
              Entrar
              <ArrowRight size={16} />
            </Link>
          </div>
        </header>

        <div className="env hero">
          <div>
            <span className="kicker"><Stethoscope size={15} />Gestão de plantão hospitalar</span>
            <h1>A escala é a <em>porta</em> de entrada.</h1>
            <p className="abertura">
              Quem trabalha na unidade só entra se estiver na escala naquele momento, pelo relógio do servidor. O
              check-in confirma presença dentro do raio da unidade — e o horário e o local chegam ao gestor.
            </p>
            <div className="acoes">
              <Link className="btn btn-primario" to="/login" onClick={onda}>
                Entrar no Chefe Coruja
                <ArrowRight size={16} />
              </Link>
              <a className="btn btn-contorno" href="#papeis">Ver os papéis</a>
            </div>
            <div className="rodape-hero">
              <div><b>12h · 6h</b><span>turnos da escala</span></div>
              <div><b>8</b><span>papéis na unidade</span></div>
              <div><b>1</b><span>autor em cada registro</span></div>
            </div>
          </div>

          <div className="palco-figura">
            <img
              className="cena-coruja"
              src="/landing/coruja.webp"
              width={860}
              height={960}
              fetchPriority="high"
              alt="Dr. Coruja, o mascote do Chefe Coruja, de jaleco e crachá de CEO"
            />
          </div>
        </div>
      </div>

      <div className="env">
        <div className="faixa-cartao">
          <div className="faixa">
            <div className="param">
              <span className="param-rot" style={{ color: 'var(--leitos)' }}><Users size={12} />Sob seu cuidado</span>
              <span className="param-val" style={{ color: '#1E293B', fontSize: 30 }}>8<span className="param-un">pacientes</span></span>
              <span className="param-est" style={{ color: 'var(--tinta-media)' }}>Leitos 12 a 24</span>
              <span className="campo"><span className="fill" style={{ width: '61.5%', background: 'var(--leitos)' }} /><span className="lim" style={{ left: '84.6%' }} /></span>
            </div>
            <div className="param">
              <span className="param-rot" style={{ color: 'var(--observacao)' }}><Clock size={12} />Maior permanência</span>
              <span className="param-val" style={{ color: 'var(--critico)', fontSize: 42 }}>7h20</span>
              <span className="param-est" style={{ color: 'var(--critico)' }}>2 acima do limite de 6h</span>
              <span className="campo"><span className="fill" style={{ width: '81.4%', background: 'var(--observacao)' }} /><span className="lim" style={{ left: '66.7%' }} /></span>
            </div>
            <div className="param">
              <span className="param-rot" style={{ color: 'var(--turno)' }}><Hourglass size={12} />Restam no turno</span>
              <span className="param-val" style={{ color: '#1E293B', fontSize: 30 }}>4h12</span>
              <span className="param-est" style={{ color: 'var(--tinta-media)' }}>Em plantão desde 07:04</span>
              <span className="campo"><span className="fill" style={{ width: '65%', background: 'var(--turno)' }} /></span>
            </div>
            <div className="param">
              <span className="param-rot" style={{ color: 'var(--suprimento)' }}><FlaskConical size={12} />Da farmácia</span>
              <span className="param-val" style={{ color: 'var(--atencao)', fontSize: 36 }}>1<span className="param-un">aviso</span></span>
              <span className="param-est" style={{ color: 'var(--atencao)' }}>Falta de noradrenalina 8 mg</span>
              <span className="campo"><span className="fill" style={{ width: '25%', background: 'var(--suprimento)' }} /><span className="lim" style={{ left: '10%' }} /></span>
            </div>
          </div>
          <div className="legenda-faixa">A faixa de parâmetros do produto, como ela aparece na tela. Valores ilustrativos.</div>
        </div>
      </div>

      <main>
        <section className="env" id="mecanismo">
          <span className="rotulo-secao">O sistema visual</span>
          <h2>Duas regras carregam a tela inteira</h2>
          <p className="sub">
            Um monitor multiparamétrico em modo diurno — porque a cena é o posto de enfermagem com a luz acesa, não a
            UTI no escuro.
          </p>
          <div className="regras">
            <div className="regra">
              <span className="regra-marca" style={{ background: '#15803D14' }} />
              <h3>A identidade pertence à grandeza</h3>
              <p>Leitos são verdes, observação é âmbar, turno é cinza, suprimento é azul. A cor aparece no rótulo e na barra, sempre a mesma.</p>
              <div className="pastilhas">
                {[
                  ['Leitos', 'var(--leitos)', '#15803D14'],
                  ['Observação', 'var(--observacao)', '#B4530914'],
                  ['Turno', 'var(--turno)', '#47556914'],
                  ['Suprimento', 'var(--suprimento)', '#1D4ED814'],
                ].map(([nome, cor, fundo]) => (
                  <span key={nome} className="pastilha" style={{ color: cor, background: fundo }}>
                    <i style={{ background: cor }} />
                    {nome}
                  </span>
                ))}
              </div>
            </div>
            <div className="regra">
              <span className="regra-marca" style={{ background: '#B91C1C14' }} />
              <h3>O estado pertence ao numeral</h3>
              <p>O número não usa a cor da grandeza: usa a cor do estado, e cresce com ele. Ler a tela é procurar o numeral maior e mais colorido.</p>
              <div className="amostra">
                <span style={{ fontSize: 30, color: '#1E293B' }}>8</span>
                <span style={{ fontSize: 36, color: 'var(--atencao)' }}>18</span>
                <span style={{ fontSize: 42, color: 'var(--critico)' }}>7h20</span>
                <small>em ordem · em atenção · em alarme</small>
              </div>
            </div>
          </div>
        </section>

        <section className="env">
          <span className="rotulo-secao">O que o plantão impõe</span>
          <h2>Três fatos operacionais que a tela obedece</h2>
          <div className="fatos">
            <div className="fato">
              <span className="fato-n" style={{ color: 'var(--observacao)' }}>6h</span>
              <h3>A janela de observação</h3>
              <p>O prazo tem consequência clínica. O número que conta as observações vencidas é também o caminho até elas.</p>
            </div>
            <div className="fato">
              <span className="fato-n" style={{ color: 'var(--turno)' }}>12h</span>
              <h3>O turno, e o raio da unidade</h3>
              <p>
                Turnos de 12h (07–19, 19–07) ou de 6h. O check-in exige estar dentro do raio geográfico; se o GPS
                falhar, o profissional justifica e o gestor vê no mesmo dia.
              </p>
            </div>
            <div className="fato">
              <span className="fato-n" style={{ color: 'var(--leitos)' }}>12A</span>
              <h3>Leito antes do nome</h3>
              <p>É assim que o plantonista fala. As listas refluem em duas linhas em vez de rolar na horizontal, porque rolar esconderia a pendência.</p>
            </div>
          </div>
        </section>

        <section className="env" id="papeis">
          <span className="rotulo-secao">Quem entra</span>
          <h2>Cada papel, o seu produto</h2>
          <p className="sub">
            Um mesmo usuário pode ter papéis diferentes em unidades diferentes; o papel ativo é sempre o da unidade
            selecionada, e só vale dentro da escala.
          </p>
          <div className="papeis">
            {PAPEIS.map(({ nome, cor, Icone, texto, telas }) => (
              <Link key={nome} className="papel" to="/login" onClick={onda}>
                <span className="papel-barra" style={{ background: cor }} />
                <span className="papel-topo">
                  <span className="papel-icone" style={{ background: cor }}><Icone size={20} /></span>
                  <span className="papel-nome">{nome}</span>
                </span>
                <p>{texto}</p>
                <span className="papel-telas">{telas}</span>
                <span className="papel-ir">Entrar<ArrowRight size={15} /></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="env" id="prontuario">
          <div className="duo duo-invertido">
            <div>
              <span className="rotulo-secao">Prontuário eletrônico</span>
              <h2>O registro acontece dentro do turno</h2>
              <p className="sub">Evolução, prescrição e resultado no mesmo lugar em que o plantão acontece — abertos pelo leito, não por uma busca de paciente.</p>
              <div className="marcadores">
                <Marcador Icone={ClipboardList} cor="var(--leitos)" fundo="#15803D14" titulo="Abre pelo leito">
                  12A, 14B, Box 1 — com o que o turno anterior deixou no handoff já em cima.
                </Marcador>
                <Marcador Icone={Pill} cor="var(--suprimento)" fundo="#1D4ED814" titulo="Prescrição com o padrão da casa">
                  A diluição institucional chega junto da droga. Prescrever fora dela vira pendência para a farmácia conferir.
                </Marcador>
                <Marcador Icone={Clock} cor="var(--observacao)" fundo="#B4530914" titulo="Cada registro fica preso ao seu turno">
                  Autor, horário e plantão acompanham a evolução. O que ficou pendente é o que vai para o handoff.
                </Marcador>
              </div>
            </div>
            <div className="duo-midia">
              <span className="duo-placa" aria-hidden="true">
                <Barra width={420} height={72} left={-90} top={-40} background="var(--marca)" />
                <span className="bolha" style={{ width: 140, height: 140, right: -30, bottom: -50, background: '#5EEAD414' }} />
              </span>
              <VideoProntuario />
            </div>
          </div>
        </section>

        <section className="env" id="seguranca">
          <div className="duo">
            <div>
              <span className="rotulo-secao">Segurança</span>
              <h2>O sistema sabe quem entrou, de onde e quando</h2>
              <p className="sub">Não é auditoria feita depois. É a mesma regra que abre a porta: se a escala não autoriza, a tela não abre.</p>
              <div className="marcadores">
                <Marcador Icone={CalendarClock} cor="var(--acao)" fundo="#0D94881A" titulo="O acesso vem da escala">
                  Quem não está escalado naquele momento não entra — e o momento é o do relógio do servidor, não o do aparelho.
                </Marcador>
                <Marcador Icone={MapPin} cor="var(--leitos)" fundo="#15803D14" titulo="Presença com hora e lugar">
                  O check-in exige estar dentro do raio da unidade. Fora dele, só com justificativa, que o gestor vê.
                </Marcador>
                <Marcador Icone={ShieldCheck} cor="var(--observacao)" fundo="#B4530914" titulo="Trilha que não se reescreve">
                  Toda alteração tem autor e horário, numa auditoria só de inserção, encadeada para que nada seja apagado em silêncio.
                </Marcador>
              </div>
            </div>
            <div className="duo-midia">
              <span className="duo-placa" aria-hidden="true">
                <Barra width={420} height={72} right={-90} top={-30} background="var(--marca)" />
                <Barra width={300} height={72} right={-60} bottom={40} background="#5EEAD41F" />
                <span className="bolha" style={{ width: 140, height: 140, left: -30, bottom: -40, background: '#5EEAD414' }} />
              </span>
              <img className="cena-foto" src="/landing/seguranca.webp" loading="lazy" alt="Guardião cibernético protegendo o servidor e a rede da unidade" />
              <span className="disco" style={{ width: 52, height: 52, right: -14, top: 44, background: 'var(--tinta-profunda)' }} aria-hidden="true">
                <ShieldCheck size={22} />
              </span>
            </div>
          </div>
        </section>

        <section className="env" id="lgpd">
          <div className="duo duo-invertido">
            <div>
              <span className="rotulo-secao">Dados pessoais</span>
              <h2>Menos dado em tela é menos risco</h2>
              <p className="sub">A LGPD pede finalidade e mínimo necessário. No plantão isso já era hábito clínico: o paciente é o leito.</p>
              <div className="marcadores">
                <Marcador Icone={Users} cor="var(--leitos)" fundo="#15803D14" titulo="Leito antes do nome">
                  É como o plantonista fala, e é o quanto a tela precisa mostrar para o cuidado acontecer.
                </Marcador>
                <Marcador Icone={Building2} cor="var(--suprimento)" fundo="#1D4ED814" titulo="Administrador não vê paciente">
                  As telas de rede mostram ocupação, sincronia de unidade e pendência técnica — nunca identidade.
                </Marcador>
                <Marcador Icone={ShieldCheck} cor="var(--acao)" fundo="#0D94881A" titulo="IA sem identidade de paciente">
                  Antes de qualquer consulta a um modelo de IA, o gateway retira os identificadores. Se não conseguir, não envia.
                </Marcador>
              </div>
            </div>
            <div className="duo-midia">
              <span className="duo-placa" aria-hidden="true" style={{ background: 'var(--lavagem)' }}>
                <Barra width={420} height={72} left={-90} top={-30} background="#0D948826" />
                <Barra width={300} height={72} left={-60} bottom={40} background="#0D948814" />
                <span className="bolha" style={{ width: 140, height: 140, right: -30, bottom: -40, background: '#0D94881A' }} />
              </span>
              <img className="cena-foto" src="/landing/lgpd.webp" loading="lazy" alt="Médica segurando o certificado de conformidade com a LGPD" />
              <span className="disco" style={{ width: 52, height: 52, left: -14, top: 44, background: 'var(--leitos)' }} aria-hidden="true">
                <ShieldCheck size={22} />
              </span>
            </div>
          </div>
        </section>

        <section className="prova" id="prova">
          <span className="formas" aria-hidden="true">
            <Barra width={520} height={64} right={-140} top={-30} background="#FFFFFF12" />
            <Barra width={340} height={64} right={-60} bottom={-20} background="#5EEAD41A" />
          </span>
          <div className="env">
            <span className="rotulo-secao">Verificação</span>
            <h2>Contado no código, não estimado</h2>
            <p className="sub">
              Os números saem do próprio app e são reprodutíveis: as ferramentas, do registro clínico; as verificações,
              dos testes do banco, que rodam com <code>npm run test:banco</code>.
            </p>
            <div className="medidas">
              {MEDIDAS.map((m) => (
                <div key={m.rot} className="medida">
                  <span className="medida-n">{m.n}</span>
                  <span className="medida-rot">{m.rot}</span>
                  <span className="medida-nota">{m.nota}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="fecho">
          <span className="formas" aria-hidden="true">
            <Barra width={420} height={70} right={-80} top={-26} background="#0D948826" />
            <span className="bolha" style={{ width: 160, height: 160, left: -40, bottom: -60, background: '#0D948814' }} />
          </span>
          <div className="env fecho-cartao">
            <div>
              <h2>Comece pelo papel que você exerce</h2>
              <p className="sub" style={{ marginTop: 10 }}>
                O acesso abre no papel que a sua unidade liberou para você; quem tem mais de um troca pelo menu do
                usuário, no topo da tela. Primeiro acesso? Ative a conta e aguarde a liberação do gestor da unidade.
              </p>
            </div>
            <div className="acoes" style={{ marginTop: 0 }}>
              <Link className="btn btn-primario" to="/login" onClick={onda}>
                Entrar no plantão
                <ArrowRight size={16} />
              </Link>
              <Link className="btn btn-claro" to="/cadastro">Primeiro acesso</Link>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="env">
          <span className="rodape-nota">© {new Date().getFullYear()} Chefe Coruja</span>
          <span className="rodape-nota">Gestão de plantão e prontuário eletrônico</span>
        </div>
      </footer>
    </div>
  )
}
