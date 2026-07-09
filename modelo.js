/*
 * Modelo bayesiano multifactorial para errores nominales.
 *
 * Ejemplo de la metodología de recursos adaptativos bayesianos:
 * https://jjdeharo.github.io/recursos-adaptativos/
 *
 * Los factores no representan niveles ordenados de dominio, sino errores
 * conceptuales que pueden coexistir al comparar números decimales. Por eso no
 * se usa IRT logística: el banco parte de las verosimilitudes calibradas del
 * modelo nominal original y las convierte en un modelo exacto sobre perfiles
 * completos de errores. La actualización usa la opción elegida, no solo el
 * binario acierto/fallo, para aprovechar el valor diagnóstico de los distractores.
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
  /* Factores de error: cada uno puede estar presente o ausente.         */
  /* El diagnóstico final es un perfil con 0-3 errores detectados.       */
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

  const FACTORES = HIPOTESIS
    .map(function (h, indiceHipotesis) {
      return { h: h, indiceHipotesis: indiceHipotesis };
    })
    .filter(function (x) { return x.h.tipo === 'error'; })
    .map(function (x) {
      return {
        id: x.h.id,
        indiceHipotesis: x.indiceHipotesis,
        nombre: x.h.nombre,
        corta: x.h.corta.replace(/^Error:\s*/, ''),
        titular: x.h.titular,
        descripcion: x.h.descripcion,
        recomendacion: x.h.recomendacion,
        siguientePaso: x.h.siguientePaso
      };
    });

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
    },
    {
      id: 'c8',
      categoria: 'Comparación',
      texto: '¿Cuál es mayor: 0,6 o 0,58?',
      opciones: [
        { t: '0,6', fb: null },
        { t: '0,58', fb: '58 parece más que 6, pero son centésimas: 0,58 son 58 centésimas y 0,6 son 60.' },
        { t: 'Son iguales', fb: null },
        { t: 'No se puede saber', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.15, 0.9, 0.9],
      explicacion:
        '0,6 = 0,60. En centésimas: 60 > 58, así que 0,6 > 0,58.'
    },
    {
      id: 'c9',
      categoria: 'Comparación',
      texto: '¿Cuál es mayor: 0,5 o 0,55?',
      opciones: [
        { t: '0,55', fb: null },
        { t: '0,5', fb: 'Tener menos cifras no hace mayor al número: 0,5 son 50 centésimas y 0,55 son 55.' },
        { t: 'Son iguales', fb: null },
        { t: 'No se puede saber', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.9, 0.2, 0.9],
      explicacion:
        '0,5 = 0,50 y 55 > 50 centésimas: por eso 0,55 > 0,5.'
    },
    {
      id: 'c10',
      categoria: 'Comparación',
      texto: '¿Cuál es mayor: 0,8 o 0,08?',
      opciones: [
        { t: '0,8', fb: null },
        { t: '0,08', fb: 'Más cifras no significa más valor: el cero después de la coma hace a 0,08 diez veces menor que 0,8.' },
        { t: 'Son iguales', fb: 'No lo son: el cero después de la coma sí cuenta. 0,8 son 8 décimas y 0,08 son 8 centésimas.' },
        { t: 'No se puede saber', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.2, 0.85, 0.15],
      explicacion:
        '0,8 son 80 centésimas y 0,08 son 8 centésimas: 0,8 es diez veces mayor.'
    },
    {
      id: 'c11',
      categoria: 'Comparación',
      texto: '¿Cuál es mayor: 1,5 o 1,25?',
      opciones: [
        { t: '1,5', fb: null },
        { t: '1,25', fb: 'La parte entera es la misma (1) y 25 parece más que 5, pero 0,5 son 50 centésimas frente a las 25 de 0,25.' },
        { t: 'Son iguales', fb: null },
        { t: 'No se puede saber', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.2, 0.9, 0.9],
      explicacion:
        'La parte entera empata (1 = 1); en la decimal, 0,5 = 0,50 > 0,25. Por tanto 1,5 > 1,25.'
    },
    {
      id: 'e3',
      categoria: 'Equivalencia',
      texto: '¿Cuál de estos números es igual a 0,70?',
      opciones: [
        { t: '0,7', fb: null },
        { t: '0,07', fb: 'En 0,07 el cero va justo después de la coma y cambia el valor: son 7 centésimas, no 7 décimas.' },
        { t: '7', fb: '7 es un número entero; 0,70 es menor que 1.' },
        { t: '0,077', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.25, 0.25, 0.15],
      explicacion:
        'El cero final no cambia el valor: 0,70 = 0,7 (70 centésimas = 7 décimas). En cambio 0,07 son solo 7 centésimas.'
    },
    {
      id: 'e4',
      categoria: 'Equivalencia',
      texto: '¿Qué relación hay entre 0,4 y 0,04?',
      opciones: [
        { t: '0,4 es mayor', fb: null },
        { t: 'Son el mismo número', fb: 'No lo son: el cero después de la coma divide el valor entre diez. 0,4 son 40 centésimas y 0,04 solo 4.' },
        { t: '0,04 es mayor', fb: 'Más cifras no significa mayor: 0,04 son 4 centésimas frente a las 40 de 0,4.' },
        { t: 'No se pueden comparar', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.2, 0.85, 0.15],
      explicacion:
        '0,4 = 0,40. Como 40 > 4 centésimas, 0,4 es diez veces mayor que 0,04.'
    },
    {
      id: 'o3',
      categoria: 'Ordenación',
      texto: '¿Cuál es el mayor de estos tres números: 0,9 · 0,85 · 0,425?',
      opciones: [
        { t: '0,9', fb: null },
        { t: '0,425', fb: '425 es el entero más grande, pero son milésimas: 0,425 < 0,85 < 0,9.' },
        { t: '0,85', fb: null },
        { t: 'Los tres son iguales', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.15, 0.85, 0.9],
      explicacion:
        'Igualando cifras: 0,900 · 0,850 · 0,425. En milésimas: 900 > 850 > 425, así que el mayor es 0,9.'
    },
    {
      id: 'o4',
      categoria: 'Ordenación',
      texto: 'Ordena de menor a mayor: 0,07 · 0,2 · 0,15',
      opciones: [
        { t: '0,07 < 0,15 < 0,2', fb: null },
        { t: '0,2 < 0,07 < 0,15', fb: 'Has ordenado 2 < 7 < 15 como si fueran enteros; en centésimas el orden es 7 < 15 < 20.' },
        { t: '0,15 < 0,2 < 0,07', fb: 'Parece que 0,07 se ha leído como 0,7: el cero después de la coma lo hace pequeño, son solo 7 centésimas.' },
        { t: '0,15 < 0,07 < 0,2', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.15, 0.8, 0.15],
      explicacion:
        'En centésimas: 0,07 son 7; 0,15 son 15; 0,2 son 20. El orden es 0,07 < 0,15 < 0,2.'
    },
    {
      id: 'r4',
      categoria: 'Recta y densidad',
      texto: '¿Qué número está entre 0,25 y 0,26?',
      opciones: [
        { t: '0,255', fb: null },
        { t: 'No hay ningún número entre ellos', fb: 'Entre 25 y 26 no hay enteros, pero entre 0,25 y 0,26 hay infinitos decimales: 0,251; 0,255; 0,259…' },
        { t: '0,27', fb: null },
        { t: '0,24', fb: null }
      ],
      correcta: 0,
      L: [0.85, 0.2, 0.3, 0.85],
      explicacion:
        '0,25 = 0,250 y 0,26 = 0,260; entre 250 y 260 milésimas está, por ejemplo, 0,255. De hecho hay infinitos.'
    },
    {
      id: 'r5',
      categoria: 'Recta y densidad',
      texto: 'En la recta numérica, ¿qué número está más cerca del 1: 0,9 o 0,111?',
      opciones: [
        { t: '0,9', fb: null },
        { t: '0,111', fb: '111 parece grande, pero son milésimas: 0,111 está cerca del 0,1, lejos del 1.' },
        { t: 'Los dos están a la misma distancia', fb: null },
        { t: 'Ninguno de los dos está entre 0 y 1', fb: null }
      ],
      correcta: 0,
      L: [0.9, 0.15, 0.85, 0.9],
      explicacion:
        '0,9 = 0,900 está a solo una décima del 1; 0,111 está mucho más lejos, cerca de 0,1.'
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Parámetros (valores por defecto de la especificación operativa).    */
  /* ------------------------------------------------------------------ */

  const PARAMETROS = {
    N_MIN: 5, // mínimo de preguntas antes de poder cerrar
    N_MAX: 12, // máximo práctico
    P_MIN: 0.8, // confianza exigida para declarar presente/ausente un factor
    PRIOR_ERROR: 0.25, // prior marginal de presencia para cada error
    MIN_POR_CATEGORIA: 2, // cobertura mínima por categoría para el informe final
    N_INICIO_ALEATORIO: 3, // primera pregunta: elegir al azar entre las N mejores
    GANANCIA_MIN: 0.02, // bits: por debajo, la mejor pregunta ya aporta muy poco
    TOLERANCIA_EMPATE: 0.015, // bits: candidatas consideradas empatadas
    LAMBDA: 1, // sin olvido: diagnóstico de sesión corta
    // Muestra mínima POR FACTOR antes de declararlo presente o ausente (hallazgo N6).
    // Con el prior informativo P(error)=0,25, la "ausencia" arranca ya en 0,75: basta una
    // pregunta discriminante acertada para que la marginal caiga a ~0,05 y el factor se
    // declare ausente. La cobertura por categoría no lo impide, porque una categoría no
    // discrimina necesariamente todos los factores. El banco actual es lo bastante denso
    // para que esto no ocurra en la práctica, pero la garantía no debe depender del banco.
    MIN_EVIDENCIA_FACTOR: 2,
    // Una pregunta aporta evidencia sobre un factor si su presencia cambia de forma
    // apreciable la probabilidad de acierto (penalización en logits).
    UMBRAL_DISCRIMINA: 0.1
  };

  const N = FACTORES.length;
  const CATEGORIAS = Array.from(new Set(BANCO.map(function (q) { return q.categoria; })));

  function acotarProbabilidad(x) {
    return Math.min(0.98, Math.max(0.02, x));
  }

  function logit(p) {
    return Math.log(p / (1 - p));
  }

  function sigmoide(x) {
    return 1 / (1 + Math.exp(-x));
  }

  function interseccion(a, b) {
    const setB = new Set(b);
    return a.filter(function (x) { return setB.has(x); });
  }

  function inferirFactoresOpcion(opcion) {
    const texto = ((opcion.fb || '') + ' ' + (opcion.t || '')).toLowerCase();
    const factores = [];
    if (
      /como si fueran enteros|como enteros|25 con 5|21 > 3|9 es mayor que 1|80 parece mayor que 8|375 parece grande|425 es el entero más grande|405 > 45 > 5|25 parece más que 5|2 < 7 < 15/.test(texto)
    ) factores.push('largo');
    if (
      /tener más cifras decimales no hace el número más pequeño|tener menos cifras no hace mayor|más cifras no significa más pequeño|más cifras no significa mayor|menos cifras no hace mayor|más cifras no significa más valor/.test(texto)
    ) factores.push('corto');
    if (
      /cero después de la coma|cero va justo después de la coma|0,05 no es 0,5|0,07|0,04|0,03|0,003|se ha leído como 0,7|no son iguales: el cero/.test(texto)
    ) factores.push('cero');
    return factores;
  }

  function entropiaBinaria(p) {
    if (p <= 0 || p >= 1) return 0;
    return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
  }

  function generarPerfiles() {
    const perfiles = [];
    const total = 1 << N;
    for (let mascara = 0; mascara < total; mascara++) {
      const presentes = FACTORES.filter(function (_, i) {
        return Boolean(mascara & (1 << i));
      });
      perfiles.push({
        indice: mascara,
        mascara: mascara,
        presentes: presentes,
        ids: presentes.map(function (f) { return f.id; }),
        etiqueta: presentes.length
          ? presentes.map(function (f) { return f.id; }).join('+')
          : 'sin-fallos'
      });
    }
    return perfiles;
  }

  const PERFILES = generarPerfiles();
  const PERFIL_POR_ETIQUETA = {};
  const ORDEN_FACTOR = {};
  FACTORES.forEach(function (factor, indice) {
    ORDEN_FACTOR[factor.id] = indice;
  });
  PERFILES.forEach(function (perfil) {
    PERFIL_POR_ETIQUETA[perfil.etiqueta] = perfil;
  });

  function perfilDesdeIds(ids) {
    const etiqueta = ids && ids.length
      ? ids.slice().sort(function (a, b) {
        return ORDEN_FACTOR[a] - ORDEN_FACTOR[b];
      }).join('+')
      : 'sin-fallos';
    return PERFIL_POR_ETIQUETA[etiqueta];
  }

  BANCO.forEach(function (q) {
    const base = acotarProbabilidad(q.L[0]);
    q.base = base;
    q.opciones.forEach(function (opcion, indice) {
      opcion.factores = indice === q.correcta ? [] : inferirFactoresOpcion(opcion);
    });
    q.factores = FACTORES.map(function (f) {
      const pSolo = acotarProbabilidad(q.L[f.indiceHipotesis]);
      const penalizacion = Math.max(0, logit(base) - logit(pSolo));
      return {
        id: f.id,
        pSolo: pSolo,
        penalizacion: penalizacion
      };
    });
    q.pPerfiles = PERFILES.map(function (perfil) {
      const penalizacionTotal = perfil.presentes.reduce(function (suma, factor) {
        const modeloFactor = q.factores.find(function (x) { return x.id === factor.id; });
        return suma + modeloFactor.penalizacion;
      }, 0);
      return acotarProbabilidad(sigmoide(logit(base) - penalizacionTotal));
    });
    q.pOpcionesPerfiles = PERFILES.map(function (perfil, indicePerfil) {
      const pCorrecta = q.pPerfiles[indicePerfil];
      const pesos = q.opciones.map(function (opcion, indiceOpcion) {
        if (indiceOpcion === q.correcta) return 0;
        if (!opcion.factores.length) return 1;
        const solape = interseccion(
          opcion.factores,
          perfil.ids
        ).length;
        if (solape === opcion.factores.length) return 5 + 2 * (solape - 1);
        if (solape > 0) return 2.5;
        return 0.6;
      });
      const sumaPesos = pesos.reduce(function (a, b) { return a + b; }, 0);
      return q.opciones.map(function (_, indiceOpcion) {
        if (indiceOpcion === q.correcta) return pCorrecta;
        return (1 - pCorrecta) * pesos[indiceOpcion] / sumaPesos;
      });
    });
  });

  // Umbral máximo de entropía marginal cuando todos los factores quedan
  // decididos con la confianza mínima exigida.
  const H_STOP = (function () {
    const p = PARAMETROS.P_MIN;
    return N * entropiaBinaria(p);
  })();

  /* ------------------------------------------------------------------ */
  /* Motor bayesiano.                                                    */
  /* ------------------------------------------------------------------ */

  function priorPerfiles() {
    const prior = PERFILES.map(function (perfil) {
      return FACTORES.reduce(function (peso, _, i) {
        const presente = Boolean(perfil.mascara & (1 << i));
        return peso * (presente ? PARAMETROS.PRIOR_ERROR : (1 - PARAMETROS.PRIOR_ERROR));
      }, 1);
    });
    const suma = prior.reduce(function (a, b) { return a + b; }, 0);
    return prior.map(function (x) { return x / suma; });
  }

  function marginalesFactores(distribucion) {
    return FACTORES.map(function (_, i) {
      return distribucion.reduce(function (suma, piPerfil, indicePerfil) {
        return suma + (Boolean(PERFILES[indicePerfil].mascara & (1 << i)) ? piPerfil : 0);
      }, 0);
    });
  }

  function entropia(distribucion) {
    return marginalesFactores(distribucion).reduce(function (h, pi) {
      return h + entropiaBinaria(pi);
    }, 0);
  }

  // Posterior sobre los perfiles completos tras observar la opción elegida.
  function actualizar(distribucion, q, indiceOpcion) {
    const post = distribucion.map(function (piPerfil, indicePerfil) {
      const verosimilitud = q.pOpcionesPerfiles[indicePerfil][indiceOpcion];
      return piPerfil * verosimilitud;
    });
    const suma = post.reduce(function (a, b) { return a + b; }, 0);
    return post.map(function (x) { return x / suma; });
  }

  function probOpcionPregunta(distribucion, q, indiceOpcion) {
    return distribucion.reduce(function (suma, piPerfil, indicePerfil) {
      return suma + piPerfil * q.pOpcionesPerfiles[indicePerfil][indiceOpcion];
    }, 0);
  }

  // Ganancia esperada de información total (bits marginales) si se plantea q.
  function gananciaEsperada(distribucion, q) {
    const hActual = entropia(distribucion);
    const hEsperada = q.opciones.reduce(function (suma, _, indiceOpcion) {
      const prob = probOpcionPregunta(distribucion, q, indiceOpcion);
      return suma + prob * entropia(actualizar(distribucion, q, indiceOpcion));
    }, 0);
    return hActual - hEsperada;
  }

  /*
   * Selecciona la siguiente pregunta: máxima ganancia esperada de
   * información; los empates (dentro de TOLERANCIA_EMPATE) se resuelven
   * favoreciendo la categoría menos repetida y, dentro de ella, al azar.
   * `rng` es una función () => [0,1) para poder sembrarla en la validación.
   */
  function seleccionarSiguiente(p, restantes, usoCategorias, rng) {
    if (restantes.length === 0) return null;
    const categoriasPendientes = CATEGORIAS.filter(function (categoria) {
      return (usoCategorias[categoria] || 0) < PARAMETROS.MIN_POR_CATEGORIA;
    });
    if (categoriasPendientes.length) {
      const pendientes = restantes.filter(function (q) {
        return categoriasPendientes.indexOf(q.categoria) >= 0;
      });
      if (pendientes.length) restantes = pendientes;
    }
    const ganancias = restantes.map(function (q) {
      return gananciaEsperada(p, q);
    });
    const totalUsadas = CATEGORIAS.reduce(function (suma, categoria) {
      return suma + (usoCategorias[categoria] || 0);
    }, 0);
    if (totalUsadas === 0) {
      const rankingInicial = restantes.map(function (q, i) {
        return { q: q, ganancia: ganancias[i] };
      }).sort(function (a, b) {
        return b.ganancia - a.ganancia;
      });
      const n = Math.min(PARAMETROS.N_INICIO_ALEATORIO, rankingInicial.length);
      return rankingInicial[Math.floor(rng() * n)].q;
    }
    const maxima = Math.max.apply(null, ganancias);
    let candidatas = restantes.filter(function (_, i) {
      return ganancias[i] >= maxima - PARAMETROS.TOLERANCIA_EMPATE;
    });
    const uso = function (q) { return usoCategorias[q.categoria] || 0; };
    const minUso = Math.min.apply(null, candidatas.map(uso));
    candidatas = candidatas.filter(function (q) { return uso(q) === minUso; });
    return candidatas[Math.floor(rng() * candidatas.length)];
  }

  function coberturaCategoriasSuficiente(usoCategorias) {
    return CATEGORIAS.every(function (categoria) {
      return (usoCategorias[categoria] || 0) >= PARAMETROS.MIN_POR_CATEGORIA;
    });
  }

  /*
   * Criterio de parada. Devuelve { parar, firme, motivo }.
   * Cierre firme solo si todos los factores quedan clasificados como
   * presentes o ausentes con la confianza exigida.
   */
  function evaluarParada(distribucion, numRespondidas, restantes, usoCategorias, evidencia) {
    const perfil = evaluarPerfil(distribucion, evidencia);
    const coberturaOK = coberturaCategoriasSuficiente(usoCategorias || {});
    const criterios = perfil.resuelto &&
      perfil.confianzaMin >= PARAMETROS.P_MIN &&
      coberturaOK;

    if (numRespondidas >= PARAMETROS.N_MIN && criterios) {
      return { parar: true, firme: true, motivo: 'confianza suficiente' };
    }
    if (restantes.length === 0) {
      return { parar: true, firme: criterios, motivo: 'banco agotado' };
    }
    if (numRespondidas >= PARAMETROS.N_MAX) {
      return { parar: true, firme: criterios, motivo: 'máximo de preguntas alcanzado' };
    }
    if (numRespondidas >= PARAMETROS.N_MIN && coberturaOK) {
      const mejor = Math.max.apply(null, restantes.map(function (q) {
        return gananciaEsperada(distribucion, q);
      }));
      if (mejor < PARAMETROS.GANANCIA_MIN) {
        return { parar: true, firme: criterios, motivo: 'las preguntas restantes aportan muy poca información' };
      }
    }
    return { parar: false, firme: false, motivo: '' };
  }

  /*
   * ¿Aporta la pregunta `q` evidencia sobre el factor `i`? Solo si la presencia de ese
   * error cambia de forma apreciable la probabilidad de acertarla.
   */
  function discriminaFactor(q, i) {
    return q.factores[i].penalizacion > PARAMETROS.UMBRAL_DISCRIMINA;
  }

  /*
   * Evidencia acumulada por factor: número de preguntas respondidas que lo discriminan.
   */
  function evidenciaFactores(preguntasRespondidas) {
    return FACTORES.map(function (_, i) {
      return preguntasRespondidas.filter(function (q) {
        return discriminaFactor(q, i);
      }).length;
    });
  }

  /*
   * `evidencia` (opcional): número de preguntas discriminantes respondidas por factor.
   * Sin ella se clasifica solo por la probabilidad marginal, que es lo que hacía la
   * versión anterior. Con ella, un factor sin muestra mínima queda `indeterminado`
   * aunque su marginal sea extrema (hallazgo N6): no se confunde "ausente confirmado"
   * con "todavía sin evidencia suficiente sobre este error".
   */
  function evaluarPerfil(distribucion, evidencia) {
    const marginales = marginalesFactores(distribucion);
    const detalles = FACTORES.map(function (f, i) {
      const prob = marginales[i];
      const confianza = Math.max(prob, 1 - prob);
      const n = evidencia ? evidencia[i] : Infinity;
      const sinEvidencia = n < PARAMETROS.MIN_EVIDENCIA_FACTOR;
      let estado = 'indeterminado';
      if (!sinEvidencia) {
        if (prob >= PARAMETROS.P_MIN) estado = 'presente';
        if (prob <= 1 - PARAMETROS.P_MIN) estado = 'ausente';
      }
      return {
        factor: f,
        prob: prob,
        confianza: confianza,
        estado: estado,
        evidencia: evidencia ? n : null,
        sinEvidencia: sinEvidencia
      };
    });

    return {
      detalles: detalles,
      presentes: detalles.filter(function (d) { return d.estado === 'presente'; }),
      ausentes: detalles.filter(function (d) { return d.estado === 'ausente'; }),
      indeterminados: detalles.filter(function (d) { return d.estado === 'indeterminado'; }),
      numeroPresentes: detalles.filter(function (d) { return d.estado === 'presente'; }).length,
      resuelto: detalles.every(function (d) { return d.estado !== 'indeterminado'; }),
      confianzaMin: Math.min.apply(null, detalles.map(function (d) { return d.confianza; }))
    };
  }

  function probAciertoPerfil(q, presentesIds) {
    const perfil = perfilDesdeIds(presentesIds || []);
    return q.pPerfiles[perfil.indice];
  }

  function muestrearRespuestaPerfil(q, presentesIds, rng) {
    const perfil = perfilDesdeIds(presentesIds || []);
    const probs = q.pOpcionesPerfiles[perfil.indice];
    const u = rng();
    let acumulada = 0;
    for (let i = 0; i < probs.length; i++) {
      acumulada += probs[i];
      if (u <= acumulada) return i;
    }
    return probs.length - 1;
  }

  function perfilMAP(distribucion) {
    let mejor = 0;
    for (let i = 1; i < distribucion.length; i++) {
      if (distribucion[i] > distribucion[mejor]) mejor = i;
    }
    return PERFILES[mejor];
  }

  function confianzaVeredicto(distribucion) {
    return evaluarPerfil(distribucion).confianzaMin;
  }

  function indiceMAP(p) {
    let mejor = 0;
    for (let i = 1; i < p.length; i++) if (p[i] > p[mejor]) mejor = i;
    return mejor;
  }

  /*
   * Ajuste del patrón individual (person-fit, índice l_z). Evalúa si el
   * patrón de respuestas es coherente con el perfil MAP diagnosticado:
   * compara la log-verosimilitud del patrón observado con su media y
   * varianza esperadas bajo ese perfil, promediando sobre las opciones
   * de cada ítem (generalización politómica del l_z clásico). Un valor
   * muy negativo (< -2) señala un patrón que ningún perfil del modelo
   * explica bien —descuidos, azar o un error no contemplado— y el
   * diagnóstico debe tomarse con cautela, aunque la confianza sea alta.
   * Con pocas preguntas es orientativo, no una prueba formal.
   * `historial` es una lista de { q, opcion } con la pregunta y el
   * índice de la opción elegida.
   */
  function personFit(distribucion, historial) {
    const perfil = perfilMAP(distribucion);
    let logL = 0, esperanza = 0, varianza = 0;
    historial.forEach(function (paso) {
      const probs = paso.q.pOpcionesPerfiles[perfil.indice];
      logL += Math.log(probs[paso.opcion]);
      let e = 0, e2 = 0;
      probs.forEach(function (p) {
        if (p > 0) {
          const lp = Math.log(p);
          e += p * lp;
          e2 += p * lp * lp;
        }
      });
      esperanza += e;
      varianza += e2 - e * e;
    });
    const lz = varianza > 0 ? (logL - esperanza) / Math.sqrt(varianza) : 0;
    return { lz: lz, fiable: lz >= -2 };
  }

  return {
    HIPOTESIS: HIPOTESIS,
    FACTORES: FACTORES,
    CATEGORIAS: CATEGORIAS,
    PERFILES: PERFILES,
    BANCO: BANCO,
    PARAMETROS: PARAMETROS,
    H_STOP: H_STOP,
    priorPerfiles: priorPerfiles,
    marginalesFactores: marginalesFactores,
    entropia: entropia,
    actualizar: actualizar,
    gananciaEsperada: gananciaEsperada,
    seleccionarSiguiente: seleccionarSiguiente,
    coberturaCategoriasSuficiente: coberturaCategoriasSuficiente,
    evaluarParada: evaluarParada,
    evaluarPerfil: evaluarPerfil,
    discriminaFactor: discriminaFactor,
    evidenciaFactores: evidenciaFactores,
    probAciertoPerfil: probAciertoPerfil,
    muestrearRespuestaPerfil: muestrearRespuestaPerfil,
    perfilMAP: perfilMAP,
    confianzaVeredicto: confianzaVeredicto,
    indiceMAP: indiceMAP,
    personFit: personFit
  };
});
