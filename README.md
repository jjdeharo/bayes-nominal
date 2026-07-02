# Diagnóstico bayesiano con hipótesis nominales

Ejemplo de la [metodología de recursos adaptativos bayesianos](https://jjdeharo.github.io/recursos-adaptativos/) para el caso de **hipótesis no jerárquicas (nominales)**: errores conceptuales alternativos, sin orden entre ellos, en lugar de niveles ordenados de dominio.

Acceso: **https://jjdeharo.github.io/bayes-nominal/**

---

## Qué diagnostica

El recurso plantea preguntas sobre comparación de números decimales y mantiene una distribución de probabilidad sobre cuatro hipótesis que explican el comportamiento del alumno. Son errores bien documentados en la investigación en didáctica de las matemáticas y **no admiten orden**: ninguno es «más nivel» que otro.

| Hipótesis | Comportamiento característico |
|---|---|
| Dominio del orden decimal | Compara correctamente por valor posicional |
| Regla del número entero («más cifras, mayor») | Cree que 0,25 > 0,7 porque 25 > 7 |
| Regla de la fracción («menos cifras, mayor») | Cree que 0,3 > 0,45 porque las centésimas «son más pequeñas» |
| Cero invisible | Ignora los ceros tras la coma: lee 0,07 como 0,7 |

## En qué se diferencia del caso jerárquico

Siguiendo la [especificación operativa](https://jjdeharo.github.io/recursos-adaptativos/) para hipótesis no jerárquicas:

- **No se usa IRT logística** (3PL): esa función exige valores `theta` ordenados que aquí no tienen sentido.
- Cada pregunta lleva un **vector de verosimilitudes** `P(acierto | H_i, q)`, una por hipótesis, asignado por tramos: ≈0,9 si el error no interfiere en la pregunta; ≈0,4–0,6 si la afecta parcialmente; ≈0,15–0,25 si un distractor concreto captura activamente ese error (el alumno es atraído hacia esa opción equivocada).
- El diagnóstico final **no calcula una `theta` esperada** (no existe sin orden): reporta la hipótesis de **máxima probabilidad posterior (MAP)** con su probabilidad como confianza, y muestra siempre la distribución posterior completa.

Todo lo demás es la maquinaria general de la metodología: prior uniforme, actualización bayesiana tras cada respuesta, selección de la siguiente pregunta por **máxima ganancia esperada de información** (con empates aleatorizados que favorecen las categorías menos repetidas) y criterio de parada por entropía (`H ≤ H_stop`) y confianza (`max p ≥ 0,80`), con mínimo de 5 preguntas y máximo práctico de 12. Los cierres que no cumplen ambos criterios se presentan como **provisionales**. Al ser un diagnóstico de sesión corta, no se aplica olvido exponencial (`lambda = 1`).

## Archivos

```
bayes-nominal/
├── index.html      Recurso del alumno (autocontenido junto con modelo.js)
├── modelo.js       Hipótesis, banco de preguntas y motor bayesiano (compartido)
├── validacion.js   Herramienta del autor: separabilidad Monte Carlo (Node)
└── README.md       Este documento
```

El recurso funciona sin servidor: basta abrir `index.html` en un navegador (con `modelo.js` en la misma carpeta).

## Validación del diseño (herramienta del autor)

`validacion.js` comprueba la **separabilidad del diseño**: genera respondentes sintéticos que se comportan según cada hipótesis, les pasa el mismo test adaptativo con el mismo criterio de parada y construye la matriz de confusión. Es una herramienta del creador del recurso — no forma parte del material del alumno.

```bash
node validacion.js            # 1000 simulaciones por hipótesis
node validacion.js 5000 42    # simulaciones y semilla
```

Resultado con el banco actual de 24 preguntas (1000 simulaciones por hipótesis, semilla 42): **94,3 % de exactitud global**, sesiones de 5,3–5,5 preguntas de media y más del 99 % de cierres firmes. La matriz mide la fiabilidad *bajo el modelo* (los respondentes salen del propio modelo): indica si el banco discrimina las hipótesis, no si los parámetros reflejan la realidad.

## Licencias

- Contenido: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.es)
- Código: [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html)

## Autor

Juan José de Haro · [bilateria.org](https://bilateria.org)
