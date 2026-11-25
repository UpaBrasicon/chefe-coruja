// Nomes dos conceitos da evolução clínica para a tela (revisão do médico, RT
// 24/11/2026). O banco guarda o nome técnico ("pressao-arterial-sistolica");
// a tela mostra "Pressão arterial sistólica". Só apresentação: o nome técnico
// continua sendo a chave de tudo (gráfico, registro, flowsheet).

const ROTULOS: Record<string, string> = {
  'frequencia-cardiaca': 'Frequência cardíaca',
  'frequencia-respiratoria': 'Frequência respiratória',
  'pressao-arterial-sistolica': 'Pressão arterial sistólica',
  'pressao-arterial-diastolica': 'Pressão arterial diastólica',
  'pressao-arterial-media': 'Pressão arterial média',
  'saturacao-o2': 'Saturação de O₂',
  'temperatura': 'Temperatura',
  'glicemia-capilar': 'Glicemia capilar',
  'peso': 'Peso',
  'estatura': 'Estatura',
  'diurese': 'Diurese',
  'escala-dor': 'Escala de dor',
  'nivel-consciencia': 'Nível de consciência',
  'perimetro-cefalico': 'Perímetro cefálico',
  'circunferencia-abdominal': 'Circunferência abdominal',
  'hemoglobina': 'Hemoglobina',
  'hematocrito': 'Hematócrito',
  'leucocitos': 'Leucócitos',
  'neutrofilos': 'Neutrófilos',
  'linfocitos': 'Linfócitos',
  'plaquetas': 'Plaquetas',
  'creatinina': 'Creatinina',
  'ureia': 'Ureia',
  'sodio': 'Sódio',
  'potassio': 'Potássio',
  'cloro': 'Cloro',
  'magnesio': 'Magnésio',
  'calcio-total': 'Cálcio total',
  'ph': 'pH',
  'pco2': 'pCO₂',
  'po2': 'pO₂',
  'bicarbonato': 'Bicarbonato',
  'lactato': 'Lactato',
  'fio2': 'FiO₂',
  'troponina-i': 'Troponina I',
  'ck-mb': 'CK-MB',
  'inr': 'INR',
  'tp': 'TP',
  'ttpa': 'TTPa',
  'fibrinogenio': 'Fibrinogênio',
  'd-dimero': 'D-dímero',
  'pcr': 'PCR',
  'glasgow': 'Glasgow',
  'pupilas': 'Pupilas',
  'suporte-respiratorio': 'Suporte respiratório',
  'oxigenio-suplementar': 'Oxigênio suplementar',
  'esforco-respiratorio': 'Esforço respiratório',
  'enchimento-capilar': 'Enchimento capilar',
  'drogas-vasoativas': 'Drogas vasoativas',
  'escore-news': 'NEWS',
  'escore-news2': 'NEWS2',
  'escore-nihss': 'NIHSS',
  'escore-pesi': 'PESI',
  'escore-saps3': 'SAPS 3',
  'escore-timi': 'TIMI',
  'escore-hacor': 'HACOR',
  'escore-ri-ratio': 'RI ratio',
}

// Palavras com acento, para um conceito novo que ainda não esteja no mapa.
const PALAVRAS: Record<string, string> = {
  pressao: 'pressão', frequencia: 'frequência', cardiaca: 'cardíaca', respiratoria: 'respiratória', respiratorio: 'respiratório',
  saturacao: 'saturação', sistolica: 'sistólica', diastolica: 'diastólica', media: 'média', nivel: 'nível', consciencia: 'consciência',
  perimetro: 'perímetro', cefalico: 'cefálico', circunferencia: 'circunferência', hematocrito: 'hematócrito', leucocitos: 'leucócitos',
  neutrofilos: 'neutrófilos', linfocitos: 'linfócitos', sodio: 'sódio', potassio: 'potássio', magnesio: 'magnésio', calcio: 'cálcio',
  fibrinogenio: 'fibrinogênio', dimero: 'dímero', oxigenio: 'oxigênio', esforco: 'esforço', fosforo: 'fósforo', albumina: 'albumina',
  bilirrubina: 'bilirrubina', proteina: 'proteína', acido: 'ácido', urico: 'úrico', glicose: 'glicose', indice: 'índice',
}

/** "pressao-arterial-sistolica" → "Pressão arterial sistólica". */
export function rotuloConceito(nome: string): string {
  const fixo = ROTULOS[nome]
  if (fixo) return fixo
  const texto = nome.replace(/^escore-/, '').split('-').map((p) => PALAVRAS[p] ?? p).join(' ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Painéis prontos do gráfico (M1): os conceitos de cada um, na ordem da tela. */
export const PAINEIS_EVOLUCAO = [
  { id: 'vitais', rotulo: 'Sinais vitais', conceitos: ['frequencia-cardiaca', 'frequencia-respiratoria', 'pressao-arterial-sistolica', 'pressao-arterial-diastolica', 'saturacao-o2', 'temperatura', 'glicemia-capilar', 'diurese'] },
  { id: 'renal', rotulo: 'Função renal e eletrólitos', conceitos: ['creatinina', 'ureia', 'sodio', 'potassio', 'cloro', 'magnesio', 'calcio-total'] },
  { id: 'gaso', rotulo: 'Gasometria', conceitos: ['ph', 'pco2', 'po2', 'bicarbonato', 'lactato', 'fio2'] },
  { id: 'hemograma', rotulo: 'Hemograma', conceitos: ['hemoglobina', 'hematocrito', 'leucocitos', 'neutrofilos', 'linfocitos', 'plaquetas'] },
  { id: 'coagulacao', rotulo: 'Coagulação', conceitos: ['inr', 'tp', 'ttpa', 'fibrinogenio', 'd-dimero'] },
  { id: 'escores', rotulo: 'Escores', conceitos: ['escore-news2', 'glasgow', 'escala-dor', 'escore-nihss', 'escore-saps3'] },
] as const
