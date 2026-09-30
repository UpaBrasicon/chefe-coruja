import { completo, somar, type Escore } from '../escore.ts'

// Canadian Syncope Risk Score (Thiruganasambandamoorthy 2016). O manual do HC
// cita o escore (cap. 16, p. 238) mas não o transcreve; os itens e as cinco
// categorias vêm do artigo original. Percentuais de evento por categoria não
// entram (não conferidos no texto nesta versão).

export const sincopeCanadense: Escore = {
  ficha: {
    id: 'sincope-canadense',
    titulo: 'Canadian Syncope Risk Score — síncope no pronto-socorro (adulto)',
    versao: '2026-09-30.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Thiruganasambandamoorthy V, Kwong K, Wells GA, et al. Development of the Canadian Syncope Risk Score to predict serious adverse events after emergency department assessment of syncope. CMAJ. 2016;188(12):E289–E298.', url: 'https://doi.org/10.1503/cmaj.151469' },
    ],
    revisadoEm: '30/09/2026 (referência primária; aguarda aprovação do RT)',
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
      derivados: [['Categoria', `${cat} (muito baixo −3 a −2 · baixo −1 a 0 · médio 1 a 3 · alto 4 a 5 · muito alto 6 ou mais)`]],
      cuidados: [
        'Troponina e ECG no escore não tornam os exames obrigatórios (manual do HC, p. 238).',
        'O manual do HC usa a regra de San Francisco (Tabela 3, p. 238) e diz que o escore canadense foi validado com menos pacientes.',
        'Percentuais de evento por categoria não são mostrados nesta versão.',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}
