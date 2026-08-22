// Testes unitários da lógica pura do Sentinela (IQR, mínimo 8, detecção).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcularLimiteOutlier, detectarOutliers, type MetricasMedico } from './sentinela.ts'

test('calcularLimiteOutlier — mediana e Q3+1.5*IQR corretos', () => {
  // 1,2,3,4,5 → Q1=2, Q2=3, Q3=4, IQR=2, limite=4+3=7
  const { mediana, limite } = calcularLimiteOutlier([1, 2, 3, 4, 5])
  assert.equal(mediana, 3)
  assert.equal(limite, 7)
})

test('calcularLimiteOutlier — menos de 2 valores não gera limite', () => {
  const { limite } = calcularLimiteOutlier([3])
  assert.equal(Number.isFinite(limite), false)
})

test('detectarOutliers — médico com 6 plantões NÃO gera alerta (mínimo 8)', () => {
  const metricas: MetricasMedico[] = [
    { medicoId: 'a', plantoesAtribuidos: 6, repasses: 10, faltas: 0, cancelamentoTardio: 9, trocasIniciadas: 0, concentracaoDestino: 1 },
    { medicoId: 'b', plantoesAtribuidos: 20, repasses: 1, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.2 },
    { medicoId: 'c', plantoesAtribuidos: 25, repasses: 2, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.3 },
    { medicoId: 'd', plantoesAtribuidos: 30, repasses: 0, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.1 },
  ]
  const alertas = detectarOutliers(metricas, '30d')
  // 'a' tem repasses=10 (acima do limite) mas plantoes=6 < 8 → NÃO deve gerar
  assert.equal(alertas.filter((a) => a.medicoId === 'a').length, 0, 'médico com <8 plantões não gera alerta')
})

test('detectarOutliers — médico com >=8 plantões e valor outlier gera alerta', () => {
  const metricas: MetricasMedico[] = [
    { medicoId: 'a', plantoesAtribuidos: 20, repasses: 12, faltas: 0, cancelamentoTardio: 10, trocasIniciadas: 0, concentracaoDestino: 0.9 },
    { medicoId: 'b', plantoesAtribuidos: 20, repasses: 1, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.2 },
    { medicoId: 'c', plantoesAtribuidos: 25, repasses: 2, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.3 },
    { medicoId: 'd', plantoesAtribuidos: 30, repasses: 0, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.1 },
    { medicoId: 'e', plantoesAtribuidos: 22, repasses: 1, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.25 },
    { medicoId: 'f', plantoesAtribuidos: 18, repasses: 2, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.15 },
    { medicoId: 'g', plantoesAtribuidos: 28, repasses: 1, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.2 },
    { medicoId: 'h', plantoesAtribuidos: 24, repasses: 0, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.1 },
  ]
  const alertas = detectarOutliers(metricas, '30d')
  assert.ok(alertas.some((a) => a.medicoId === 'a' && a.metrica === 'taxa_repasse'), 'médico a deve gerar alerta de repasse')
  assert.ok(alertas.some((a) => a.medicoId === 'a' && a.metrica === 'cancelamento_tardio'), 'médico a deve gerar alerta de tardio')
})

test('detectarOutliers — sem outliers não gera alertas', () => {
  const metricas: MetricasMedico[] = [
    { medicoId: 'a', plantoesAtribuidos: 10, repasses: 1, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.3 },
    { medicoId: 'b', plantoesAtribuidos: 12, repasses: 2, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.4 },
    { medicoId: 'c', plantoesAtribuidos: 15, repasses: 1, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.2 },
    { medicoId: 'd', plantoesAtribuidos: 20, repasses: 2, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.3 },
    { medicoId: 'e', plantoesAtribuidos: 18, repasses: 1, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.25 },
    { medicoId: 'f', plantoesAtribuidos: 22, repasses: 2, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.35 },
    { medicoId: 'g', plantoesAtribuidos: 14, repasses: 1, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.2 },
    { medicoId: 'h', plantoesAtribuidos: 16, repasses: 1, faltas: 0, cancelamentoTardio: 0, trocasIniciadas: 0, concentracaoDestino: 0.28 },
  ]
  const alertas = detectarOutliers(metricas, '30d')
  assert.equal(alertas.length, 0, 'sem outlier não deve gerar alerta')
})
