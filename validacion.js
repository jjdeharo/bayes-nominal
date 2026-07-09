#!/usr/bin/env node
/*
 * Validación del perfil multifactorial (Monte Carlo).
 *
 * Herramienta del autor del recurso, no del alumnado: comprueba con qué
 * fiabilidad el banco de preguntas distingue perfiles con varios errores a la vez.
 * Genera respondentes sintéticos definidos por un subconjunto de factores presentes,
 * les pasa el mismo test adaptativo con la misma selección y el mismo criterio de
 * parada, y construye una matriz de confusión (perfil real × perfil diagnosticado).
 *
 * Mide la fiabilidad BAJO EL MODELO (si el diseño discrimina los perfiles),
 * no la validez empírica de los parámetros.
 *
 * Uso:  node validacion.js [simulaciones_por_perfil] [semilla]
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

function etiquetaPerfil(ids) {
  return ids.length ? ids.join('+') : 'sin-fallos';
}

function perfilDesdePosterior(p) {
  return M.perfilMAP(p).ids;
}

function generarPerfiles() {
  const perfiles = [];
  const ids = M.FACTORES.map(function (f) { return f.id; });
  const total = 1 << ids.length;
  for (let mascara = 0; mascara < total; mascara++) {
    const perfil = [];
    for (let i = 0; i < ids.length; i++) {
      if (mascara & (1 << i)) perfil.push(ids[i]);
    }
    perfiles.push(perfil);
  }
  return perfiles;
}

// Una sesión completa del test para un respondente sintético con el perfil real.
function simularSesion(perfilReal, rng) {
  let p = M.priorPerfiles();
  let restantes = M.BANCO.slice();
  const usoCategorias = {};
  const historial = [];
  let respondidas = 0;
  let cierre = null;

  for (;;) {
    const q = M.seleccionarSiguiente(p, restantes, usoCategorias, rng);
    const indiceRespuesta = M.muestrearRespuestaPerfil(q, perfilReal, rng);
    historial.push({ q: q, opcion: indiceRespuesta });
    p = M.actualizar(p, q, indiceRespuesta);
    restantes = restantes.filter(function (x) { return x.id !== q.id; });
    usoCategorias[q.categoria] = (usoCategorias[q.categoria] || 0) + 1;
    respondidas += 1;

    cierre = M.evaluarParada(
      p, respondidas, restantes, usoCategorias,
      M.evidenciaFactores(historial.map(function (h) { return h.q; }))
    );
    if (cierre.parar) break;
  }

  return {
    diagnostico: perfilDesdePosterior(p),
    firme: cierre.firme,
    preguntas: respondidas,
    confianza: M.confianzaVeredicto(p),
    avisoLz: !M.personFit(p, historial).fiable
  };
}

/* ---------------- Ejecución ---------------- */

const rng = crearRng(SEMILLA);
const perfiles = generarPerfiles();
const n = perfiles.length;
const confusion = Array.from({ length: n }, function () { return new Array(n).fill(0); });
const estadisticas = perfiles.map(function () {
  return { firmes: 0, preguntas: 0, confianza: 0, avisosLz: 0 };
});

for (let h = 0; h < n; h++) {
  for (let s = 0; s < N_SIMULACIONES; s++) {
    const r = simularSesion(perfiles[h], rng);
    const d = perfiles.findIndex(function (perfil) {
      return etiquetaPerfil(perfil) === etiquetaPerfil(r.diagnostico);
    });
    confusion[h][d] += 1;
    if (r.firme) estadisticas[h].firmes += 1;
    estadisticas[h].preguntas += r.preguntas;
    estadisticas[h].confianza += r.confianza;
    if (r.avisoLz) estadisticas[h].avisosLz += 1;
  }
}

/* ---------------- Informe ---------------- */

function pct(x) { return (100 * x).toFixed(1).padStart(6) + ' %'; }
function ancho(texto, w) { return String(texto).padEnd(w); }

console.log('Validación del perfil multifactorial (Monte Carlo)');
console.log('===============================================');
console.log('Simulaciones por perfil: ' + N_SIMULACIONES + ' · semilla: ' + SEMILLA);
console.log('Banco: ' + M.BANCO.length + ' preguntas · parada: N_MIN=' + M.PARAMETROS.N_MIN +
  ', N_MAX=' + M.PARAMETROS.N_MAX + ', p_min=' + M.PARAMETROS.P_MIN +
  ', H_stop=' + M.H_STOP.toFixed(3) + ' bits');
console.log('');
console.log('Matriz de confusión (filas: perfil real; columnas: perfil diagnosticado)');
console.log('');

const etiquetas = perfiles.map(etiquetaPerfil);
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
console.log('Por perfil:');
for (let h = 0; h < n; h++) {
  const e = estadisticas[h];
  console.log('  ' + ancho(etiquetas[h], wFila) +
    'cierres firmes: ' + pct(e.firmes / N_SIMULACIONES).trim() +
    ' · preguntas (media): ' + (e.preguntas / N_SIMULACIONES).toFixed(1) +
    ' · confianza media: ' + (e.confianza / N_SIMULACIONES).toFixed(2) +
    ' · avisos l_z: ' + pct(e.avisosLz / N_SIMULACIONES).trim());
}
console.log('');
console.log('«Avisos l_z»: sesiones con aviso de person-fit (l_z < -2). Con');
console.log('respondentes coherentes con el modelo debe ser bajo (falsas alarmas).');
console.log('');
console.log('Nota: esta matriz mide la fiabilidad bajo el modelo (los respondentes');
console.log('sintéticos salen del propio modelo). Indica si el diseño del banco');
console.log('discrimina los perfiles, no si los parámetros reflejan la realidad.');
