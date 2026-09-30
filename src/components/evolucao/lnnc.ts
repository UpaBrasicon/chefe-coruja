// Lista Nacional de Notificação Compulsória (LNNC), Portaria GM/MS nº 10.175,
// de 23/01/2026 — portada do protótipo (index.html, LNNC). A portaria NÃO traz
// CID: o mapeamento item → CID é do protótipo, pelos códigos usados no SINAN,
// e precisa de conferência da vigilância da unidade. Agravos sem CID próprio
// (ESP, óbito infantil/materno, PFA, síndrome gripal, relacionados ao trabalho
// sem código) ficam fora do aviso por CID.
export const LNNC_FONTE = 'Portaria GM/MS nº 10.175, de 23/01/2026'

type ItemLnnc = { n: string; nome: string; imediata: boolean; cids: string[]; quando?: string }

export const LNNC: ItemLnnc[] = [
  { n: "1a", nome: "Acidente de trabalho com exposição a material biológico", imediata: false, cids: ["Z20.9"] },
  { n: "1b", nome: "Acidente de trabalho", imediata: true, cids: ["Y96"] },
  { n: "2", nome: "Acidente por animal peçonhento", imediata: true, cids: ["T63","X20-X29"] },
  { n: "3", nome: "Acidente por animal potencialmente transmissor da raiva", imediata: true, cids: ["W64","W54"] },
  { n: "4", nome: "Anomalias congênitas", imediata: false, cids: ["Q00-Q99"] },
  { n: "5", nome: "Botulismo", imediata: true, cids: ["A05.1"] },
  { n: "7", nome: "Cólera", imediata: true, cids: ["A00"] },
  { n: "8", nome: "Coqueluche", imediata: true, cids: ["A37"] },
  { n: "9", nome: "Covid-19", imediata: true, cids: ["U07.1","U07.2"] },
  { n: "10", nome: "Dengue", imediata: false, cids: ["A90","A91","A97"], quando: "óbito" },
  { n: "12", nome: "Difteria", imediata: true, cids: ["A36"] },
  { n: "14a", nome: "Doença de Chagas Aguda", imediata: true, cids: ["B57.0","B57.1"] },
  { n: "14b", nome: "Doença de Chagas Crônica", imediata: false, cids: ["B57.2-B57.5"] },
  { n: "15", nome: "Doença de Creutzfeldt-Jakob (DCJ)", imediata: false, cids: ["A81.0"] },
  { n: "16", nome: "Doença Falciforme", imediata: false, cids: ["D57"] },
  { n: "17a", nome: "Doença Invasiva por \"Haemophilus Influenza\"", imediata: true, cids: ["G00.0","A41.3"] },
  { n: "17b", nome: "Doença Meningocócica e outras meningites", imediata: true, cids: ["A39","G00-G03"] },
  { n: "18", nome: "Doenças com suspeita de disseminação intencional: antraz pneumônico, tularemia, varíola", imediata: true, cids: ["A22","A21","B03"] },
  { n: "19", nome: "Doenças febris hemorrágicas emergentes/reemergentes: arenavírus, Ebola, Marburg, Lassa, febre purpúrica brasileira", imediata: true, cids: ["A96","A98.3","A98.4","A48.4"] },
  { n: "20", nome: "Doença aguda pelo vírus Zika", imediata: false, cids: ["A92.8","U06.9"], quando: "gestante (SES e SMS) ou óbito (MS, SES e SMS)" },
  { n: "20d", nome: "Síndrome congênita associada à infecção pelo vírus Zika", imediata: false, cids: ["P35.4"] },
  { n: "21", nome: "Esporotricose humana", imediata: false, cids: ["B42"] },
  { n: "22", nome: "Esquistossomose", imediata: false, cids: ["B65"] },
  { n: "24", nome: "Eventos adversos graves ou óbitos pós vacinação", imediata: true, cids: ["T88.0","T88.1"] },
  { n: "25", nome: "Febre Amarela", imediata: true, cids: ["A95"] },
  { n: "26", nome: "Febre de Chikungunya", imediata: false, cids: ["A92.0"], quando: "área sem transmissão ou óbito" },
  { n: "27", nome: "Febre do Nilo Ocidental e outras arboviroses de importância em saúde pública", imediata: true, cids: ["A92.3"] },
  { n: "28", nome: "Febre Maculosa e outras Riquetisioses", imediata: true, cids: ["A77","A79"] },
  { n: "29", nome: "Febre Tifoide", imediata: true, cids: ["A01.0"] },
  { n: "30", nome: "Hanseníase", imediata: false, cids: ["A30"] },
  { n: "31", nome: "Hantavirose", imediata: true, cids: ["A98.5","B33.4"] },
  { n: "32", nome: "Hepatites virais", imediata: false, cids: ["B15-B19"] },
  { n: "33", nome: "Infecção pelo vírus da hepatite B em gestante, parturiente ou puérpera e criança exposta", imediata: false, cids: ["O98.4"] },
  { n: "34", nome: "HIV/AIDS", imediata: false, cids: ["B20-B24"] },
  { n: "35", nome: "Infecção pelo HIV em gestante, parturiente ou puérpera e criança exposta", imediata: false, cids: ["O98.7","Z20.6"] },
  { n: "36", nome: "Infecção pelo Vírus da Imunodeficiência Humana (HIV)", imediata: false, cids: ["Z21"] },
  { n: "37", nome: "Infecção pelo Vírus Linfotrópico de Células T Humanas (HTLV)", imediata: false, cids: ["B33.3"] },
  { n: "39", nome: "Influenza humana produzida por novo subtipo viral", imediata: true, cids: ["J09"] },
  { n: "40", nome: "Intoxicação Exógena", imediata: false, cids: ["T36-T65"] },
  { n: "41", nome: "Leishmaniose Tegumentar Americana", imediata: false, cids: ["B55.1","B55.2"] },
  { n: "42", nome: "Leishmaniose Visceral", imediata: false, cids: ["B55.0"] },
  { n: "43", nome: "Leptospirose", imediata: true, cids: ["A27"] },
  { n: "45", nome: "Malária", imediata: false, cids: ["B50-B54"], quando: "região extra-Amazônica" },
  { n: "46", nome: "Monkeypox (varíola dos macacos)", imediata: true, cids: ["B04"] },
  { n: "48", nome: "Perda Auditiva relacionada ao trabalho", imediata: false, cids: ["H83.3"] },
  { n: "49", nome: "Pneumoconioses relacionadas ao trabalho", imediata: false, cids: ["J60-J65"] },
  { n: "50", nome: "Peste", imediata: true, cids: ["A20"] },
  { n: "51", nome: "Poliomielite por poliovírus selvagem", imediata: true, cids: ["A80"] },
  { n: "52", nome: "Raiva humana", imediata: true, cids: ["A82"] },
  { n: "53", nome: "Síndrome da Rubéola Congênita", imediata: true, cids: ["P35.0"] },
  { n: "54", nome: "Doenças Exantemáticas: sarampo, rubéola", imediata: true, cids: ["B05","B06"] },
  { n: "55", nome: "Sífilis: adquirida, congênita, em gestante", imediata: false, cids: ["A50-A53","O98.1"] },
  { n: "57", nome: "Síndrome Inflamatória Multissistêmica (SIM-A/SIM-P) associada à covid-19", imediata: true, cids: ["U10.9"] },
  { n: "59", nome: "Síndrome Respiratória Aguda Grave (SRAG) associada a Coronavírus", imediata: true, cids: ["U04.9"] },
  { n: "61", nome: "Tétano: acidental, neonatal", imediata: true, cids: ["A33","A34","A35"] },
  { n: "62", nome: "Toxoplasmose gestacional e congênita", imediata: false, cids: ["O98.6","P37.1"] },
  { n: "64", nome: "Tuberculose", imediata: false, cids: ["A15-A19"] },
  { n: "65", nome: "Varicela - caso grave internado ou óbito", imediata: true, cids: ["B01"] },
  { n: "66a", nome: "Violência doméstica e/ou outras violências", imediata: false, cids: ["Y09","T74.0","T74.1","T74.8","T74.9"] },
  { n: "66b", nome: "Violência sexual e tentativa de suicídio", imediata: true, cids: ["T74.2","X60-X84"] },
]

/** Código do CID em caixa alta, sem espaço ("j18.9 — pneumonia" → "J18.9"). */
export function codigoCid(texto: string): string {
  const m = /[A-Za-z]\d{2}(?:\.\d{1,2})?/.exec(texto)
  return m ? m[0].toUpperCase() : ''
}

// "A90" cobre A90 e A90.x; "X20-X29" e "B57.2-B57.5" são faixas (compara no
// mesmo comprimento das pontas).
function bate(cid: string, regra: string): boolean {
  const [ini, fim] = regra.split('-')
  if (!fim) return cid === ini || cid.startsWith(ini + '.') || (ini.includes('.') && cid.startsWith(ini))
  const corte = cid.slice(0, ini.length)
  return corte >= ini && corte <= fim
}

/** O item da LNNC que o CID dispara, ou null. */
export function itemNotificavel(texto: string): ItemLnnc | null {
  const cid = codigoCid(texto)
  if (!cid) return null
  return LNNC.find((x) => x.cids.some((r) => bate(cid, r))) ?? null
}
