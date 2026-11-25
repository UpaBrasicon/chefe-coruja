// ─────────────────────────────────────────────────────────────────────────────
// Precauções por tipo de isolamento: requisito do quarto, paramentação e
// transporte (RG5 do modelo da Regulação; decisão do RT de 25/11/2026: a
// orientação entra, com a fonte citada). Só o que está escrito na fonte; o
// que a fonte não trata fica dito como "sem texto próprio".
//
// Fontes (conferidas no texto em 25/11/2026):
// • Anvisa, "Protocolo de Precauções e Isolamento em Serviços de Saúde",
//   versão 1 (18/11/2025; publicado na página "Precaução e Isolamento" da
//   Anvisa em 28/01/2026). É um modelo institucional (campos para o nome e a
//   logomarca da instituição), sem autoria GVIMS/GGTES escrita no documento.
// • Anvisa/Ministério da Saúde, cartaz "Precauções" (padrão, contato,
//   gotículas, aerossóis); sem ano impresso. Os mesmos cartazes estão nos
//   Anexos II a IV do protocolo.
// • CDC/HICPAC, "Guideline for Isolation Precautions: Preventing Transmission
//   of Infectious Agents in Healthcare Settings" (Siegel et al., 2007;
//   atualizado em 2024). Usado onde a Anvisa não trata (ambiente protetor) e
//   como complemento do quarto para aerossóis. Tradução fiel, sem acréscimo.
//
// Arquivo de dados puro (sem import): lido pela tela da Regulação e conferido
// contra a cópia de src/lib/folhas.ts (documento de transferência) por teste.
// ─────────────────────────────────────────────────────────────────────────────

export type TipoPrecaucao = 'contato' | 'goticula' | 'aerossol' | 'reverso' | 'contato_aerossol'

export type Fonte = { id: 'anvisa_protocolo' | 'anvisa_cartaz' | 'cdc_2007'; titulo: string; ano: number | null; link: string }

export const FONTES_PRECAUCAO: Record<Fonte['id'], Fonte> = {
  anvisa_protocolo: {
    id: 'anvisa_protocolo',
    titulo: 'Anvisa — Protocolo de Precauções e Isolamento em Serviços de Saúde, versão 1',
    ano: 2025,
    link: 'https://www.gov.br/anvisa/pt-br/assuntos/servicosdesaude/prevencao-e-controle-de-infeccao-e-resistencia-microbiana/prevencao-das-principais-iras/precaucao-e-isolamento/protocolo-5-medidas-de-precaucao-e-isolamento-final.pdf',
  },
  anvisa_cartaz: {
    id: 'anvisa_cartaz',
    titulo: 'Anvisa/Ministério da Saúde — cartaz Precauções (sem ano impresso)',
    ano: null,
    link: 'https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/cartazes/cartaz_precaues.pdf',
  },
  cdc_2007: {
    id: 'cdc_2007',
    titulo: 'CDC/HICPAC — Guideline for Isolation Precautions (Siegel et al.)',
    ano: 2007,
    link: 'https://www.cdc.gov/infection-control/media/pdfs/Guideline-Isolation-H.pdf',
  },
}

export type ItemPrecaucao = { texto: string; fonte: Fonte['id']; secao: string }

export type Precaucao = {
  tipo: TipoPrecaucao
  rotulo: string
  quarto: ItemPrecaucao[]
  paramentacao: ItemPrecaucao[]
  transporte: ItemPrecaucao[]
}

export const PRECAUCOES: Record<TipoPrecaucao, Precaucao> = {
  contato: {
    tipo: 'contato',
    rotulo: 'Precaução de contato',
    quarto: [{
      texto: 'Quarto privativo, com a porta sempre fechada. Sem quarto privativo, distância mínima de um metro entre dois leitos. Para multirresistente, banheiro de uso exclusivo ou cadeira sanitária.',
      fonte: 'anvisa_protocolo', secao: 'Quadro 5 (7.2.3), p. 20; Quadro 2, item h, p. 17',
    }],
    paramentacao: [{
      texto: 'Luvas e avental de manga longa descartáveis, exclusivos do paciente: colocar imediatamente antes do contato, dentro do quarto, e retirar logo após o uso, com higiene das mãos. Termômetro, esfigmomanômetro e estetoscópio de uso exclusivo do paciente.',
      fonte: 'anvisa_protocolo', secao: 'Quadro 2 (7.2.1), itens e–f, p. 17; cartaz Precauções',
    }],
    transporte: [{
      texto: 'Evitar o transporte. Quando necessário, o profissional usa luvas e avental descartáveis para o contato com o paciente e não toca superfícies com as mãos enluvadas; informar o destino sobre a precaução. Para multirresistente, a equipe usa avental e luvas durante todo o transporte e o veículo passa por limpeza terminal.',
      fonte: 'anvisa_protocolo', secao: 'Quadro 2, item g, p. 17; 6.4 c, p. 14; Quadro 7 (7.2.5), p. 22',
    }],
  },
  goticula: {
    tipo: 'goticula',
    rotulo: 'Precaução para gotículas',
    quarto: [{
      texto: 'Quarto privativo, com a porta sempre fechada; se possível, janelas abertas. Sem quarto privativo, pode ficar com outros pacientes infectados pelo mesmo microrganismo, a no mínimo um metro entre leitos.',
      fonte: 'anvisa_protocolo', secao: 'Quadro 5, p. 20',
    }],
    paramentacao: [{
      texto: 'Máscara cirúrgica de uso obrigatório para todas as pessoas que tiverem acesso ao quarto.',
      fonte: 'anvisa_protocolo', secao: 'Quadro 2, gotículas, item b, p. 18; cartaz Precauções',
    }],
    transporte: [{
      texto: 'Evitar o transporte. Quando necessário, o paciente usa máscara cirúrgica durante toda a permanência fora do quarto.',
      fonte: 'anvisa_protocolo', secao: 'Quadro 2, gotículas, itens b–c, p. 18',
    }],
  },
  aerossol: {
    tipo: 'aerossol',
    rotulo: 'Precaução para aerossóis',
    quarto: [
      {
        texto: 'Quarto privativo, com a porta sempre fechada. Se possível, pressão negativa, filtro HEPA e antecâmara; sem isso, se possível, janelas abertas. Sem quarto privativo, coorte só com o mesmo microrganismo; suspeita de tuberculose resistente não divide quarto com outros pacientes com tuberculose.',
        fonte: 'anvisa_protocolo', secao: 'Quadro 5, p. 20',
      },
      {
        texto: 'Quarto de isolamento para aerossóis com pressão negativa monitorada em relação à área ao redor; pelo menos 6 trocas de ar por hora em prédio existente (12 em obra nova ou reforma); ar para fora ou recirculado só por filtro HEPA; porta fechada.',
        fonte: 'cdc_2007', secao: 'V.D.2.a, p. 91; III.B.3, p. 74',
      },
    ],
    paramentacao: [{
      texto: 'Máscara N95 ou PFF2 de uso obrigatório pelo profissional durante todo o tempo no quarto: colocar antes de entrar e retirar só ao sair.',
      fonte: 'anvisa_protocolo', secao: 'Quadro 2, aerossóis, item b, p. 18; cartaz Precauções',
    }],
    transporte: [{
      texto: 'Evitar o transporte. Quando necessário, o paciente usa máscara cirúrgica durante toda a permanência fora do quarto.',
      fonte: 'anvisa_protocolo', secao: 'Quadro 2, aerossóis, itens b–c, p. 18',
    }],
  },
  reverso: {
    tipo: 'reverso',
    rotulo: 'Isolamento reverso (ambiente protetor)',
    // A Anvisa (protocolo e cartaz) não trata do ambiente protetor: fonte CDC.
    quarto: [{
      texto: 'Indicado no transplante alogênico de células-tronco hematopoéticas; o CDC não faz recomendação para outros imunossuprimidos. Quarto individual com ar de entrada filtrado por HEPA, fluxo de ar através do leito, pressão positiva em relação ao corredor (monitorada diariamente), quarto vedado, 12 ou mais trocas de ar por hora, sem carpete, flores ou plantas.',
      fonte: 'cdc_2007', secao: 'VI.A–VI.C.4, p. 95–96; III.F, p. 76',
    }],
    paramentacao: [{
      texto: 'Precauções padrão em todas as interações. Máscara, avental e luvas não são exigidos dos profissionais sem infecção suspeita ou confirmada, salvo pelas precauções padrão.',
      fonte: 'cdc_2007', secao: 'VI.F.1 e VI.F.3, p. 96',
    }],
    transporte: [{
      texto: 'Reduzir ao mínimo o tempo fora do quarto. Durante obras, dar proteção respiratória (ex.: N95) ao paciente que tolere ao sair do ambiente protetor; fora de obras, o CDC não faz recomendação.',
      fonte: 'cdc_2007', secao: 'VI.D e VI.E.1.b, p. 96',
    }],
  },
  contato_aerossol: {
    tipo: 'contato_aerossol',
    rotulo: 'Contato + aerossóis (combinado)',
    quarto: [{
      texto: 'As fontes não trazem medidas próprias para a combinação: a Anvisa diz que as precauções podem ser combinadas quando há mais de uma via de transmissão. Valem os requisitos de contato e de aerossóis.',
      fonte: 'anvisa_protocolo', secao: '3 Descrição, p. 11; Apêndice A, p. 45',
    }],
    paramentacao: [{
      texto: 'Sem texto próprio para a combinação: valem as medidas de contato (luvas e avental) e de aerossóis (N95 ou PFF2).',
      fonte: 'anvisa_protocolo', secao: '3 Descrição, p. 11',
    }],
    transporte: [{
      texto: 'Sem texto próprio para a combinação: valem as regras de transporte de contato e de aerossóis.',
      fonte: 'anvisa_protocolo', secao: '3 Descrição, p. 11',
    }],
  },
}

/** Precaução do tipo gravado (pedido ou marca do paciente); tipo desconhecido → null. */
export function precaucaoDoTipo(tipo: string | null | undefined): Precaucao | null {
  return tipo && tipo in PRECAUCOES ? PRECAUCOES[tipo as TipoPrecaucao] : null
}

/** Fontes usadas por uma precaução, sem repetir, na ordem em que aparecem. */
export function fontesDaPrecaucao(p: Precaucao): Fonte[] {
  const ids = [...p.quarto, ...p.paramentacao, ...p.transporte].map((i) => i.fonte)
  return [...new Set(ids)].map((id) => FONTES_PRECAUCAO[id])
}
