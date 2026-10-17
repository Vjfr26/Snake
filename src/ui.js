/* Piezas de interfaz compartidas: estilos de texto, botones navegables con teclado, progreso
   guardado, gritos en pantalla y confeti. */

const ORO = '#ffd23f', CREMA = '#fbfff4', TINTA = '#23361a', ROJO = '#ff8a7a';

function estiloTexto(tam, color = CREMA, extra = {}) {
    return Object.assign({
        fontFamily: 'Fredoka, sans-serif', fontSize: tam + 'px', fontStyle: '600', color,
        stroke: '#14200f', strokeThickness: Math.max(2, Math.round(tam / 6)),
    }, extra);
}

/** Progreso guardado: niveles desbloqueados, estrellas, mejores puntos y récord del clásico. */
const Progreso = {
    clave: 'serpiente-progreso',
    datos: { desbloqueado: 1, estrellas: new Array(9).fill(0), puntos: new Array(9).fill(0), record: 0, final: false, pistas: {} },
    cargar() {
        try {
            const d = JSON.parse(localStorage.getItem(this.clave));
            if (d) for (const k of Object.keys(this.datos)) if (d[k] !== undefined) this.datos[k] = d[k];
        } catch (e) { /* sin almacenamiento */ }
    },
    guardar() {
        try { localStorage.setItem(this.clave, JSON.stringify(this.datos)); } catch (e) { /* sin almacenamiento */ }
    },
    completar(i, estrellas, puntos) {
        const d = this.datos;
        d.desbloqueado = Math.min(NIVELES.length, Math.max(d.desbloqueado, i + 2));
        d.estrellas[i] = Math.max(d.estrellas[i] || 0, estrellas);
        d.puntos[i] = Math.max(d.puntos[i] || 0, puntos);
        this.guardar();
    },
};
Progreso.cargar();

function crearBoton(escena, x, y, w, h, texto, accion, opts = {}) {
    const tam = opts.tam || 26;
    const normal = escena.add.nineslice(0, 0, 'boton', 0, w, h, 22, 22, 22, 22);
    const oro = escena.add.nineslice(0, 0, 'boton_oro', 0, w, h, 22, 22, 22, 22).setVisible(false);
    const t = escena.add.text(0, -2, texto, estiloTexto(tam, TINTA, { strokeThickness: 0 })).setOrigin(0.5);
    const c = escena.add.container(x, y, [normal, oro, t]).setSize(w, h).setDepth(opts.prof ?? 50);
    c.setInteractive({ useHandCursor: true });
    c.texto = t;
    c.accion = accion;
    c.resaltar = (si) => { oro.setVisible(si); normal.setVisible(!si); c.setScale(si ? 1.04 : 1); };
    c.pulsar = () => {
        Sonido.iniciar();
        Sonido.sfx('elegir');
        escena.tweens.add({ targets: c, scale: 0.95, duration: 70, yoyo: true });
        c.accion(c);
    };
    c.on('pointerdown', c.pulsar);
    return c;
}

function crearBotonIcono(escena, x, y, icono, accion, prof = 60) {
    const fondo = escena.add.circle(0, 0, 22, 0x10161e, 0.8).setStrokeStyle(2.5, 0xa8e070);
    const img = escena.add.image(0, 0, icono).setScale(0.62);
    const c = escena.add.container(x, y, [fondo, img]).setSize(48, 48).setDepth(prof);
    c.setInteractive({ useHandCursor: true });
    c.icono = img;
    c.on('pointerover', () => fondo.setFillStyle(0x24341c, 0.9));
    c.on('pointerout', () => fondo.setFillStyle(0x10161e, 0.8));
    c.on('pointerdown', (p, lx, ly, ev) => { if (ev) ev.stopPropagation(); Sonido.iniciar(); escena.tweens.add({ targets: c, scale: 0.9, duration: 70, yoyo: true }); accion(c); });
    return c;
}

/** Navegación con flechas y ENTER entre botones; con `columnas` > 1 es una rejilla. */
function navegacion(escena, botones, opts = {}) {
    const columnas = opts.columnas || 1;
    let sel = opts.inicial || 0;
    const pintar = () => botones.forEach((b, i) => b.resaltar(i === sel));
    botones.forEach((b, i) => b.on('pointerover', () => { if (sel !== i) { sel = i; pintar(); Sonido.sfx('menu'); } }));
    const mover = (d) => { sel = Phaser.Math.Clamp(sel + d, 0, botones.length - 1); pintar(); Sonido.sfx('menu'); };
    const ok = () => { Sonido.iniciar(); botones[sel].pulsar(); };
    const teclas = {
        LEFT: () => mover(-1), RIGHT: () => mover(1),
        UP: () => mover(-columnas), DOWN: () => mover(columnas),
        W: () => mover(-columnas), S: () => mover(columnas), A: () => mover(-1), D: () => mover(1),
        ENTER: ok, SPACE: ok,
    };
    const tk = escena.input.keyboard;
    for (const [k, f] of Object.entries(teclas)) tk.on('keydown-' + k, f);
    pintar();
    return {
        get sel() { return sel; },
        destruir() { for (const [k, f] of Object.entries(teclas)) tk.off('keydown-' + k, f); },
    };
}

function grito(escena, texto, opts = {}) {
    const t = escena.add.text(opts.x ?? ANCHO / 2, opts.y ?? ALTO / 2, texto, estiloTexto(opts.tam || 72, opts.color || ORO, { fontStyle: '700', strokeThickness: 12 }))
        .setOrigin(0.5).setDepth(opts.prof ?? 80).setScale(0.2).setAlpha(0);
    escena.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
    escena.tweens.add({ targets: t, alpha: 0, y: t.y - 30, delay: opts.dura || 1100, duration: 360, onComplete: () => t.destroy() });
    return t;
}

function lluviaConfeti(escena, cantidad = 120, prof = 90) {
    const colores = [0xffd23f, 0xff6b81, 0x6be3ff, 0x7dff9a, 0xc59bff, 0xffffff];
    for (let i = 0; i < cantidad; i++) {
        const c = escena.add.image(Phaser.Math.Between(0, ANCHO), Phaser.Math.Between(-300, -10), 'confeti')
            .setTint(Phaser.Utils.Array.GetRandom(colores)).setDepth(prof).setAngle(Phaser.Math.Between(0, 360));
        escena.tweens.add({
            targets: c, y: ALTO + 40, x: c.x + Phaser.Math.Between(-120, 120), angle: c.angle + Phaser.Math.Between(-540, 540),
            duration: Phaser.Math.Between(1800, 3200), delay: Phaser.Math.Between(0, 600), ease: 'Sine.easeIn', onComplete: () => c.destroy(),
        });
    }
}

function formatoTiempo(seg) {
    const m = Math.floor(seg / 60), s = Math.floor(seg % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}
