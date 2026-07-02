# Diagnóstico bayesiano multifactorial

Ejemplo de la [metodología de recursos adaptativos bayesianos](https://jjdeharo.github.io/recursos-adaptativos/) adaptado a un diagnóstico **multifactorial**: el sistema estima por separado la presencia o ausencia de varios errores conceptuales, de modo que un alumno puede mostrar más de un fallo a la vez.

Acceso: **https://jjdeharo.github.io/bayes-nominal/**

---

## Qué diagnostica

El recurso plantea preguntas sobre comparación de números decimales y mantiene una probabilidad independiente para cada uno de estos tres errores bien documentados en la investigación en didáctica de las matemáticas:

| Factor | Comportamiento característico |
|---|---|
| Dominio del orden decimal | Compara correctamente por valor posicional |
| Regla del número entero («más cifras, mayor») | Cree que 0,25 > 0,7 porque 25 > 7 |
| Regla de la fracción («menos cifras, mayor») | Cree que 0,3 > 0,45 porque las centésimas «son más pequeñas» |
| Cero invisible | Ignora los ceros tras la coma: lee 0,07 como 0,7 |

## En qué se diferencia del caso jerárquico

Siguiendo la [especificación operativa](https://jjdeharo.github.io/recursos-adaptativos/) para hipótesis no jerárquicas:

- **No se usa IRT logística** (3PL): esa función exige valores `theta` ordenados que aquí no tienen sentido.
- Cada pregunta reutiliza el banco calibrado del modelo anterior, pero ahora se convierte en un modelo exacto sobre los `2^3 = 8` perfiles posibles. Para actualizar no se usa solo acierto/fallo: también cuenta **qué distractor** ha elegido el alumno.
- El diagnóstico final devuelve un **perfil de 0 a 3 fallos detectados**. El cierre es firme solo si todos los errores quedan clasificados como presentes o ausentes con la confianza exigida.

Todo lo demás es la maquinaria general de la metodología: prior del 25 % para cada error, actualización bayesiana tras cada respuesta, selección de la siguiente pregunta por **máxima ganancia esperada de información** (con una primera pregunta elegida al azar entre las mejores y forzando después la cobertura mínima de categorías) y criterio de parada por entropía total (`H ≤ H_stop`), clasificación de cada factor con al menos un 80 % de confianza y un mínimo de `2` preguntas por categoría, con mínimo de 5 preguntas y máximo práctico de 12. Los cierres que no cumplen ambos criterios se presentan como **provisionales**. Al ser un diagnóstico de sesión corta, no se aplica olvido exponencial (`lambda = 1`).

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

`validacion.js` comprueba el **comportamiento del diseño multifactorial**: genera respondentes sintéticos con perfiles de errores distintos, les pasa el mismo test adaptativo con el mismo criterio de parada y construye la matriz de confusión. Es una herramienta del creador del recurso, no forma parte del material del alumno.

```bash
node validacion.js            # 1000 simulaciones por perfil
node validacion.js 5000 42    # simulaciones y semilla
```

Con la implantación actual del modelo multifactorial y actualización por distractor, una simulación `node validacion.js 500 42` da **80,5 % de exactitud global** y más del **94 % de cierres firmes** en todos los perfiles. Las cifras históricas del modelo antiguo ya no son comparables, porque ahora la tarea es reconstruir perfiles con varios errores simultáneos.

## Licencias

- Contenido: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.es)
- Código: [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html)

## Autor

Juan José de Haro · [bilateria.org](https://bilateria.org)
