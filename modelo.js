/*
 * Modelo bayesiano con hipótesis nominales (no jerárquicas).
 *
 * Ejemplo de la metodología de recursos adaptativos bayesianos:
 * https://jjdeharo.github.io/recursos-adaptativos/
 *
 * Las hipótesis no representan niveles ordenados de dominio, sino errores
 * conceptuales alternativos al comparar números decimales. Por eso no se usa
 * IRT logística: cada pregunta lleva un vector de verosimilitudes
 * P(acierto | H_i, q), una por hipótesis, asignado por tramos según si la
 * pregunta ataca o no el concepto que cada error distorsiona.
 *
 * Este archivo lo comparten el recurso del alumno (index.html) y la
 * herramienta de validación del autor (validacion.js, Node).
 *
 * Licencia: AGPL-3.0
 */

(function (raiz, definicion) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = definicion();
  } else {
    raiz.ModeloNominal = definicion();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Hipótesis nominales: sin orden, sin theta.                          */
  /* El diagnóstico final es la hipótesis MAP y su probabilidad.         */
  /* ------------------------------------------------------------------ */

  const HIPOTESIS = [
    {
      id: 'dom',
      nombre: 'Dominio del orden decimal',
      corta: 'Compara bien',
      tipo: 'dominio',
      titular: 'Comparas los decimales correctamente',
      descripcion:
        'Ordenas los decimales por su valor posicional: sabes que 0,7 > 0,25 ' +
        'y que 0,80 = 0,8.',
      recomendacion:
        'El orden decimal está consolidado. Conviene avanzar hacia la densidad ' +
        'de los decimales (entre dos decimales siempre hay infinitos), la ' +
        'estimación en la recta numérica y las operaciones con decimales en ' +
        'contextos de medida.',
      siguientePaso:
        'Proponer problemas de intercalación («escribe tres números entre 0,4 y 0,41») ' +
        'y de redondeo con significado.'
    },
    {
      id: 'largo',
      nombre: 'Regla del número entero («más cifras, mayor»)',
      corta: 'Error: más cifras = mayor',
      tipo: 'error',
      titular: 'Comparas la parte decimal como si fuera un número entero',
      descripcion:
        'Cuando comparas dos decimales, miras las cifras de después de la coma ' +
        'como si fueran un número entero: 0,25 te parece mayor que 0,7 porque ' +
        '25 > 7. Es un error muy frecuente al pasar de los números naturales a ' +
        'los decimales.',
      recomendacion:
        'Trabajar el valor posicional con tabla de décimas y centésimas, y con ' +
        'materiales de medida (dinero, metro). Ayuda igualar la longitud ' +
        'añadiendo ceros (0,7 → 0,70) y comparar cifra a cifra empezando por ' +
        'las décimas.',
      siguientePaso:
        'Actividades de comparación con la tabla de valor posicional delante, ' +
        'verbalizando «7 décimas contra 2 décimas» antes de decidir.'
    },
    {
      id: 'corto',
      nombre: 'Regla de la fracción («menos cifras, mayor»)',
      corta: 'Error: menos cifras = mayor',
      tipo: 'error',
      titular: 'Crees que tener más cifras decimales hace más pequeño al número',
      descripcion:
        'Piensas que cuantas más cifras decimales tiene un número, más pequeño ' +
        'es (como las centésimas son más pequeñas que las décimas): dirías que ' +
        '0,3 > 0,45. Es un error frecuente después de estudiar las fracciones.',
      recomendacion:
        'Usar la cuadrícula de 100 (10×10) para ver que 0,45 son 45 centésimas ' +
        'y 0,3 son 30 centésimas, y la recta numérica con zoom entre décimas. ' +
        'Escribir ambos números con el mismo número de cifras antes de comparar.',
      siguientePaso:
        'Comparaciones sobre la cuadrícula de 100 coloreando ambos números, ' +
        'hasta que la regla «más cifras = más pequeño» deje de aplicarse.'
    },
    {
      id: 'cero',
      nombre: 'Cero invisible (ignora los ceros tras la coma)',
      corta: 'Error: ignora los ceros',
      tipo: 'error',
      titular: 'No tienes en cuenta los ceros que van justo después de la coma',
      descripcion:
        'Al comparar, el cero de después de la coma «no cuenta» para ti: lees ' +
        '0,07 como si fuera 0,7, y por eso te parece mucho mayor de lo que es.',
      recomendacion:
        'Insistir en la lectura verbal correcta («siete centésimas», no «cero ' +
        'siete»), hacer dictados de decimales y situar números con cero ' +
        'intermedio en la recta numérica y en la tabla de valor posicional.',
      siguientePaso:
        'Dictados cruzados (de palabra a cifra y de cifra a palabra) con parejas ' +
        'del tipo 0,5 / 0,05 / 0,005 hasta automatizar el papel del cero.'
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Banco de preguntas.                                                 */
  /*                                                                     */
  /* L = [P(acierto | dominio), P(acierto | largo),                      */
  /*      P(acierto | corto),   P(acierto | cero)]                       */
  /*                                                                     */
  /* Tramos usados (según la especificación operativa):                  */
  /*   ≈0,9      el error no interfiere en esta pregunta                 */
  /*   ≈0,4–0,6  afectación parcial                                      */
  /*   ≈0,15–0,25 un distractor captura activamente ese error            */
  /* Suelo de azar: 1/4 = 0,25 (cuatro opciones), salvo distractor       */
  /* que atrae activamente, que puede quedar por debajo.                 */
  /* ------------------------------------------------------------------ */

  const BANCO = [
    {
      id: 'c1',
      categoria: 'Comparación',
      texto: '¿Cuál de estos dos números es mayor: 0,5 o 0,25?',
      opciones: [
        { t: '0,5', fb: null },
        { t: '0,25', fb: 'Has comparado 25 con 5 como si fueran enteros, pero 0,25 son 25 centésimas y 0,5 son 50 centésimas.' },
        { t: 'Son iguales', fb: null },
        { t: 'No se puede saber', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.2, 0.9, 0.9],
      explicacion:
        '0,5 = 0,50, es decir, 50 centésimas; 0,25 son 25 centésimas. Por tanto 0,5 > 0,25.'
    },
    {
      id: 'c2',
      categoria: 'Comparación',
      texto: '¿Cuál es mayor: 0,3 o 0,45?',
      opciones: [
        { t: '0,45', fb: null },
        { t: '0,3', fb: 'Tener más cifras decimales no hace el número más pequeño: 0,45 son 45 centésimas y 0,3 son 30 centésimas.' },
        { t: 'Son iguales', fb: null },
        { t: 'No se puede saber', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.9, 0.2, 0.9],
      explicacion:
        '0,3 = 0,30. Comparando centésimas: 45 > 30, así que 0,45 > 0,3.'
    },
    {
      id: 'c3',
      categoria: 'Comparación',
      texto: '¿Cuál es mayor: 0,7 o 0,07?',
      opciones: [
        { t: '0,7', fb: null },
        { t: '0,07', fb: 'Aunque 0,07 tenga más cifras, el cero después de la coma lo hace diez veces más pequeño que 0,7.' },
        { t: 'Son iguales', fb: 'No son iguales: el cero después de la coma sí cuenta. 0,7 son 7 décimas y 0,07 son 7 centésimas.' },
        { t: 'Depende de cómo se lean', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.2, 0.9, 0.15],
      explicacion:
        '0,7 son 7 décimas (70 centésimas) y 0,07 son solo 7 centésimas: 0,7 es diez veces mayor.'
    },
    {
      id: 'e1',
      categoria: 'Equivalencia',
      texto: '¿Qué relación hay entre 0,80 y 0,8?',
      opciones: [
        { t: 'Son el mismo número', fb: null },
        { t: '0,80 es mayor', fb: '80 parece mayor que 8, pero 0,80 son 80 centésimas y 0,8 son 8 décimas: la misma cantidad.' },
        { t: '0,8 es mayor', fb: 'Quitar el cero final no hace mayor al número: 0,8 y 0,80 representan la misma cantidad.' },
        { t: 'No se pueden comparar', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.2, 0.2, 0.8],
      explicacion:
        'Un cero al final de la parte decimal no cambia el valor: 0,80 = 0,8 (80 centésimas = 8 décimas).'
    },
    {
      id: 'o1',
      categoria: 'Ordenación',
      texto: '¿Cuál es el menor de estos tres números: 0,6 · 0,06 · 0,66?',
      opciones: [
        { t: '0,06', fb: null },
        { t: '0,6', fb: null },
        { t: '0,66', fb: 'Más cifras no significa más pequeño: 0,66 son 66 centésimas, más que las 6 centésimas de 0,06.' },
        { t: '0,6 y 0,06 son igual de pequeños', fb: 'No son iguales: en 0,06 el cero después de la coma hace que valga solo 6 centésimas, mientras que 0,6 son 60 centésimas.' }
      ],
      correcta: 0,
      L: [0.9, 0.2, 0.6, 0.15],
      explicacion:
        'En centésimas: 0,06 son 6; 0,6 son 60; 0,66 son 66. El menor es 0,06.'
    },
    {
      id: 'r1',
      categoria: 'Recta y densidad',
      texto: '¿Qué número está entre 0,4 y 0,5?',
      opciones: [
        { t: '0,45', fb: null },
        { t: 'No hay ningún número entre ellos', fb: 'Entre 4 y 5 no hay enteros, pero entre 0,4 y 0,5 hay infinitos decimales: 0,41; 0,42; 0,45…' },
        { t: '0,54', fb: null },
        { t: '0,35', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.2, 0.3, 0.9],
      explicacion:
        '0,4 = 0,40 y 0,5 = 0,50; entre 40 y 50 centésimas está, por ejemplo, 0,45. De hecho hay infinitos números entre ellos.'
    },
    {
      id: 'c4',
      categoria: 'Comparación',
      texto: '¿Cuál es mayor: 0,09 o 0,1?',
      opciones: [
        { t: '0,1', fb: null },
        { t: '0,09', fb: '9 es mayor que 1, pero aquí comparamos 9 centésimas con 10 centésimas: gana 0,1.' },
        { t: 'Son iguales', fb: null },
        { t: 'No se puede saber', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.15, 0.9, 0.15],
      explicacion:
        '0,1 = 0,10, es decir, 10 centésimas; 0,09 son 9 centésimas. Por eso 0,1 > 0,09.'
    },
    {
      id: 'c5',
      categoria: 'Comparación',
      texto: '¿Cuál es mayor: 0,375 o 0,4?',
      opciones: [
        { t: '0,4', fb: null },
        { t: '0,375', fb: '375 parece grande, pero son milésimas: 0,375 son 375 milésimas y 0,4 son 400 milésimas.' },
        { t: 'Son iguales', fb: null },
        { t: 'No se puede saber', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.15, 0.9, 0.9],
      explicacion:
        '0,4 = 0,400. En milésimas: 400 > 375, así que 0,4 > 0,375 aunque tenga menos cifras.'
    },
    {
      id: 'r2',
      categoria: 'Recta y densidad',
      texto: 'En una recta numérica que va de 0 a 1, ¿dónde se sitúa 0,05?',
      opciones: [
        { t: 'Muy cerca del 0', fb: null },
        { t: 'Justo en la mitad, como 0,5', fb: '0,05 no es 0,5: el cero después de la coma lo hace diez veces más pequeño, así que queda muy cerca del 0.' },
        { t: 'Muy cerca del 1', fb: null },
        { t: 'Fuera de esa recta', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.4, 0.8, 0.15],
      explicacion:
        '0,05 son 5 centésimas: está a la mitad de camino entre 0 y 0,1, es decir, muy cerca del 0.'
    },
    {
      id: 'e2',
      categoria: 'Equivalencia',
      texto: '¿Cuál de estos números es igual a 0,3?',
      opciones: [
        { t: '0,30', fb: null },
        { t: '0,03', fb: '0,03 son 3 centésimas y 0,3 son 3 décimas: el cero después de la coma cambia el valor.' },
        { t: '3,0', fb: '3,0 es el entero 3; 0,3 es menor que 1. Añadir un cero al final no convierte uno en el otro.' },
        { t: '0,003', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.25, 0.25, 0.15],
      explicacion:
        '0,3 son 3 décimas, que equivalen a 30 centésimas: 0,3 = 0,30. En cambio 0,03 y 0,003 son mucho menores, y 3,0 es el entero 3.'
    },
    {
      id: 'c6',
      categoria: 'Comparación',
      texto: '¿Cuál es mayor: 0,21 o 0,3?',
      opciones: [
        { t: '0,3', fb: null },
        { t: '0,21', fb: '21 > 3 como enteros, pero aquí son 21 centésimas frente a 30 centésimas.' },
        { t: 'Son iguales', fb: null },
        { t: 'No se puede saber', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.15, 0.9, 0.9],
      explicacion:
        '0,3 = 0,30. Comparando centésimas: 30 > 21, luego 0,3 > 0,21.'
    },
    {
      id: 'c7',
      categoria: 'Comparación',
      texto: '¿Cuál es mayor: 0,8 o 0,85?',
      opciones: [
        { t: '0,85', fb: null },
        { t: '0,8', fb: 'Tener menos cifras no hace mayor al número: 0,8 son 80 centésimas y 0,85 son 85.' },
        { t: 'Son iguales', fb: null },
        { t: 'No se puede saber', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.9, 0.2, 0.9],
      explicacion:
        '0,8 = 0,80. Como 85 > 80 centésimas, 0,85 > 0,8.'
    },
    {
      id: 'r3',
      categoria: 'Recta y densidad',
      texto: '¿Cuántos números decimales hay entre 0,1 y 0,2?',
      opciones: [
        { t: 'Infinitos', fb: null },
        { t: 'Ninguno', fb: 'Entre 1 y 2 no hay enteros, pero entre 0,1 y 0,2 sí hay decimales: 0,11; 0,15; 0,199…' },
        { t: 'Nueve: 0,11, 0,12… 0,19', fb: 'Esos nueve están entre ellos, pero también 0,111, 0,1234… Entre dos decimales siempre hay infinitos.' },
        { t: 'Solo uno: 0,15', fb: null }
      ],
      correcta: 0,
      L: [0.85, 0.2, 0.4, 0.8],
      explicacion:
        'Entre dos decimales distintos siempre hay infinitos números: 0,11; 0,111; 0,1111… Esta propiedad se llama densidad.'
    },
    {
      id: 'o2',
      categoria: 'Ordenación',
      texto: 'Ordena de mayor a menor: 0,5 · 0,45 · 0,405',
      opciones: [
        { t: '0,5 > 0,45 > 0,405', fb: null },
        { t: '0,405 > 0,45 > 0,5', fb: 'Has ordenado 405 > 45 > 5 como enteros, pero en milésimas es al revés: 500 > 450 > 405.' },
        { t: '0,45 > 0,405 > 0,5', fb: null },
        { t: '0,5 > 0,405 > 0,45', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.15, 0.85, 0.9],
      explicacion:
        'Igualando cifras: 0,500 · 0,450 · 0,405. En milésimas: 500 > 450 > 405.'
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Parámetros (valores por defecto de la especificación operativa).    */
  /* ------------------------------------------------------------------ */

  const PARAMETROS = {
    N_MIN: 5, // mínimo de preguntas antes de poder cerrar
    N_MAX: 12, // máximo práctico
    P_MIN: 0.8, // confianza exigida a la hipótesis MAP para cierre firme
    GANANCIA_MIN: 0.02, // bits: por debajo, la mejor pregunta ya aporta muy poco
    TOLERANCIA_EMPATE: 0.015, // bits: candidatas consideradas empatadas
    LAMBDA: 1 // sin olvido: diagnóstico de sesión corta
  };

  const N = HIPOTESIS.length;

  // Umbral de entropía derivado de P_MIN (fórmula de la especificación).
  const H_STOP = (function () {
    const p = PARAMETROS.P_MIN;
    return -p * Math.log2(p) - (1 - p) * Math.log2((1 - p) / (N - 1));
  })();

  /* ------------------------------------------------------------------ */
  /* Motor bayesiano.                                                    */
  /* ------------------------------------------------------------------ */

  function priorUniforme() {
    return new Array(N).fill(1 / N);
  }

  function entropia(p) {
    let h = 0;
    for (const pi of p) {
      if (pi > 0) h -= pi * Math.log2(pi);
    }
    return h;
  }

  // Posterior tras observar acierto (true) o fallo (false) en la pregunta q.
  function actualizar(p, q, acierto) {
    const post = p.map(function (pi, i) {
      const li = acierto ? q.L[i] : 1 - q.L[i];
      return pi * li;
    });
    const suma = post.reduce(function (a, b) { return a + b; }, 0);
    return post.map(function (x) { return x / suma; });
  }

  // Ganancia esperada de información (bits) si se plantea la pregunta q.
  function gananciaEsperada(p, q) {
    let pAcierto = 0;
    for (let i = 0; i < N; i++) pAcierto += p[i] * q.L[i];
    const postAcierto = actualizar(p, q, true);
    const postFallo = actualizar(p, q, false);
    const hEsperada =
      pAcierto * entropia(postAcierto) + (1 - pAcierto) * entropia(postFallo);
    return entropia(p) - hEsperada;
  }

  /*
   * Selecciona la siguiente pregunta: máxima ganancia esperada de
   * información; los empates (dentro de TOLERANCIA_EMPATE) se resuelven
   * favoreciendo la categoría menos repetida y, dentro de ella, al azar.
   * `rng` es una función () => [0,1) para poder sembrarla en la validación.
   */
  function seleccionarSiguiente(p, restantes, usoCategorias, rng) {
    if (restantes.length === 0) return null;
    const ganancias = restantes.map(function (q) {
      return gananciaEsperada(p, q);
    });
    const maxima = Math.max.apply(null, ganancias);
    let candidatas = restantes.filter(function (_, i) {
      return ganancias[i] >= maxima - PARAMETROS.TOLERANCIA_EMPATE;
    });
    const uso = function (q) { return usoCategorias[q.categoria] || 0; };
    const minUso = Math.min.apply(null, candidatas.map(uso));
    candidatas = candidatas.filter(function (q) { return uso(q) === minUso; });
    return candidatas[Math.floor(rng() * candidatas.length)];
  }

  /*
   * Criterio de parada. Devuelve { parar, firme, motivo }.
   * Cierre firme solo si H <= H_STOP y max(p) >= P_MIN; cualquier otro
   * cierre (máximo alcanzado, banco agotado, utilidad marginal baja sin
   * cumplir criterios) se marca como provisional.
   */
  function evaluarParada(p, numRespondidas, restantes) {
    const h = entropia(p);
    const maxP = Math.max.apply(null, p);
    const criterios = h <= H_STOP && maxP >= PARAMETROS.P_MIN;

    if (numRespondidas >= PARAMETROS.N_MIN && criterios) {
      return { parar: true, firme: true, motivo: 'confianza suficiente' };
    }
    if (restantes.length === 0) {
      return { parar: true, firme: criterios, motivo: 'banco agotado' };
    }
    if (numRespondidas >= PARAMETROS.N_MAX) {
      return { parar: true, firme: criterios, motivo: 'máximo de preguntas alcanzado' };
    }
    if (numRespondidas >= PARAMETROS.N_MIN) {
      const mejor = Math.max.apply(null, restantes.map(function (q) {
        return gananciaEsperada(p, q);
      }));
      if (mejor < PARAMETROS.GANANCIA_MIN) {
        return { parar: true, firme: criterios, motivo: 'las preguntas restantes aportan muy poca información' };
      }
    }
    return { parar: false, firme: false, motivo: '' };
  }

  function indiceMAP(p) {
    let mejor = 0;
    for (let i = 1; i < p.length; i++) if (p[i] > p[mejor]) mejor = i;
    return mejor;
  }

  return {
    HIPOTESIS: HIPOTESIS,
    BANCO: BANCO,
    PARAMETROS: PARAMETROS,
    H_STOP: H_STOP,
    priorUniforme: priorUniforme,
    entropia: entropia,
    actualizar: actualizar,
    gananciaEsperada: gananciaEsperada,
    seleccionarSiguiente: seleccionarSiguiente,
    evaluarParada: evaluarParada,
    indiceMAP: indiceMAP
  };
});
