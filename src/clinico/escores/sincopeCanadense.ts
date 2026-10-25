import { completo, somar, type Escore } from '../escore.ts'

// Canadian Syncope Risk Score (Thiruganasambandamoorthy 2016). O manual do HC
// cita o escore (cap. 16, p. 238) mas não o transcreve; os itens e as cinco
// categorias vêm do artigo original. Lote 3 das lacunas (25/10/2026): entram as
// validações canadense (2020), internacional (2022) e americana (2026), pelos
// resumos; o percentual de evento só nas categorias que o resumo de 2020 traz.

/** Evento grave em 30 dias por categoria, só as que o resumo de 2020 traz. */
const EVENTO_2020: Record<string, string> = { 'muito baixo': '0,3%', 'muito alto': '51,3%' }

export const sincopeCanadense: Escore = {
  ficha: {
    id: 'sincope-canadense',
    titulo: 'Canadian Syncope Risk Score — síncope no pronto-socorro (adulto)',
    versao: '2026-10-25.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Thiruganasambandamoorthy V, Kwong K, Wells GA, et al. Development of the Canadian Syncope Risk Score to predict serious adverse events after emergency department assessment of syncope. CMAJ. 2016;188(12):E289–E298.', url: 'https://doi.org/10.1503/cmaj.151469' },
      { citacao: 'Thiruganasambandamoorthy V, Sivilotti MLA, Le Sage N, et al. Multicenter Emergency Department Validation of the Canadian Syncope Risk Score. JAMA Intern Med. 2020;180(5):737–744. Resumo: AUC 0,91; no corte de −1, sensibilidade 97,8% e especificidade 44,3%; evento grave em 30 dias de 0,3% no risco muito baixo e 51,3% no muito alto.', url: 'https://doi.org/10.1001/jamainternmed.2020.0288' },
      { citacao: 'Zimmermann T, du Fay de Lavallaz J, Nestelberger T, et al. International Validation of the Canadian Syncope Risk Score: A Cohort Study. Ann Intern Med. 2022;175(6):783–794. Resumo: 40 anos ou mais, 8 países; AUC 0,85 para o desfecho primário; a classificação da síncope pelo médico sozinha teve AUC 0,83.', url: 'https://doi.org/10.7326/M21-2313' },
      { citacao: 'Suh EH, Winskill C, Sacco DL, et al. Validation of 2 Syncope Risk Scores and Comparison With Physician Risk Estimation. JAMA Netw Open. 2026;9(5):e2617362. Resumo: 40 anos ou mais, Estados Unidos; AUROC 0,72; escore abaixo de 0 com sensibilidade 91,9% e valor preditivo negativo 97,5%.', url: 'https://doi.org/10.1001/jamanetworkopen.2026.17362' },
    ],
    revisadoEm: '25/10/2026 (lacunas da Central, lote 3: validações de 2020, 2022 e 2026; aguarda aprovação do RT)',
  },
  descricao: 'Nove itens (avaliação clínica, exames e diagnóstico no pronto-socorro), de −3 a 11 pontos, em cinco categorias de risco de evento grave em 30 dias.',
  itens: [
    { tipo: 'marca', id: 'vasovagal', rotulo: 'Predisposição a sintomas vasovagais (ambiente quente, ficar muito tempo em pé, medo, dor, emoção)', pontos: -1, grupo: 'Avaliação clínica' },
    { tipo: 'marca', id: 'cardiopatia', rotulo: 'História de doença cardíaca (coronariana, FA ou flutter, IC, valvopatia)', pontos: 1, grupo: 'Avaliação clínica' },
    { tipo: 'marca', id: 'pas', rotulo: 'Qualquer PAS < 90 ou > 180 mmHg no pronto-socorro', pontos: 2, grupo: 'Avaliação clínica' },
    { tipo: 'marca', id: 'troponina', rotulo: 'Troponina elevada (acima do percentil 99)', pontos: 2, grupo: 'Exames' },
    { tipo: 'marca', id: 'eixo', rotulo: 'Eixo do QRS anormal (< −30° ou > 100°)', pontos: 1, grupo: 'Exames' },
    { tipo: 'marca', id: 'qrs', rotulo: 'QRS > 130 ms', pontos: 1, grupo: 'Exames' },
    { tipo: 'marca', id: 'qtc', rotulo: 'QTc > 480 ms', pontos: 2, grupo: 'Exames' },
    { tipo: 'escolha', id: 'diagnostico', rotulo: 'Diagnóstico no pronto-socorro', opcoes: [
      { rotulo: 'Síncope vasovagal — −2 pontos', valor: -2 }, { rotulo: 'Nem vasovagal nem cardíaca', valor: 0 }, { rotulo: 'Síncope cardíaca — 2 pontos', valor: 2 },
    ] },
  ],
  calcular(r) {
    if (!completo(sincopeCanadense, r)) return null
    const total = somar(sincopeCanadense, r)
    const [cat, estado] = total <= -2 ? ['muito baixo', 0] : total <= 0 ? ['baixo', 0] : total <= 3 ? ['médio', 1] : total <= 5 ? ['alto', 2] : ['muito alto', 2]
    return {
      rotulo: 'Canadian Syncope Risk Score',
      valor: String(total),
      unidade: 'de −3 a 11',
      nota: `risco ${cat} de evento grave em 30 dias`,
      estado: estado as 0 | 1 | 2,
      derivados: [
        ['Categoria', `${cat} (muito baixo −3 a −2 · baixo −1 a 0 · médio 1 a 3 · alto 4 a 5 · muito alto 6 ou mais)`],
        ...(EVENTO_2020[cat] ? [['Evento grave em 30 dias na validação de 2020', EVENTO_2020[cat]] as [string, string]] : []),
      ],
      cuidados: [
        'Troponina e ECG no escore não tornam os exames obrigatórios (manual do HC, p. 238).',
        'O manual do HC usa a regra de San Francisco (Tabela 3, p. 238) e diz que o escore canadense foi validado com menos pacientes.',
        'Validação canadense (2020): AUC 0,91; no corte de −1, sensibilidade 97,8% e especificidade 44,3%. Os percentuais das categorias baixo, médio e alto não estão no resumo e não são mostrados.',
        'Validação internacional (2022, 40 anos ou mais): AUC 0,85; só a classificação da síncope pelo médico (o item de diagnóstico no pronto-socorro) teve AUC 0,83, e os autores consideram a utilidade clínica incerta.',
        'Validação nos Estados Unidos (2026, 40 anos ou mais): AUROC 0,72; escore abaixo de 0 com sensibilidade 91,9% e valor preditivo negativo 97,5%.',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}
