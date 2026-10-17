# Snake

La serpiente de siempre, reinventada para el navegador con [Phaser 3](https://phaser.io): una aventura de 9 niveles por tres mundos y el modo clásico infinito.

La primera versión (un solo `snake.html`) sigue en el historial del repositorio. También se puede jugar en mi portafolio: [victorfernandes.vercel.app](https://victorfernandes.vercel.app).

## Qué tiene

- **Aventura de 9 niveles en 3 mundos**:
  - El Jardín: setos y túneles en el borde que te llevan al lado contrario.
  - El Desierto: portales, rocas que ruedan y un oasis.
  - La Cueva de Cristal: una serpiente rival que te roba manzanas, un nivel a oscuras y el Rey Serpiente.
- En cada nivel comes las manzanas que pide, se abre la salida y te llevas hasta 3 estrellas.
- **Modo clásico** sin fin, con récord guardado.
- **Extras**: manzanas doradas, combos de hasta ×5, un ratón que huye y vale 100 puntos, y poderes (cámara lenta, fantasma, tijeras e imán).
- **Serpiente rival con IA**: busca el camino más corto a la manzana (BFS) y evita encerrarse. Si choca contra tu cuerpo, desaparece.
- Movimiento suave, lengua, ojos que miran a la manzana, música chiptune por mundo y textos en español, inglés y portugués.

## Controles

| Tecla | Acción |
| --- | --- |
| Flechas / W A S D | Girar |
| Espacio / P / Esc | Pausa |
| M | Sonido |

En el móvil se juega deslizando el dedo, y se pueden encadenar giros sin levantarlo.

## Jugar en local

Lo más fiable es servir la carpeta con un servidor estático, porque desde `file://` el navegador no deja cargar la fuente:

```bash
python3 -m http.server 8000
```

Después abre <http://localhost:8000>. Para probar: `?nivel=5` entra en un nivel y `?clasico` en el modo clásico.

## Estructura

```
src/niveles.js   los 9 mapas (30 × 16 casillas, en texto) y el tablero del clásico
src/juego.js     la partida: serpiente, rival, rocas, ratón, poderes y dibujo
src/escenas.js   menú, niveles, controles, pausa y final
src/arte.js      fondos, muros y objetos dibujados por código
src/sonido.js    efectos y música con WebAudio
src/textos.js    textos en los tres idiomas
lib/             Phaser 3.70 (licencia MIT) y un arreglo del teclado de Phaser
```

## Créditos

- Código: Victor Fernandes.
- Fuente Fredoka: SIL Open Font License (`fuente/OFL.txt`).
- Phaser 3: licencia MIT (`lib/PHASER-LICENSE.txt`).
