// Tipos de alvo-seguro.mjs para os scripts em TypeScript.
export declare const FLAG_PRODUCAO: '--confirmo-producao'
export declare const REF_PRODUCAO: string
export declare const HOSTS_PRODUCAO: string[]
export declare function ehProducao(endereco: string | undefined | null): boolean
export declare function conferirAlvoSeguro(opcoes: {
  enderecos: (string | undefined | null)[]
  argv?: string[]
  nome?: string
}): { ok: boolean; producao: boolean; motivo?: string }
export declare function exigirAlvoSeguro(
  enderecos: (string | undefined | null)[],
  opcoes?: { nome?: string; argv?: string[] }
): { ok: true; producao: boolean }
