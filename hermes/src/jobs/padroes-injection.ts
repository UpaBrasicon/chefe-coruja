// Padrões de tentativa de prompt injection (PT-BR e EN), comuns ao Gavião
// (sessões do Nous) e ao Cérbero (log do Hermes). Antes o Cérbero só tinha
// os padrões em inglês (auditoria 27/09).
export const PADROES_INJECTION = [
  // EN
  /ignore\s+(your|as\s+an?|all)\s+(previous|prior|above|system)?\s*(instructions|prompts?|rules)/i,
  /reveal\s+(your|the)\s*(system|internal)?\s*(prompt|instructions)/i,
  /forget\s+(all\s+)?(rules|instructions)/i,
  /act\s+as\s+(admin|super.?admin|gestor)/i,
  /acesse\s+(dados|outro)\s+(tenant|cliente|paciente)/i,
  // PT-BR
  /ignore\s+(suas|todas|as|qualquer|instru[çc][õo]es\s+)?\s*(instru[çc][õo]es|regras|prompts?|ordens)/i,
  /revel[ae]\s+(seu|o)\s*(system\s*prompt|prompt\s*(de\s*)?sistema|instru[çc][õo]es\s*internas)/i,
  /esque[çc]a\s+(todas\s+)?(as\s+)?(regras|instru[çc][õo]es)/i,
  /aja\s+como\s+(admin|super.?admin|gestor|sistema)/i,
  /acesse\s+(dados|informa[çc][õo]es)\s+(de\s+)?(outr[oa]|qualquer)\s+(tenant|cliente|unidade|paciente)/i,
]
