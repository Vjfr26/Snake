/* Escenas fuera de la partida: arranque, menú (principal, niveles y controles), pausa y el
   final de la aventura. Con ?nivel=N se entra directo a un nivel y con ?clasico al modo
   clásico (útil para probar; ?auto juega solo y ?vel=N acelera). */

class Arranque extends Phaser.Scene {
    constructor() { super('Arranque'); }

    create() {
        this.add.text(ANCHO / 2, ALTO / 2, TXT.cargando, estiloTexto(26)).setOrigin(0.5);
        this.time.delayedCall(30, () => {
            Arte.generar(this);
            const q = new URLSearchParams(location.search);
            const n = parseInt(q.get('nivel'), 10);
            if (n >= 1 && n <= NIVELES.length) this.scene.start('Juego', { nivel: n - 1 });
            else if (q.has('clasico')) this.scene.start('Juego', { clasico: true });
            else if (q.has('final')) this.scene.start('Final');
            else this.scene.start('Menu');
        });
    }
}

/** Una serpiente de adorno que sigue una curva (menú y final). */
function serpienteDecorativa(escena, centro, ancho, alto, largo, colores, prof = 5) {
    const g = escena.add.graphics().setDepth(prof);
    const S = { t: Math.random() * 10 };
    const pos = (t) => ({ x: centro.x + Math.sin(t * 0.9) * ancho + Math.sin(t * 2.1) * 30, y: centro.y + Math.sin(t * 1.7) * alto });
    const mover = (tt, dt) => {
        if (!g.active) return;
        S.t += dt / 1000 * 0.55;
        g.clear();
        const pts = [];
        for (let i = 0; i < largo; i++) pts.push(pos(S.t - i * 0.045));
        for (let pase = 0; pase < 3; pase++) {
            for (let i = pts.length - 1; i >= 0; i--) {
                const r = 15 * (1 - 0.4 * i / largo);
                if (pase === 0) { g.fillStyle(colores.borde, 1); g.fillCircle(pts[i].x, pts[i].y, r + 2.5); }
                else if (pase === 1) { g.fillStyle(i % 6 < 2 ? colores.raya : colores.cuerpo, 1); g.fillCircle(pts[i].x, pts[i].y, r); }
                else { g.fillStyle(colores.brillo, 0.35); g.fillCircle(pts[i].x - r * 0.3, pts[i].y - r * 0.35, r * 0.32); }
            }
        }
        const h = pts[0], n = pts[1];
        const l = Math.hypot(h.x - n.x, h.y - n.y) || 1;
        const dx = (h.x - n.x) / l, dy = (h.y - n.y) / l;
        g.fillStyle(colores.borde, 1); g.fillCircle(h.x, h.y, 19);
        g.fillStyle(colores.cabeza, 1); g.fillCircle(h.x, h.y, 16.5);
        for (const lado of [-1, 1]) {
            const ex = h.x + dx * 6 - dy * lado * 8, ey = h.y + dy * 6 + dx * lado * 8;
            g.fillStyle(0xffffff, 1); g.fillCircle(ex, ey, 6);
            g.fillStyle(0x111111, 1); g.fillCircle(ex + dx * 2.4, ey + dy * 2.4, 3.2);
        }
    };
    escena.events.on('update', mover);
    escena.events.once('shutdown', () => escena.events.off('update', mover));
    return g;
}

/* ===================================================================== */
class Menu extends Phaser.Scene {
    constructor() { super('Menu'); }

    init(d) { this.pantallaInicial = (d && d.pantalla) || 'principal'; }

    create() {
        this.cameras.main.fadeIn(400, 0, 0, 0);
        this.add.image(0, 0, 'escenario_0').setOrigin(0);
        this.add.rectangle(0, 0, ANCHO, ALTO, 0x0b1a08, 0.3).setOrigin(0);
        // Manzanas de adorno
        for (let i = 0; i < 7; i++) {
            const x = i % 2 ? Phaser.Math.Between(90, 400) : Phaser.Math.Between(880, ANCHO - 90);
            const m = this.add.image(x, Phaser.Math.Between(110, ALTO - 60), i % 3 ? 'manzana' : 'dorada').setScale(0.7).setDepth(2);
            this.tweens.add({ targets: m, y: m.y - 8, duration: Phaser.Math.Between(800, 1300), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        this.decorativa = serpienteDecorativa(this, { x: ANCHO / 2, y: 420 }, 470, 210, 34, COLORES_SERPIENTE.jugador, 3);
        this.nav = null;
        this.sub = [];
        this.teclasExtra = [];
        this[this.pantallaInicial]();
        Sonido.musica('menu');
        this.input.keyboard.on('keydown', () => Sonido.iniciar());
        this.input.on('pointerdown', () => Sonido.iniciar());
    }

    limpiar() {
        if (this.nav) { this.nav.destruir(); this.nav = null; }
        for (const [k2, f] of this.teclasExtra) this.input.keyboard.off(k2, f);
        this.teclasExtra = [];
        this.sub.forEach((o) => o.destroy());
        this.sub = [];
    }

    tecla(nombre, f) { this.input.keyboard.on(nombre, f); this.teclasExtra.push([nombre, f]); }

    titulo(texto, y = 70, tam = 56) {
        const t = this.add.text(ANCHO / 2, y, texto, estiloTexto(tam, ORO, { fontStyle: '700', strokeThickness: 12, shadow: { offsetX: 0, offsetY: 6, color: '#000', blur: 10, fill: true } })).setOrigin(0.5).setDepth(20);
        this.sub.push(t);
        return t;
    }

    principal() {
        this.limpiar();
        this.decorativa.setVisible(true);
        const colores = ['#7dff8a', '#ffd23f', '#ff6b81', '#6be3ff', '#c59bff'];
        const letras = 'SNAKE'.split('').map((l, i) => this.add.text(0, -80, l, estiloTexto(124, colores[i], { fontStyle: '700', strokeThickness: 18, shadow: { offsetX: 0, offsetY: 8, color: '#000', blur: 12, fill: true } })).setOrigin(0.5).setDepth(20));
        const anchos = letras.map((t) => t.width - 20);
        let x = ANCHO / 2 - anchos.reduce((a, b) => a + b, 0) / 2;
        letras.forEach((t, i) => {
            t.x = x + anchos[i] / 2; x += anchos[i];
            this.tweens.add({ targets: t, y: 110, duration: 600, delay: i * 80, ease: 'Bounce.easeOut' });
            this.tweens.add({ targets: t, angle: { from: -4, to: 4 }, duration: 900 + i * 60, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 700 });
            this.sub.push(t);
        });
        this.sub.push(this.add.text(ANCHO / 2, 190, TXT.lema, estiloTexto(24, CREMA)).setOrigin(0.5).setDepth(20));
        const d = Progreso.datos;
        const total = d.estrellas.reduce((a, b) => a + b, 0);
        const info = [];
        if (total) info.push(`★ ${total}/27`);
        if (d.record) info.push(`${TXT.record} ${TXT.clasico}: ${d.record}`);
        if (info.length) this.sub.push(this.add.text(ANCHO / 2, 226, info.join('   ·   '), estiloTexto(17, '#e8ffd0')).setOrigin(0.5).setDepth(20));
        const items = [
            [TXT.aventura, () => this.niveles()],
            [TXT.clasico, () => this.jugar({ clasico: true })],
            [TXT.controles, () => this.controles()],
            [Sonido.activo ? TXT.sonidoSi : TXT.sonidoNo, (b) => b.texto.setText(Sonido.alternar() ? TXT.sonidoSi : TXT.sonidoNo)],
            [Sonido.musicaActiva ? TXT.musicaSi : TXT.musicaNo, (b) => b.texto.setText(Sonido.alternarMusica() ? TXT.musicaSi : TXT.musicaNo)],
        ];
        const botones = items.map(([t, f], i) => {
            const b = crearBoton(this, ANCHO / 2, 300 + i * 66, 340, 54, t, (bb) => f(bb), { tam: i < 3 ? 26 : 22, prof: 30 });
            b.setAlpha(0);
            this.tweens.add({ targets: b, alpha: 1, duration: 300, delay: 350 + i * 60 });
            return b;
        });
        this.sub.push(...botones);
        this.sub.push(this.add.text(ANCHO / 2, 702, TXT.creditos, estiloTexto(13, '#e8ffd0', { strokeThickness: 2 })).setOrigin(0.5).setDepth(20));
        this.nav = navegacion(this, botones);
    }

    jugar(datos) {
        this.limpiar();
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Juego', datos));
    }

    niveles() {
        this.limpiar();
        this.decorativa.setVisible(false);
        this.titulo(TXT.aventura, 56);
        const d = Progreso.datos;
        const tarjetas = [];
        for (let m = 0; m < 3; m++) {
            const y = 112 + m * 162;
            const etiqueta = this.add.text(70, y, TXT.mundos[m], estiloTexto(22, ['#bdf28a', '#ffd9a0', '#c9b8ff'][m])).setOrigin(0, 0.5).setDepth(20);
            this.sub.push(etiqueta);
            for (let j = 0; j < 3; j++) {
                const i = m * 3 + j;
                tarjetas.push(this.tarjetaNivel(i, 250 + j * 390, y + 76, i + 1 > d.desbloqueado));
            }
        }
        const volver = crearBoton(this, ANCHO / 2, 676, 240, 50, TXT.volver, () => this.principal(), { prof: 30 });
        this.sub.push(...tarjetas, volver);
        this.nav = navegacion(this, [...tarjetas, volver], { columnas: 3, inicial: Math.min(d.desbloqueado, NIVELES.length) - 1 });
        this.tecla('keydown-ESC', () => this.principal());
    }

    tarjetaNivel(i, x, y, bloqueado) {
        const W = 360, H = 112;
        const fondo = this.add.nineslice(0, 0, 'panel', 0, W, H, 18, 18, 18, 18);
        const colorMundo = [0x71bb50, 0xe3c480, 0x3a2f6a][NIVELES[i].mundo];
        const muestra = this.add.rectangle(-W / 2 + 62, 0, 84, 84, colorMundo).setStrokeStyle(3, [0xa8e070, 0xffe0a0, 0x8f7dff][NIVELES[i].mundo]);
        const num = this.add.text(-W / 2 + 62, 0, String(i + 1), estiloTexto(40, CREMA, { fontStyle: '700' })).setOrigin(0.5);
        const nombre = this.add.text(-W / 2 + 128, -24, TXT.niveles[i], estiloTexto(22, ORO)).setOrigin(0, 0.5);
        const objs = [fondo, muestra, num, nombre];
        const e = Progreso.datos.estrellas[i];
        for (let s = 0; s < 3; s++) objs.push(this.add.image(-W / 2 + 146 + s * 40, 18, s < e ? 'estrella' : 'estrella_vacia').setScale(0.5));
        if (Progreso.datos.puntos[i]) objs.push(this.add.text(W / 2 - 18, 18, String(Progreso.datos.puntos[i]), estiloTexto(16, '#d8f0c0')).setOrigin(1, 0.5));
        if (bloqueado) {
            objs.push(this.add.rectangle(0, 0, W - 6, H - 6, 0x000000, 0.55));
            objs.push(this.add.image(-W / 2 + 62, 0, 'candado').setScale(0.9));
        }
        const brillo = this.add.nineslice(0, 0, 'boton_oro', 0, W + 12, H + 12, 22, 22, 22, 22).setAlpha(0.9).setVisible(false);
        const c = this.add.container(x, y, [brillo, ...objs]).setSize(W, H).setDepth(20);
        c.setInteractive({ useHandCursor: true });
        c.resaltar = (si) => { brillo.setVisible(si); c.setScale(si ? 1.03 : 1); };
        c.pulsar = () => {
            Sonido.iniciar();
            if (bloqueado) {
                Sonido.sfx('error');
                this.tweens.add({ targets: c, x: x + 8, duration: 50, yoyo: true, repeat: 3 });
                return;
            }
            Sonido.sfx('elegir');
            this.jugar({ nivel: i });
        };
        c.on('pointerdown', c.pulsar);
        return c;
    }

    controles() {
        this.limpiar();
        this.decorativa.setVisible(false);
        this.titulo(TXT.controles, 90);
        this.sub.push(this.add.nineslice(ANCHO / 2, 330, 'panel', 0, 820, 300, 18, 18, 18, 18).setDepth(15));
        TXT.listaControles.forEach(([tecla, accion], i) => {
            const y = 236 + i * 62;
            this.sub.push(this.add.text(ANCHO / 2 - 30, y, tecla, estiloTexto(24, ORO)).setOrigin(1, 0.5).setDepth(20));
            this.sub.push(this.add.text(ANCHO / 2 + 10, y, accion, estiloTexto(22, CREMA)).setOrigin(0, 0.5).setDepth(20));
        });
        const volver = crearBoton(this, ANCHO / 2, 560, 240, 54, TXT.volver, () => this.principal(), { prof: 30 });
        this.sub.push(volver);
        this.nav = navegacion(this, [volver]);
        this.tecla('keydown-ESC', () => this.principal());
    }
}

/* ===================================================================== */
class Pausa extends Phaser.Scene {
    constructor() { super('Pausa'); }

    create() {
        this.add.rectangle(0, 0, ANCHO, ALTO, 0x000000, 0.6).setOrigin(0).setInteractive();
        this.add.nineslice(ANCHO / 2, ALTO / 2, 'panel', 0, 440, 470, 18, 18, 18, 18);
        this.add.text(ANCHO / 2, ALTO / 2 - 180, TXT.pausa, estiloTexto(48, ORO, { fontStyle: '700' })).setOrigin(0.5);
        const juego = this.scene.get('Juego');
        const items = [
            [TXT.reanudar, () => this.reanudar()],
            [TXT.reiniciar, () => { this.scene.stop(); juego.scene.restart(); }],
            [Sonido.activo ? TXT.sonidoSi : TXT.sonidoNo, (b) => b.texto.setText(Sonido.alternar() ? TXT.sonidoSi : TXT.sonidoNo)],
            [Sonido.musicaActiva ? TXT.musicaSi : TXT.musicaNo, (b) => b.texto.setText(Sonido.alternarMusica() ? TXT.musicaSi : TXT.musicaNo)],
            [TXT.salir, () => { this.scene.stop('Juego'); this.scene.start('Menu', { pantalla: juego.clasico ? 'principal' : 'niveles' }); }],
        ];
        const botones = items.map(([t, f], i) => crearBoton(this, ANCHO / 2, ALTO / 2 - 96 + i * 68, 320, 54, t, (b) => f(b), { tam: 24 }));
        this.nav = navegacion(this, botones);
        for (const t of ['ESC', 'P']) this.input.keyboard.on('keydown-' + t, () => this.reanudar());
    }

    reanudar() {
        this.scene.stop();
        this.scene.resume('Juego');
    }
}

/* ===================================================================== */
class Final extends Phaser.Scene {
    constructor() { super('Final'); }

    create() {
        this.cameras.main.fadeIn(600, 0, 0, 0);
        this.add.image(0, 0, 'escenario_2').setOrigin(0);
        this.add.rectangle(0, 0, ANCHO, ALTO, 0x000000, 0.25).setOrigin(0);
        serpienteDecorativa(this, { x: ANCHO / 2, y: 470 }, 460, 150, 40, COLORES_SERPIENTE.jugador, 3);
        const corona = this.add.image(ANCHO / 2, 70, 'corona').setScale(3).setDepth(20);
        this.tweens.add({ targets: corona, y: 80, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.add.text(ANCHO / 2, 170, TXT.finalTitulo, estiloTexto(52, ORO, { fontStyle: '700' })).setOrigin(0.5).setDepth(20);
        this.add.text(ANCHO / 2, 232, TXT.finalTexto, estiloTexto(24, CREMA)).setOrigin(0.5).setDepth(20);
        const d = Progreso.datos;
        d.final = true;
        Progreso.guardar();
        const total = d.estrellas.reduce((a, b) => a + b, 0);
        const puntos = d.puntos.reduce((a, b) => a + b, 0);
        this.add.text(ANCHO / 2, 290, `${TXT.totalEstrellas}: ${total}/27   ·   ${TXT.puntos}: ${puntos}`, estiloTexto(26, '#e8ffd0')).setOrigin(0.5).setDepth(20);
        this.add.text(ANCHO / 2, 340, TXT.gracias, estiloTexto(22, '#bdf28a')).setOrigin(0.5).setDepth(20);
        lluviaConfeti(this, 200, 30);
        this.time.addEvent({ delay: 3500, loop: true, callback: () => lluviaConfeti(this, 60, 30) });
        Sonido.musica('final');
        Sonido.sfx('nivel');
        const boton = crearBoton(this, ANCHO / 2, 650, 260, 56, TXT.menu, () => this.scene.start('Menu', { pantalla: 'niveles' }), { prof: 40 });
        this.nav = navegacion(this, [boton]);
    }
}
