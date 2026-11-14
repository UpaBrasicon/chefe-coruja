import { completo, somar, type Escore } from '../escore.ts'
import type { Fonte } from '../ficha.ts'

// HEART: cinco componentes de 0 a 2. Porte do protótipo (cardiologia/HEART,
// construído em 29/08/2026). A linha "conduta da coorte de validação" saiu
// (ADR 0007): fica a taxa de evento em 6 semanas da coorte.

const MACE = ['1,7%', '16,6%', '50,1%']

// Lote 6 da revisão do HCFMUSP (Q2 = A, decisão do RT de 14/11/2026): a diretriz
// brasileira de dor torácica de 2025, lida no texto integral (PMC), ao lado do
// manual do HC (cap. 12, p. 183–198, conferido no PDF).
export const SBC_DOR_TORACICA_2025: Fonte = {
  citacao: 'de Barros e Silva PGM, Soeiro AM, Ornelas CE, et al. Diretriz Brasileira de Atendimento à Dor Torácica na Unidade de Emergência – 2025. Arq Bras Cardiol. 2025;122(9):e20250620 (PMID 41379176; PMC12981354). Texto integral lido; classe de recomendação e nível de evidência. HEART como escore clínico preferencial (p. 29–30).',
  url: 'https://doi.org/10.36660/abc.20250620',
}

const SEM_ITEM_DT = 'o cap. 12 não trata do ponto'

/** SBC 2025 (classe e nível como a diretriz escreve) ao lado do cap. 12 do manual do HC. */
export const DIRETRIZ_DOR_TORACICA_2025: { tema: string; diretriz: string; grau: string; fonte: string; livro: string }[] = [
  { tema: 'Eletrocardiograma', diretriz: 'ECG de 12 derivações avaliado por médico em até 10 minutos do primeiro contato com o serviço (I, B). ECG preocupante ou instabilidade: repetir a cada 10 a 20 minutos, com derivações complementares (I, C)', grau: 'I, B; I, C', fonte: 'SBC 2025', livro: 'ECG em até 2 minutos e laudado em até 10 minutos da admissão; ECG normal não descarta SCA (p. 187)' },
  { tema: 'Oxigênio', diretriz: 'Oxigênio se a saturação for < 90% (acrônimo MOVE)', grau: 'texto, sem classe', fonte: 'SBC 2025', livro: 'oxigênio se a saturação for < 94% (p. 188)' },
  { tema: 'Troponina de alta sensibilidade', diretriz: 'É o marcador de escolha (I, B). Os algoritmos de 0–1 hora e 0–2 horas são preferíveis ao de 0–3 horas (IIa, B), com os cortes e variações de cada kit', grau: 'I, B; IIa, B', fonte: 'SBC 2025', livro: 'ultrassensível na entrada e após 1 hora (o protocolo europeu aceita 2 horas), a segunda pelo menos 2 horas após o início dos sintomas (p. 187)' },
  { tema: 'Dosagem única de troponina', diretriz: 'Dor há mais de 3 horas: uma troponina de alta sensibilidade abaixo do limite de detecção pode bastar para descartar IAM, com escore de baixo risco, ECG sem isquemia e sem dor recorrente ou persistente', grau: 'IIa, B', fonte: 'SBC 2025', livro: SEM_ITEM_DT },
  { tema: 'Sem troponina de alta sensibilidade', diretriz: 'Usar o biomarcador disponível a cada 3 horas (I, B). Não pedir CK-MB quando há troponina quantitativa (III, B)', grau: 'I, B; III, B', fonte: 'SBC 2025', livro: 'troponina convencional na entrada e após 3 horas (p. 187)' },
  { tema: 'Escore de risco', diretriz: 'O HEART é o escore clínico preferencial na suspeita de SCA', grau: 'I, B', fonte: 'SBC 2025', livro: 'TIMI, HEART e EDACS lado a lado; baixo risco: TIMI 0–1, HEART 0–2, EDACS < 15 (Tabela 4, p. 192–194)' },
  { tema: 'Alta do baixo risco', diretriz: 'Descarte pelo algoritmo de 0–1 h ou 0–2 h, ECG não diagnóstico e nenhuma outra hipótese de risco: considerar alta com investigação ambulatorial, sobretudo sem doença coronária conhecida e com HEART ≤ 3 (I, B). Zona cinza ou risco não baixo: probabilidade intermediária, avaliação individual (I, B)', grau: 'I, B', fonte: 'SBC 2025', livro: 'baixo risco no HEART é 0–2 (Tabela 4, p. 194); fluxograma da Figura 1 (p. 196)' },
  { tema: 'Angiotomografia de coronárias', diretriz: 'Suspeita de SCA de risco baixo ou intermediário, com ECG normal ou não diagnóstico e marcadores sem definição de infarto (I, A). Não fazer no risco alto nem no infarto definido (III, C). Descarte triplo (IIb, B)', grau: 'I, A; III, C; IIb, B', fonte: 'SBC 2025', livro: 'exame não invasivo mais disponível no DE; FC perto de 60 bpm; não indicado na probabilidade intermediária alta ou alta; descarta SCA sem obstrução > 50% (p. 189–190)' },
  { tema: 'Antiagregação antes do diagnóstico', diretriz: 'Suspeita de SCA sem diagnóstico: só AAS até esclarecer, salvo contraindicação ou risco de sangramento. Na suspeita de dissecção, adiar qualquer antiagregante ou anticoagulante até confirmar ou descartar', grau: 'texto, sem classe', fonte: 'SBC 2025', livro: SEM_ITEM_DT },
  { tema: 'Síndrome aórtica aguda', diretriz: 'ADD-RS na avaliação inicial (IIa, B); ultrassom à beira do leito somado ao ADD-RS (IIa, B); AORTA como alternativa (IIb, C). Não usar ADD-RS ou AORTA sozinhos para excluir ou confirmar (III, B). Probabilidade baixa: D-dímero; maior que baixa: imagem', grau: 'IIa, B; IIb, C; III, B', fonte: 'SBC 2025', livro: 'ADD-RS 0–1: D-dímero, < 500 ng/mL descarta; 2–3 ou D-dímero ≥ 500: angiotomografia de aorta (Tabela 5, p. 195)' },
  { tema: 'Embolia pulmonar', diretriz: 'Wells, Genebra revisado ou Genebra simplificado na probabilidade pré-teste (I, A); PERC na baixa probabilidade (IIa, B). D-dímero ≥ 500 ng/mL, ou ajustado pela idade (idade × 10 a partir dos 50 anos)', grau: 'I, A; IIa, B', fonte: 'SBC 2025', livro: 'Genebra (Tabela 6, p. 197); D-dímero na suspeita baixa e moderada; angiotomografia na suspeita alta (p. 187)' },
]

export const heart: Escore = {
  ficha: {
    id: 'heart',
    titulo: 'HEART — dor torácica no pronto-socorro',
    versao: '2026-11-14.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Six AJ, Backus BE, Kelder JC. Chest pain in the emergency room: value of the HEART score. Neth Heart J. 2008;16(6):191–196.', url: 'https://doi.org/10.1007/BF03086144' },
      { citacao: 'Backus BE, Six AJ, Kelder JC, et al. A prospective validation of the HEART score for chest pain patients at the emergency department. Int J Cardiol. 2013;168(3):2153–2158.', url: 'https://doi.org/10.1016/j.ijcard.2013.01.255' },
      { citacao: 'Byrne RA, Rossello X, Coughlan JJ, et al. 2023 ESC Guidelines for the management of acute coronary syndromes. Eur Heart J. 2023;44(38):3720–3826.', url: 'https://doi.org/10.1093/eurheartj/ehad191' },
      SBC_DOR_TORACICA_2025,
    ],
    revisadoEm: '14/11/2026 (diretriz brasileira de dor torácica 2025 lida no texto integral, ao lado do manual do HC, cap. 12; lote 6 da revisão do HCFMUSP; aguarda aprovação do RT); 25/10/2026 (lacunas da Central, lote 3)',
  },
  descricao: 'Risco de evento cardíaco maior em 6 semanas',
  itens: [
    { tipo: 'escolha', id: 'historia', rotulo: 'História', opcoes: [
      { rotulo: 'Pouco suspeita', valor: 0 }, { rotulo: 'Moderadamente suspeita', valor: 1 }, { rotulo: 'Muito suspeita', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'ecg', rotulo: 'ECG', opcoes: [
      { rotulo: 'Normal', valor: 0 }, { rotulo: 'Alteração inespecífica de repolarização', valor: 1 }, { rotulo: 'Infradesnivelamento significativo de ST', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade', opcoes: [
      { rotulo: 'Abaixo de 45 anos', valor: 0 }, { rotulo: '45 a 64 anos', valor: 1 }, { rotulo: '65 anos ou mais', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'fatores', rotulo: 'Fatores de risco', ajuda: 'HAS, dislipidemia, diabetes, obesidade, tabagismo, história familiar', opcoes: [
      { rotulo: 'Nenhum', valor: 0 }, { rotulo: '1 ou 2 fatores', valor: 1 }, { rotulo: '3 ou mais, ou doença aterosclerótica conhecida', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'trop', rotulo: 'Troponina', opcoes: [
      { rotulo: 'Até o limite normal', valor: 0 }, { rotulo: '1 a 3× o limite', valor: 1 }, { rotulo: 'Acima de 3× o limite', valor: 2 },
    ] },
  ],
  calcular(r) {
    if (!completo(heart, r)) return null
    const total = somar(heart, r)
    const banda = total >= 7 ? 2 : total >= 4 ? 1 : 0
    return {
      rotulo: 'HEART',
      valor: String(total),
      unidade: 'de 10',
      nota: ['baixo risco', 'risco moderado', 'alto risco'][banda] + ' · evento em 6 semanas ' + MACE[banda],
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Faixa', ['0 a 3 pontos', '4 a 6 pontos', '7 a 10 pontos'][banda]],
        ['Evento cardíaco maior em 6 semanas', MACE[banda]],
      ],
      cuidados: [
        'A troponina do escore é a da chegada. Uma segunda medida dentro da janela do protocolo pode mudar a pontuação.',
        'HEART baixo não exclui dor torácica de causa não coronariana grave: dissecção, embolia pulmonar e pneumotórax não entram neste escore.',
        'Os percentuais são da coorte de validação holandesa e variam com a prevalência local de doença coronariana.',
        'A diretriz brasileira de dor torácica de 2025 indica o HEART como escore clínico preferencial (classe I, nível B; p. 29–30).',
      ],
    }
  },
}
