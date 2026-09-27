import { completo, escolha, somar, type Escore } from '../escore.ts'

// Wells para TVP: nove critérios de 1 ponto e um de −2. Porte do protótipo
// (hematologia/Wells para TVP, construído em 02/09/2026). Saíram (ADR 0007) o
// "próximo exame", o bloco "o caminho depois do escore" e a menção a
// anticoagulação empírica: fica a probabilidade e a prevalência na banda.

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]

export const wellsTvp: Escore = {
  ficha: {
    id: 'wells-tvp',
    titulo: 'Wells para TVP — probabilidade de trombose venosa profunda',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Wells PS, Anderson DR, Rodger M, et al. Evaluation of D-dimer in the diagnosis of suspected deep-vein thrombosis. N Engl J Med. 2003;349(13):1227–1235.', url: 'https://doi.org/10.1056/NEJMoa023153' },
      { citacao: 'Wells PS, Anderson DR, Bormanis J, et al. Value of assessment of pretest probability of deep-vein thrombosis in clinical management. Lancet. 1997;350(9094):1795–1798.', url: 'https://doi.org/10.1016/S0140-6736(97)08140-3' },
      { citacao: 'Lim W, Le Gal G, Bates SM, et al. American Society of Hematology 2018 guidelines for management of venous thromboembolism: diagnosis of venous thromboembolism. Blood Adv. 2018;2(22):3226–3256.', url: 'https://doi.org/10.1182/bloodadvances.2018024828' },
      { citacao: 'UpToDate. Clinical presentation and diagnosis of the nonpregnant adult with suspected deep vein thrombosis of the lower extremity. (referência de escopo autorizada pelo usuário em 02/09/2026)', url: 'https://www.uptodate.com' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Probabilidade clínica de TVP: nove itens e um subtrator',
  itens: [
    { tipo: 'escolha', id: 'cancer', rotulo: 'Câncer ativo — em tratamento, tratado nos últimos 6 meses ou em paliativo', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'paralisia', rotulo: 'Paralisia, paresia ou imobilização recente do membro inferior', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'acamado', rotulo: 'Acamado por mais de 3 dias, ou cirurgia maior nas últimas 12 semanas', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'dor', rotulo: 'Dor localizada no trajeto do sistema venoso profundo', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'edemaTodo', rotulo: 'Edema de todo o membro inferior', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'perimetria', rotulo: 'Perimetria da panturrilha mais de 3 cm maior que a do outro lado', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'cacifo', rotulo: 'Edema com cacifo restrito à perna sintomática', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'colaterais', rotulo: 'Veias superficiais colaterais não varicosas', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'previa', rotulo: 'TVP prévia documentada', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'alternativo', rotulo: 'Diagnóstico alternativo ao menos tão provável quanto TVP', opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: -2 }] },
  ],
  calcular(r) {
    if (!completo(wellsTvp, r)) return null
    const total = somar(wellsTvp, r)
    const provavel = total >= 2
    const tres = total >= 3 ? 'alta · 3 pontos ou mais' : total >= 1 ? 'moderada · 1 a 2 pontos' : 'baixa · 0 ponto ou menos'
    const previa = escolha(wellsTvp, r, 'previa')?.valor === 1
    return {
      rotulo: 'Wells para TVP',
      valor: String(total),
      unidade: Math.abs(total) === 1 ? 'ponto' : 'pontos',
      nota: provavel ? 'TVP provável' : 'TVP improvável',
      estado: provavel ? 2 : 0,
      derivados: [
        ['Divisão em duas bandas', provavel ? '2 pontos ou mais — provável' : '1 ponto ou menos — improvável'],
        ['Divisão em três bandas', tres],
        ['Prevalência de TVP na banda', provavel ? 'em torno de 28% na casuística original' : 'em torno de 5%'],
      ],
      alerta: provavel
        ? 'TVP provável: nesta banda, D-dímero negativo NÃO afasta TVP.'
        : previa
          ? 'Escore improvável em paciente com TVP prévia. Se a suspeita é de recorrência NO MESMO membro, o Wells não foi construído para isso e tem desempenho ruim ali.'
          : undefined,
      cuidados: [
        'Este é o Wells para TVP. O Wells para TEP é outro escore, com outros itens e outros cortes. Não são intercambiáveis.',
        'O item de diagnóstico alternativo subtrai 2 pontos e é o único negativo. Ele é o que transforma celulite, ruptura de fibras e insuficiência venosa em probabilidade improvável.',
        'A perimetria é medida 10 cm abaixo da tuberosidade tibial, nos dois membros, no mesmo ponto.',
        'Escore improvável com D-dímero negativo afasta TVP com segurança comparável à do ultrassom seriado.',
        'Desempenho menor ou não validado: suspeita de recorrência no mesmo membro, gestação e puerpério, paciente internado, TVP de membro superior.',
      ],
    }
  },
}
