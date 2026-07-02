#!/usr/bin/env node
/*
 * Validación de separabilidad del diseño (Monte Carlo).
 *
 * Herramienta del autor del recurso, no del alumnado: comprueba con qué
 * fiabilidad el banco de preguntas distingue las cuatro hipótesis nominales.
 * Genera respondentes sintéticos que se comportan según cada hipótesis
 * (aciertan cada pregunta con la probabilidad P(acierto | H_i, q) del banco),
 * les pasa el mismo test adaptativo con la misma selección y el mismo
 * criterio de parada, y construye la matriz de confusión
 * (hipótesis real × hipótesis diagnosticada).
 *
 * Mide la fiabilidad BAJO EL MODELO (si el diseño discrimina las hipótesis),
 * no la validez empírica de los parámetros.
 *
 * Uso:  node validacion.js [simulaciones_por_hipotesis] [semilla]
 *       node validacion.js 1000 42
 *
 * Licencia: AGPL-3.0
 */

'use strict';

const M = require('./modelo.js');

const N_SIMULACIONES = parseInt(process.argv[2], 10) || 1000;
const SEMILLA = parseInt(process.argv[3], 10) || 20260702;

// Generador pseudoaleatorio sembrado (mulberry32) para resultados reproducibles.
function crearRng(semilla) {
  let a = semilla >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Una sesión completa del test para un respondente sintético con la hipótesis hReal.
function simularSesion(hReal, rng) {
  let p = M.priorUniforme();
  let restantes = M.BANCO.slice();
  const usoCategorias = {};
  let respondidas = 0;
  let cierre = null;

  for (;;) {
    const q = M.seleccionarSiguiente(p, restantes, usoCategorias, rng);
    const acierto = rng() < q.L[hReal];
    p = M.actualizar(p, q, acierto);
    restantes = restantes.filter(function (x) { return x.id !== q.id; });
    usoCategorias[q.categoria] = (usoCategorias[q.categoria] || 0) + 1;
    respondidas += 1;

    cierre = M.evaluarParada(p, respondidas, restantes);
    if (cierre.parar) break;
  }

  return {
    diagnostico: M.indiceMAP(p),
    firme: cierre.firme,
    preguntas: respondidas,
    confianza: Math.max.apply(null, p)
  };
}

/* ---------------- Ejecución ---------------- */

const rng = crearRng(SEMILLA);
const n = M.HIPOTESIS.length;
const confusion = Array.from({ length: n }, function () { return new Array(n).fill(0); });
const estadisticas = M.HIPOTESIS.map(function () {
  return { firmes: 0, preguntas: 0, confianza: 0 };
});

for (let h = 0; h < n; h++) {
  for (let s = 0; s < N_SIMULACIONES; s++) {
    const r = simularSesion(h, rng);
    confusion[h][r.diagnostico] += 1;
    if (r.firme) estadisticas[h].firmes += 1;
    estadisticas[h].preguntas += r.preguntas;
    estadisticas[h].confianza += r.confianza;
  }
}

/* ---------------- Informe ---------------- */

function pct(x) { return (100 * x).toFixed(1).padStart(6) + ' %'; }
function ancho(texto, w) { return String(texto).padEnd(w); }

console.log('Validación de separabilidad del diseño (Monte Carlo)');
console.log('====================================================');
console.log('Simulaciones por hipótesis: ' + N_SIMULACIONES + ' · semilla: ' + SEMILLA);
console.log('Banco: ' + M.BANCO.length + ' preguntas · parada: N_MIN=' + M.PARAMETROS.N_MIN +
  ', N_MAX=' + M.PARAMETROS.N_MAX + ', p_min=' + M.PARAMETROS.P_MIN +
  ', H_stop=' + M.H_STOP.toFixed(3) + ' bits');
console.log('');
console.log('Matriz de confusión (filas: hipótesis real; columnas: diagnóstico MAP)');
console.log('');

const etiquetas = M.HIPOTESIS.map(function (h) { return h.corta; });
const wFila = Math.max.apply(null, etiquetas.map(function (e) { return e.length; })) + 2;

let cabecera = ancho('', wFila);
etiquetas.forEach(function (e) { cabecera += e.slice(0, 12).padStart(14); });
console.log(cabecera);

let aciertosTotales = 0;
for (let h = 0; h < n; h++) {
  let fila = ancho(etiquetas[h], wFila);
  for (let d = 0; d < n; d++) {
    fila += pct(confusion[h][d] / N_SIMULACIONES).padStart(14);
  }
  console.log(fila);
  aciertosTotales += confusion[h][h];
}

console.log('');
console.log('Exactitud global del diagnóstico: ' + pct(aciertosTotales / (n * N_SIMULACIONES)).trim());
console.log('');
console.log('Por hipótesis:');
for (let h = 0; h < n; h++) {
  const e = estadisticas[h];
  console.log('  ' + ancho(etiquetas[h], wFila) +
    'cierres firmes: ' + pct(e.firmes / N_SIMULACIONES).trim() +
    ' · preguntas (media): ' + (e.preguntas / N_SIMULACIONES).toFixed(1) +
    ' · confianza media: ' + (e.confianza / N_SIMULACIONES).toFixed(2));
}
console.log('');
console.log('Nota: esta matriz mide la fiabilidad bajo el modelo (los respondentes');
console.log('sintéticos salen del propio modelo). Indica si el diseño del banco');
console.log('discrimina las hipótesis, no si los parámetros reflejan la realidad.');
