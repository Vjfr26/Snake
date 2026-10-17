/* La partida: un nivel de la aventura o el modo clásico. La lógica avanza por pasos de casilla
   y el dibujo interpola entre pasos para que la serpiente se deslice suave. Hay túneles en los
   huecos del borde, portales, rocas que ruedan, un ratón que huye, burbujas de poder, una
   serpiente rival con su propia IA y niveles a oscuras. */

const DIRS = { der: [1, 0], izq: [-1, 0], arr: [0, -1], aba: [0, 1] };
const OPUESTA = { der: 'izq', izq: 'der', arr: 'aba', aba: 'arr' };
const TIPOS_PODER = ['reloj', 'fantasma', 'tijeras', 'iman'];
const DURACION_PODER = { reloj: 6000, fantasma: 6000, iman: 8000 };
const k = (x, y) => y * COLS + x;
const cx = (x) => X0 + x * CELDA + CELDA / 2;
const cy = (y) => Y0 + y * CELDA + CELDA / 2;

const COLORES_SERPIENTE = {
    jugador: { borde: 0x1d4a14, cuerpo: 0x5ccf3e, raya: 0xc9f26a, brillo: 0xeaffc8, cabeza: 0x6be04a },
    rival: { borde: 0x3a1450, cuerpo: 0xa45ad6, raya: 0xe0a8ff, brillo: 0xf6e6ff, cabeza: 0xb76ae8 },
    rey: { borde: 0x4a0d14, cuerpo: 0xd1394a, raya: 0xffc04a, brillo: 0xffe0c0, cabeza: 0xe04a5a },
};

class Juego extends Phaser.Scene {
    constructor() { super('Juego'); }

    init(d) {
        this.clasico = !!(d && d.clasico);
        this.indice = this.clasico ? -1 : (d && d.nivel) || 0;
        const q = new URLSearchParams(location.search);
        this.auto = q.has('auto');
        this.velocidadPrueba = Math.max(1, parseFloat(q.get('vel')) || 1);
    }

    create() {
        // La escena se reutiliza al reiniciar: todo el estado se crea aquí
        this.def = this.clasico
            ? { mundo: 0, meta: Infinity, intervalo: 150, raton: true, poderes: true, pistas: ['mover'], mapa: MAPA_CLASICO, estrellas: [0, 0], par: 0 }
            : NIVELES[this.indice];
        const d = this.def;
        this.mundo = d.mundo;
        Object.assign(this, {
            estado: 'listo', acc: 0, pasos: 0, comidas: 0, puntos: 0, combo: 0, ultimaComida: -99999, mejorCombo: 0,
            doradasComidas: 0, ratones: 0, tiempo: 0, poderes: {}, items: [], raton: null, rival: null, salidaAbierta: false,
            capa: [], nav: null, bultos: [], cuentaSalida: 0, largoFinal: 0, clavePoderes: '',
            oscuridad: null, luz: null, corona: null, pasoRoca: undefined, origen: null, aviso: null, intro: null, imgSalida: null,
        });
        this.cameras.main.fadeIn(350, 0, 0, 0);
        this.add.image(0, 0, 'escenario_' + this.mundo).setOrigin(0).setDepth(-10);
        this.parsear(d.mapa);
        this.add.image(X0, Y0, Arte.muros(this, d.mapa, this.mundo)).setOrigin(0).setDepth(5);

        // Portales y salida
        this.imgPortales = [];
        const coloresPortal = [0x8a5cff, 0x2fd6c8];
        for (const [clave, dest] of this.portales) {
            const x = clave % COLS, y = Math.floor(clave / COLS);
            const color = coloresPortal[this.parDePortal.get(clave)];
            const img = this.add.image(cx(x), cy(y), 'portal').setTint(color).setDepth(6).setScale(0.72);
            this.tweens.add({ targets: img, angle: 360, duration: 1800, repeat: -1 });
            this.tweens.add({ targets: img, scale: 0.62, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            this.imgPortales.push({ img, x, y, dest });
        }
        if (this.salida) {
            this.imgSalida = this.add.image(cx(this.salida.x), cy(this.salida.y), 'salida_cerrada').setDepth(6).setScale(0.62).setAlpha(0.6);
            this.tweens.add({ targets: this.imgSalida, angle: 360, duration: 6000, repeat: -1 });
        }
        // Rocas
        this.rocas.forEach((r) => { r.img = this.add.image(cx(r.x), cy(r.y), 'roca').setDepth(18); r.px = r.x; r.py = r.y; });

        // Serpientes
        this.gSombra = this.add.graphics().setDepth(14);
        this.gSerpientes = this.add.graphics().setDepth(20);
        this.gOjos = this.add.graphics().setDepth(21);
        const s = this.inicio;
        this.jugador = this.nuevaSerpiente([0, 1, 2, 3].map((i) => ({ x: s.x - i, y: s.y })), 'der', COLORES_SERPIENTE.jugador);
        if (d.rival && this.inicioRival) this.crearRival();

        // Partículas
        this.emChispas = this.add.particles(0, 0, 'chispa', { speed: { min: 60, max: 220 }, scale: { start: 0.8, end: 0 }, lifespan: 600, emitting: false }).setDepth(30);
        this.emHojas = this.add.particles(0, 0, 'hoja', { speed: { min: 40, max: 140 }, rotate: { min: 0, max: 360 }, scale: { start: 1, end: 0.4 }, alpha: { start: 1, end: 0 }, lifespan: 900, gravityY: 160, emitting: false }).setDepth(30);

        // Oscuridad
        if (d.oscuro) {
            this.oscuridad = this.add.renderTexture(X0, Y0, COLS * CELDA, FILAS * CELDA).setOrigin(0).setDepth(40);
            this.luz = this.make.image({ key: 'luz', add: false });
        }

        this.crearHUD();
        this.crearControles();
        this.ponerManzana();
        this.temporizadores();
        this.mostrarIntro();
        Sonido.musica(MUNDOS[this.mundo].musica);
        this.time.timeScale = this.velocidadPrueba;
        this.tweens.timeScale = this.velocidadPrueba;
        const alReanudar = () => this.botonSonido.icono.setTexture(Sonido.activo ? 'ic_sonido' : 'ic_mudo');
        this.events.on('resume', alReanudar);
        this.events.once('shutdown', () => this.events.off('resume', alReanudar));
    }

    /* ------------------------------------------------------------------ mapa */

    parsear(mapa) {
        this.muro = new Uint8Array(COLS * FILAS);
        this.portales = new Map();
        this.parDePortal = new Map();
        this.rocas = [];
        this.salida = null;
        this.inicioRival = null;
        const pares = {};
        for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) {
            const ch = mapa[y][x];
            if (MUROS.has(ch)) this.muro[k(x, y)] = 1;
            else if (ch === 'S') this.inicio = { x, y };
            else if (ch === 'X') this.salida = { x, y };
            else if ('ABab'.includes(ch)) pares[ch] = { x, y };
            else if (ch === 'H') this.rocas.push({ x, y, dx: 1, dy: 0 });
            else if (ch === 'V') this.rocas.push({ x, y, dx: 0, dy: 1 });
            else if (ch === 'R') this.inicioRival = { x, y };
        }
        ['A', 'B'].forEach((p, i) => {
            const a = pares[p], b = pares[p.toLowerCase()];
            if (!a || !b) return;
            this.portales.set(k(a.x, a.y), b); this.portales.set(k(b.x, b.y), a);
            this.parDePortal.set(k(a.x, a.y), i); this.parDePortal.set(k(b.x, b.y), i);
        });
        // Por dónde ruedan las rocas: ahí no salen manzanas
        this.pistaRoca = new Set();
        for (const r of this.rocas) {
            for (const s of [-1, 1]) {
                let x = r.x, y = r.y;
                while (!this.muro[k(x, y)]) { this.pistaRoca.add(k(x, y)); x += r.dx * s; y += r.dy * s; if (x < 0 || y < 0 || x >= COLS || y >= FILAS) break; }
            }
        }
        // Casillas alcanzables desde la salida de la serpiente
        this.alcanzable = new Uint8Array(COLS * FILAS);
        const cola = [this.inicio];
        this.alcanzable[k(this.inicio.x, this.inicio.y)] = 1;
        while (cola.length) {
            const c = cola.shift();
            for (const [dx, dy] of Object.values(DIRS)) {
                let n = this.vecina(c.x, c.y, dx, dy);
                if (this.muro[k(n.x, n.y)]) continue;
                const p = this.portales.get(k(n.x, n.y));
                if (p) n = p;
                if (!this.alcanzable[k(n.x, n.y)]) { this.alcanzable[k(n.x, n.y)] = 1; cola.push(n); }
            }
        }
    }

    vecina(x, y, dx, dy) { return { x: (x + dx + COLS) % COLS, y: (y + dy + FILAS) % FILAS }; }

    /* ------------------------------------------------------------------ serpientes */

    nuevaSerpiente(celdas, dir, colores) {
        return { cuerpo: celdas, previo: celdas.map((c) => ({ ...c })), dir, cola: [], crecer: 0, colores, viva: true, alfa: 1, parpadeo: 0, lengua: 0 };
    }

    crearRival() {
        const r = this.def.rival;
        const s = this.inicioRival;
        const celdas = [];
        for (let i = 0; i < r.largo; i++) celdas.push({ x: s.x + i, y: s.y });
        this.rival = this.nuevaSerpiente(celdas, 'izq', r.rey ? COLORES_SERPIENTE.rey : COLORES_SERPIENTE.rival);
        this.rival.rey = !!r.rey;
        this.rival.contador = 0;
        if (r.rey) this.corona = this.add.image(0, 0, 'corona').setDepth(22).setScale(0.9);
    }

    ocupadaPorSerpiente(s, x, y, sinCola = false) {
        if (!s || !s.viva) return false;
        const n = s.cuerpo.length - (sinCola && !s.crecer ? 1 : 0);
        for (let i = 0; i < n; i++) if (s.cuerpo[i].x === x && s.cuerpo[i].y === y) return true;
        return false;
    }

    rocaEn(x, y) { return this.rocas.some((r) => r.x === x && r.y === y); }
    itemEn(x, y) { return this.items.find((it) => it.x === x && it.y === y); }

    /** Casilla libre de todo (para sacar manzanas, mover rocas o el ratón). */
    libre(x, y) {
        const c = k(x, y);
        if (this.muro[c] || this.portales.has(c)) return false;
        if (this.salida && this.salida.x === x && this.salida.y === y) return false;
        if (this.rocaEn(x, y) || this.itemEn(x, y)) return false;
        if (this.raton && this.raton.x === x && this.raton.y === y) return false;
        return !this.ocupadaPorSerpiente(this.jugador, x, y) && !this.ocupadaPorSerpiente(this.rival, x, y);
    }

    casillaAlAzar(lejosDeCabeza = 4) {
        const cab = this.jugador.cuerpo[0];
        const opciones = [];
        for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) {
            const c = k(x, y);
            if (!this.alcanzable[c] || this.pistaRoca.has(c) || !this.libre(x, y)) continue;
            if (Math.abs(x - cab.x) + Math.abs(y - cab.y) < lejosDeCabeza) continue;
            // Que no quede encajonada entre tres muros
            let muros = 0;
            for (const [dx, dy] of Object.values(DIRS)) { const n = this.vecina(x, y, dx, dy); if (this.muro[k(n.x, n.y)]) muros++; }
            if (muros >= 3) continue;
            opciones.push({ x, y });
        }
        return opciones.length ? Phaser.Utils.Array.GetRandom(opciones) : null;
    }

    /* ------------------------------------------------------------------ objetos */

    ponerItem(tipo, dura = 0) {
        const c = this.casillaAlAzar(tipo === 'manzana' ? 4 : 6);
        if (!c) return null;
        const textura = tipo === 'manzana' ? 'manzana' : tipo === 'dorada' ? 'dorada' : 'p_' + tipo;
        const img = this.add.image(cx(c.x), cy(c.y), textura).setDepth(12).setScale(0);
        const escala = tipo === 'manzana' || tipo === 'dorada' ? 0.86 : 0.8;
        this.tweens.add({ targets: img, scale: escala, duration: 300, ease: 'Back.easeOut' });
        this.tweens.add({ targets: img, y: img.y - 3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 300 });
        const it = { tipo, x: c.x, y: c.y, img, hasta: dura ? this.tiempo + dura : 0 };
        this.items.push(it);
        return it;
    }

    ponerManzana() { if (!this.items.some((i) => i.tipo === 'manzana')) this.ponerItem('manzana'); }

    quitarItem(it, comido = true) {
        this.items = this.items.filter((i) => i !== it);
        this.tweens.killTweensOf(it.img);
        if (comido) this.tweens.add({ targets: it.img, scale: 1.4, alpha: 0, duration: 160, onComplete: () => it.img.destroy() });
        else this.tweens.add({ targets: it.img, scale: 0, duration: 220, ease: 'Back.easeIn', onComplete: () => it.img.destroy() });
    }

    temporizadores() {
        const d = this.def;
        this.proximoPoder = d.poderes ? Phaser.Math.Between(9000, 14000) : Infinity;
        this.proximoRaton = d.raton ? Phaser.Math.Between(12000, 18000) : Infinity;
    }

    /* ------------------------------------------------------------------ HUD */

    crearHUD() {
        const nombre = this.clasico ? TXT.clasico : `${this.indice + 1} · ${TXT.niveles[this.indice]}`;
        this.add.text(44, 20, nombre, estiloTexto(22, CREMA)).setOrigin(0, 0.5).setDepth(60);
        if (this.clasico) {
            this.txtProgreso = this.add.text(44, 48, '', estiloTexto(18, ORO)).setOrigin(0, 0.5).setDepth(60);
        } else {
            this.add.image(56, 48, 'manzana').setScale(0.5).setDepth(60);
            this.txtProgreso = this.add.text(74, 48, '', estiloTexto(18, CREMA)).setOrigin(0, 0.5).setDepth(60);
            this.add.rectangle(140, 48, 150, 10, 0x000000, 0.45).setOrigin(0, 0.5).setDepth(60);
            this.barraProgreso = this.add.rectangle(140, 48, 0, 10, 0xff5a4a).setOrigin(0, 0.5).setDepth(61);
        }
        this.add.text(ANCHO / 2, 16, TXT.hud.puntos, estiloTexto(14, '#d8f0c0', { strokeThickness: 3 })).setOrigin(0.5).setDepth(60);
        this.txtPuntos = this.add.text(ANCHO / 2, 42, '0', estiloTexto(32, ORO)).setOrigin(0.5).setDepth(60);
        this.txtCombo = this.add.text(ANCHO / 2 + 120, 40, '', estiloTexto(26, '#ff9f43')).setOrigin(0.5).setDepth(60);
        this.txtTiempo = this.add.text(ANCHO / 2 - 150, 40, '0:00', estiloTexto(20, CREMA)).setOrigin(0.5).setDepth(60);
        this.iconosPoder = this.add.container(980, 38).setDepth(60);
        this.botonSonido = crearBotonIcono(this, 1176, 36, Sonido.activo ? 'ic_sonido' : 'ic_mudo', (b) => b.icono.setTexture(Sonido.alternar() ? 'ic_sonido' : 'ic_mudo'));
        crearBotonIcono(this, 1232, 36, 'ic_pausa', () => this.pausar());
        this.actualizarHUD();
    }

    actualizarHUD() {
        if (this.clasico) {
            this.txtProgreso.setText(`${TXT.hud.record} ${Math.max(Progreso.datos.record, this.puntos)}  ·  ${TXT.largo} ${this.jugador.cuerpo.length}`);
        } else {
            const meta = this.def.meta;
            this.txtProgreso.setText(`${Math.min(this.comidas, meta)}/${meta}`);
            this.barraProgreso.width = 150 * Math.min(1, this.comidas / meta);
        }
        this.txtPuntos.setText(String(this.puntos));
        this.txtCombo.setText(this.combo > 1 ? `x${this.combo}` : '');
    }

    pintarPoderes() {
        const clave = Object.entries(this.poderes).map(([t, h]) => t + Math.ceil((h - this.tiempo) / 1000)).join();
        if (clave === this.clavePoderes) return;
        this.clavePoderes = clave;
        this.iconosPoder.removeAll(true);
        let i = 0;
        for (const [tipo, hasta] of Object.entries(this.poderes)) {
            const resto = Math.max(0, (hasta - this.tiempo) / 1000);
            const x = i * 62;
            this.iconosPoder.add(this.add.image(x, 0, 'p_' + tipo).setScale(0.72));
            this.iconosPoder.add(this.add.text(x + 20, 14, String(Math.ceil(resto)), estiloTexto(16, CREMA)).setOrigin(0.5));
            i++;
        }
    }

    /* ------------------------------------------------------------------ controles */

    crearControles() {
        const tk = this.input.keyboard;
        const girar = (dir) => () => this.girar(dir);
        for (const [teclas, dir] of [[['RIGHT', 'D'], 'der'], [['LEFT', 'A'], 'izq'], [['UP', 'W'], 'arr'], [['DOWN', 'S'], 'aba']]) {
            for (const t of teclas) tk.on('keydown-' + t, girar(dir));
        }
        tk.on('keydown', () => Sonido.iniciar());
        for (const t of ['SPACE', 'P', 'ESC']) tk.on('keydown-' + t, () => this.pausar());
        tk.on('keydown-M', () => this.botonSonido.icono.setTexture(Sonido.alternar() ? 'ic_sonido' : 'ic_mudo'));
        tk.on('keydown-ENTER', () => { if (this.nav) return; if (this.estado === 'listo') this.empezar(); });
        // Deslizar el dedo (sin levantarlo se pueden encadenar giros)
        this.input.on('pointerdown', (p) => { Sonido.iniciar(); this.origen = { x: p.x, y: p.y }; });
        this.input.on('pointermove', (p) => {
            if (!this.origen || !p.isDown) return;
            const dx = p.x - this.origen.x, dy = p.y - this.origen.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
            this.girar(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'der' : 'izq') : (dy > 0 ? 'aba' : 'arr'));
            this.origen = { x: p.x, y: p.y };
        });
        this.input.on('pointerup', () => { this.origen = null; });
    }

    girar(dir) {
        if (this.nav) return;
        const s = this.jugador;
        if (this.estado === 'listo') {
            if (dir === OPUESTA[s.dir]) return;
            s.cola = [dir];
            this.empezar();
            return;
        }
        if (this.estado !== 'jugando') return;
        const ultima = s.cola.length ? s.cola[s.cola.length - 1] : s.dir;
        if (dir !== ultima && dir !== OPUESTA[ultima] && s.cola.length < 2) s.cola.push(dir);
    }

    pausar() {
        if (this.nav || this.estado === 'muerto' || this.estado === 'fin') return;
        this.scene.launch('Pausa', { desde: 'Juego' });
        this.scene.pause();
    }

    /* ------------------------------------------------------------------ inicio */

    mostrarIntro() {
        const objs = [];
        const panel = this.add.nineslice(ANCHO / 2, ALTO / 2 + 10, 'panel', 0, 700, 250, 18, 18, 18, 18).setDepth(70);
        objs.push(panel);
        const titulo = this.clasico ? TXT.clasico : `${TXT.nivel(this.indice + 1)} · ${TXT.niveles[this.indice]}`;
        objs.push(this.add.text(ANCHO / 2, ALTO / 2 - 72, titulo, estiloTexto(38, ORO, { fontStyle: '700' })).setOrigin(0.5).setDepth(71));
        const lineas = [];
        if (!this.clasico) lineas.push(TXT.pistas.meta(this.def.meta));
        for (const p of this.def.pistas) if (p !== 'meta') lineas.push(TXT.pistas[p]);
        lineas.slice(0, 3).forEach((l, i) => objs.push(this.add.text(ANCHO / 2, ALTO / 2 - 18 + i * 34, l, estiloTexto(20, CREMA, { align: 'center', wordWrap: { width: 640 } })).setOrigin(0.5).setDepth(71)));
        const pulsa = this.add.text(ANCHO / 2, ALTO / 2 + 104, TXT.pulsa, estiloTexto(20, '#bdf28a')).setOrigin(0.5).setDepth(71);
        this.tweens.add({ targets: pulsa, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
        objs.push(pulsa);
        objs.forEach((o) => { o.setAlpha(0); this.tweens.add({ targets: o, alpha: 1, duration: 300 }); });
        this.intro = objs;
        if (this.auto) this.time.delayedCall(600, () => this.empezar());
    }

    empezar() {
        if (this.estado !== 'listo') return;
        this.estado = 'jugando';
        Sonido.iniciar();
        if (this.intro) {
            const objs = this.intro;
            this.intro = null;
            this.tweens.add({ targets: objs, alpha: 0, duration: 250, onComplete: () => objs.forEach((o) => o.destroy()) });
        }
    }

    /* ------------------------------------------------------------------ bucle */

    intervalo() {
        const base = this.def.intervalo;
        const minimo = this.clasico ? 72 : base * 0.72;
        return Math.max(minimo, base - (this.clasico ? 3 : 2.5) * this.comidas);
    }

    update(t, dt) {
        const seg = Math.min(dt, 60);
        if (this.estado === 'jugando' || this.estado === 'saliendo') {
            this.tiempo += seg;
            const lento = this.poderes.reloj ? 0.6 : 1;
            this.acc += seg * lento;
            const paso = this.estado === 'saliendo' ? 42 : this.intervalo();
            while (this.acc >= paso && (this.estado === 'jugando' || this.estado === 'saliendo')) {
                this.acc -= paso;
                if (this.estado === 'saliendo') this.pasoSalida(); else this.paso();
            }
            this.revisarTiempos();
            this.txtTiempo.setText(formatoTiempo(this.tiempo / 1000));
        }
        const paso = this.estado === 'saliendo' ? 42 : this.intervalo();
        const f = this.estado === 'jugando' || this.estado === 'saliendo' ? Math.min(1, this.acc / paso) : 1;
        this.dibujar(f);
    }

    revisarTiempos() {
        // Poderes que se acaban
        let cambio = false;
        for (const [tipo, hasta] of Object.entries(this.poderes)) {
            if (this.tiempo >= hasta) { delete this.poderes[tipo]; cambio = true; }
        }
        if (cambio || Object.keys(this.poderes).length) this.pintarPoderes();
        // Objetos con caducidad (parpadean al final)
        for (const it of [...this.items]) {
            if (!it.hasta) continue;
            const resto = it.hasta - this.tiempo;
            if (resto <= 0) this.quitarItem(it, false);
            else if (resto < 2000) it.img.setAlpha(Math.floor(this.tiempo / 120) % 2 ? 0.35 : 1);
        }
        if (this.def.poderes && this.tiempo >= this.proximoPoder) {
            this.proximoPoder = this.tiempo + Phaser.Math.Between(15000, 21000);
            if (!this.items.some((i) => TIPOS_PODER.includes(i.tipo))) this.ponerItem(Phaser.Utils.Array.GetRandom(TIPOS_PODER), 10000);
        }
        if (this.def.raton && this.tiempo >= this.proximoRaton) {
            this.proximoRaton = this.tiempo + Phaser.Math.Between(18000, 26000);
            if (!this.raton) this.soltarRaton();
        }
        if (this.raton && this.tiempo >= this.raton.hasta) this.ratonEscapa();
        if (this.rival && !this.rival.viva && this.tiempo >= this.rival.vuelve) this.revivirRival();
    }

    /** Un paso de toda la lógica: tu serpiente, la rival, las rocas, el ratón y el imán. */
    paso() {
        this.pasos++;
        const s = this.jugador;
        if (this.auto) this.pilotoAutomatico();
        if (s.cola.length) s.dir = s.cola.shift();
        const [dx, dy] = DIRS[s.dir];
        const cab = s.cuerpo[0];
        let sig = this.vecina(cab.x, cab.y, dx, dy);
        let porPortal = false;
        const destino = this.portales.get(k(sig.x, sig.y));
        if (destino) { sig = { ...destino }; porPortal = true; }

        // ¿Choca?
        if (this.muro[k(sig.x, sig.y)] || this.rocaEn(sig.x, sig.y)
            || (!this.poderes.fantasma && this.ocupadaPorSerpiente(s, sig.x, sig.y, true))
            || this.ocupadaPorSerpiente(this.rival, sig.x, sig.y)) {
            this.morir();
            return;
        }
        this.avanzar(s, sig);
        if (porPortal) { Sonido.sfx('portal'); this.emChispas.setParticleTint(0xb38cff); this.emChispas.explode(14, cx(sig.x), cy(sig.y)); }

        if (this.salidaAbierta && sig.x === this.salida.x && sig.y === this.salida.y) {
            this.estado = 'saliendo';
            this.acc = 0;
            this.cuentaSalida = 0;
            return;
        }
        // Comer
        const it = this.itemEn(sig.x, sig.y);
        if (it) this.comerItem(it);
        if (this.raton && this.raton.x === sig.x && this.raton.y === sig.y) this.comerRaton();

        if (this.rival) this.pasoRival();
        if (this.rocas.length && this.pasos % 2 === 0) this.moverRocas();
        if (this.raton && this.pasos % 2 === 0) this.moverRaton();
        if (this.poderes.iman && this.pasos % 2 === 0) this.atraerManzanas();
        // La lengua sale de vez en cuando
        if (Math.random() < 0.06) s.lengua = 1;
    }

    avanzar(s, sig) {
        const viejo = s.cuerpo;
        s.cuerpo = [sig, ...viejo];
        if (s.crecer > 0) s.crecer--; else s.cuerpo.pop();
        s.previo = s.cuerpo.map((c, i) => ({ ...viejo[Math.min(i, viejo.length - 1)] }));
    }

    pasoSalida() {
        const s = this.jugador;
        if (s.cuerpo.length <= 1) {
            s.cuerpo = [];
            this.completarNivel();
            return;
        }
        const viejo = s.cuerpo;
        s.cuerpo = viejo.slice(0, -1);
        s.previo = viejo.slice(1).map((c) => ({ ...c }));
        Sonido.sfx('entrar', this.cuentaSalida++);
        this.emChispas.setParticleTint(0xffd23f);
        this.emChispas.explode(3, cx(this.salida.x), cy(this.salida.y));
    }

    /* ------------------------------------------------------------------ comer */

    sumar(p, x, y, color = ORO) {
        this.puntos += p;
        this.flotante(x, y, `+${p}`, color);
        this.actualizarHUD();
    }

    flotante(x, y, texto, color = ORO, tam = 22) {
        const t = this.add.text(x, y, texto, estiloTexto(tam, color)).setOrigin(0.5).setDepth(50);
        this.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
    }

    comerItem(it) {
        const s = this.jugador;
        const x = cx(it.x), y = cy(it.y);
        this.quitarItem(it);
        if (it.tipo === 'manzana' || it.tipo === 'dorada') {
            this.combo = this.tiempo - this.ultimaComida < 3500 ? Math.min(5, this.combo + 1) : 1;
            this.ultimaComida = this.tiempo;
            this.mejorCombo = Math.max(this.mejorCombo, this.combo);
            this.comidas++;
            s.crecer += 1;
            this.bultos.push(this.tiempo);
            if (it.tipo === 'dorada') {
                this.doradasComidas++;
                Sonido.sfx('dorada');
                this.sumar(50 * this.combo, x, y - 10, '#ffe066');
                this.emChispas.setParticleTint(0xffd23f);
                this.emChispas.explode(22, x, y);
            } else {
                Sonido.sfx('comer', this.combo);
                this.sumar(10 * this.combo, x, y - 10);
                this.emChispas.setParticleTint(0xff5a4a);
                this.emChispas.explode(10, x, y);
                if (this.mundo === 0) { this.emHojas.setParticleTint(0x7ed957); this.emHojas.explode(3, x, y); }
                this.ponerManzana();
                // A veces aparece una dorada que dura poco
                if (!this.items.some((i) => i.tipo === 'dorada') && Math.random() < 0.2) {
                    const d = this.ponerItem('dorada', 7000);
                    if (d) this.flotante(cx(d.x), cy(d.y) - 30, TXT.dorada, '#ffe066', 18);
                }
            }
            if (this.combo > 1) this.tweens.add({ targets: this.txtCombo, scale: 1.4, duration: 110, yoyo: true });
            if (!this.clasico && !this.salidaAbierta && this.comidas >= this.def.meta) this.abrirSalida();
        } else {
            this.activarPoder(it.tipo, x, y);
        }
        this.actualizarHUD();
    }

    activarPoder(tipo, x, y) {
        Sonido.sfx(tipo === 'tijeras' ? 'tijeras' : 'poder');
        this.emChispas.setParticleTint(0x9fe8ff);
        this.emChispas.explode(18, x, y);
        const [nombre, desc] = TXT.poderes[tipo];
        this.flotante(x, y - 20, nombre, '#9fe8ff', 22);
        this.mostrarAviso(`${nombre}: ${desc}`);
        this.sumar(20, x, y + 10, '#9fe8ff');
        if (tipo === 'tijeras') {
            const s = this.jugador;
            const quitar = Math.min(5, s.cuerpo.length - 3);
            for (let i = 0; i < quitar; i++) {
                const c = s.cuerpo.pop();
                s.previo.pop();
                this.emHojas.setParticleTint(s.colores.cuerpo);
                this.emHojas.explode(4, cx(c.x), cy(c.y));
            }
            return;
        }
        this.poderes[tipo] = this.tiempo + DURACION_PODER[tipo];
        this.pintarPoderes();
    }

    mostrarAviso(texto) {
        if (this.aviso) this.aviso.destroy();
        const t = this.add.text(ANCHO / 2, Y0 + 26, texto, estiloTexto(22, CREMA)).setOrigin(0.5).setDepth(65).setAlpha(0);
        this.aviso = t;
        this.tweens.add({ targets: t, alpha: 1, duration: 200 });
        this.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 400, onComplete: () => { t.destroy(); if (this.aviso === t) this.aviso = null; } });
    }

    abrirSalida() {
        this.salidaAbierta = true;
        Sonido.sfx('salida');
        this.imgSalida.setTexture('salida').setAlpha(1);
        this.tweens.add({ targets: this.imgSalida, scale: { from: 1.3, to: 0.72 }, duration: 500, ease: 'Back.easeOut' });
        this.tweens.add({ targets: this.imgSalida, scale: 0.8, duration: 600, yoyo: true, repeat: -1, delay: 500, ease: 'Sine.easeInOut' });
        this.emChispas.setParticleTint(0xffd23f);
        this.emChispas.explode(30, cx(this.salida.x), cy(this.salida.y));
        grito(this, TXT.salidaAbierta, { tam: 46, y: Y0 + 90, dura: 1400 });
    }

    /* ------------------------------------------------------------------ ratón */

    soltarRaton() {
        const c = this.casillaAlAzar(7);
        if (!c) return;
        const img = this.add.sprite(cx(c.x), cy(c.y), 'raton', 0).setDepth(16).setScale(0);
        this.tweens.add({ targets: img, scale: 0.85, duration: 250, ease: 'Back.easeOut' });
        this.raton = { x: c.x, y: c.y, px: c.x, py: c.y, img, hasta: this.tiempo + 12000, paso: 0 };
    }

    moverRaton() {
        const r = this.raton;
        const cab = this.jugador.cuerpo[0];
        r.px = r.x; r.py = r.y;
        let mejor = null, mejorD = -1;
        for (const [nombre, [dx, dy]] of Object.entries(DIRS)) {
            const nx = r.x + dx, ny = r.y + dy;
            if (nx < 0 || ny < 0 || nx >= COLS || ny >= FILAS || !this.libre(nx, ny) || this.pistaRoca.has(k(nx, ny))) continue;
            const d = Math.abs(nx - cab.x) + Math.abs(ny - cab.y) + Math.random() * 1.5;
            if (d > mejorD) { mejorD = d; mejor = { x: nx, y: ny, dx, dy }; }
        }
        if (mejor) {
            r.x = mejor.x; r.y = mejor.y;
            r.img.setAngle(Math.atan2(mejor.dy, mejor.dx) * 180 / Math.PI);
            r.img.setFrame((r.paso++) % 2);
        }
    }

    comerRaton() {
        const r = this.raton;
        this.raton = null;
        Sonido.sfx('raton');
        this.ratones++;
        this.jugador.crecer += 2;
        this.bultos.push(this.tiempo);
        this.sumar(100, cx(r.x), cy(r.y) - 10, '#ffb3c6');
        this.flotante(cx(r.x), cy(r.y) - 40, TXT.ratonAtrapado, '#ffb3c6', 20);
        this.emChispas.setParticleTint(0xffb3c6);
        this.emChispas.explode(16, cx(r.x), cy(r.y));
        r.img.destroy();
    }

    ratonEscapa() {
        const r = this.raton;
        this.raton = null;
        this.tweens.add({ targets: r.img, scale: 0, angle: r.img.angle + 360, duration: 300, onComplete: () => r.img.destroy() });
    }

    /* ------------------------------------------------------------------ rocas e imán */

    moverRocas() {
        for (const r of this.rocas) {
            r.px = r.x; r.py = r.y;
            const nx = r.x + r.dx, ny = r.y + r.dy;
            const fuera = nx < 0 || ny < 0 || nx >= COLS || ny >= FILAS;
            if (fuera || !this.libre(nx, ny) || this.ocupadaPorSerpiente(this.jugador, nx, ny) || this.rocaEn(nx, ny)) {
                r.dx = -r.dx; r.dy = -r.dy;
                continue;
            }
            r.x = nx; r.y = ny;
        }
        this.pasoRoca = this.pasos;
    }

    atraerManzanas() {
        const cab = this.jugador.cuerpo[0];
        for (const it of this.items) {
            if (it.tipo !== 'manzana' && it.tipo !== 'dorada') continue;
            const ddx = cab.x - it.x, ddy = cab.y - it.y;
            if (Math.abs(ddx) + Math.abs(ddy) > 7 || Math.abs(ddx) + Math.abs(ddy) <= 1) continue;
            const paso = Math.abs(ddx) > Math.abs(ddy) ? [Math.sign(ddx), 0] : [0, Math.sign(ddy)];
            const nx = it.x + paso[0], ny = it.y + paso[1];
            if (!this.libre(nx, ny)) continue;
            it.x = nx; it.y = ny;
            this.tweens.add({ targets: it.img, x: cx(nx), y: cy(ny), duration: 120 });
        }
    }

    /* ------------------------------------------------------------------ rival */

    /** Camino más corto (BFS) desde la cabeza de una serpiente hasta alguna casilla objetivo. */
    caminoA(s, objetivos, evitarOtra) {
        const inicio = s.cuerpo[0];
        const bloqueada = new Uint8Array(COLS * FILAS);
        const marcar = (serp, sinCola) => { if (!serp || !serp.viva) return; const n = serp.cuerpo.length - (sinCola ? 1 : 0); for (let i = 0; i < n; i++) bloqueada[k(serp.cuerpo[i].x, serp.cuerpo[i].y)] = 1; };
        marcar(s, true);
        marcar(evitarOtra, false);
        for (const r of this.rocas) bloqueada[k(r.x, r.y)] = 1;
        const previo = new Int32Array(COLS * FILAS).fill(-1);
        const primero = new Array(COLS * FILAS);
        const cola = [];
        for (const [nombre, [dx, dy]] of Object.entries(DIRS)) {
            if (nombre === OPUESTA[s.dir]) continue;
            const n = this.vecina(inicio.x, inicio.y, dx, dy);
            const c = k(n.x, n.y);
            if (this.muro[c] || bloqueada[c] || this.portales.has(c) || previo[c] !== -1) continue;
            previo[c] = k(inicio.x, inicio.y); primero[c] = nombre; cola.push(n);
        }
        while (cola.length) {
            const a = cola.shift();
            const ca = k(a.x, a.y);
            if (objetivos.has(ca)) return primero[ca];
            for (const [dx, dy] of Object.values(DIRS)) {
                const n = this.vecina(a.x, a.y, dx, dy);
                const c = k(n.x, n.y);
                if (this.muro[c] || bloqueada[c] || this.portales.has(c) || previo[c] !== -1) continue;
                previo[c] = ca; primero[c] = primero[ca]; cola.push(n);
            }
        }
        return null;
    }

    /** Si no hay camino a una manzana: la dirección que deja más sitio libre. */
    direccionSegura(s, evitarOtra) {
        let mejor = null, mejorSitio = -1;
        const cab = s.cuerpo[0];
        for (const [nombre, [dx, dy]] of Object.entries(DIRS)) {
            if (nombre === OPUESTA[s.dir]) continue;
            const n = this.vecina(cab.x, cab.y, dx, dy);
            if (this.muro[k(n.x, n.y)] || this.portales.has(k(n.x, n.y)) || this.rocaEn(n.x, n.y) || this.ocupadaPorSerpiente(s, n.x, n.y, true) || this.ocupadaPorSerpiente(evitarOtra, n.x, n.y)) continue;
            const sitio = this.sitioLibre(n, s, evitarOtra, 60);
            if (sitio > mejorSitio) { mejorSitio = sitio; mejor = nombre; }
        }
        return mejor;
    }

    sitioLibre(desde, s, otra, tope) {
        const visto = new Set([k(desde.x, desde.y)]);
        const cola = [desde];
        while (cola.length && visto.size < tope) {
            const a = cola.shift();
            for (const [dx, dy] of Object.values(DIRS)) {
                const n = this.vecina(a.x, a.y, dx, dy);
                const c = k(n.x, n.y);
                if (visto.has(c) || this.muro[c] || this.portales.has(c) || this.rocaEn(n.x, n.y) || this.ocupadaPorSerpiente(s, n.x, n.y, true) || this.ocupadaPorSerpiente(otra, n.x, n.y)) continue;
                visto.add(c); cola.push(n);
            }
        }
        return visto.size;
    }

    pasoRival() {
        const r = this.rival;
        if (!r.viva) return;
        r.contador++;
        if (r.contador % this.def.rival.cada === 0) { r.previo = r.cuerpo.map((c) => ({ ...c })); return; }
        const manzanas = new Set(this.items.filter((i) => i.tipo === 'manzana' || i.tipo === 'dorada').map((i) => k(i.x, i.y)));
        let dir = manzanas.size ? this.caminoA(r, manzanas, this.jugador) : null;
        // Que el camino no le deje encerrada
        if (dir) {
            const [dx, dy] = DIRS[dir];
            const n = this.vecina(r.cuerpo[0].x, r.cuerpo[0].y, dx, dy);
            if (this.sitioLibre(n, r, this.jugador, 40) < Math.min(40, r.cuerpo.length + 4)) dir = null;
        }
        if (!dir) dir = this.direccionSegura(r, this.jugador);
        if (!dir) dir = r.dir;
        r.dir = dir;
        const [dx, dy] = DIRS[dir];
        const sig = this.vecina(r.cuerpo[0].x, r.cuerpo[0].y, dx, dy);
        if (this.muro[k(sig.x, sig.y)] || this.rocaEn(sig.x, sig.y) || this.portales.has(k(sig.x, sig.y)) || this.ocupadaPorSerpiente(r, sig.x, sig.y, true)) {
            this.matarRival(false);
            return;
        }
        if (this.ocupadaPorSerpiente(this.jugador, sig.x, sig.y)) {
            this.matarRival(true);
            return;
        }
        this.avanzar(r, sig);
        const it = this.itemEn(sig.x, sig.y);
        if (it && (it.tipo === 'manzana' || it.tipo === 'dorada')) {
            this.quitarItem(it);
            Sonido.sfx('pop', 3);
            if (r.cuerpo.length < (r.rey ? 20 : 14)) r.crecer++;
            this.emChispas.setParticleTint(r.colores.cuerpo);
            this.emChispas.explode(8, cx(sig.x), cy(sig.y));
            if (it.tipo === 'manzana') this.ponerManzana();
        }
        if (Math.random() < 0.05) r.lengua = 1;
    }

    matarRival(porTi) {
        const r = this.rival;
        r.viva = false;
        r.vuelve = this.tiempo + 6000;
        Sonido.sfx('rival');
        r.cuerpo.forEach((c, i) => this.time.delayedCall(i * 35, () => { this.emChispas.setParticleTint(r.colores.cuerpo); this.emChispas.explode(5, cx(c.x), cy(c.y)); }));
        if (porTi) { const c = r.cuerpo[0]; this.sumar(150, cx(c.x), cy(c.y) - 20, '#e0a8ff'); this.mostrarAviso(TXT.rivalEliminado); }
        if (this.corona) this.corona.setVisible(false);
    }

    revivirRival() {
        const s = this.inicioRival;
        const largo = this.def.rival.largo;
        for (let i = 0; i < largo; i++) if (!this.libre(s.x + i, s.y)) { this.rival.vuelve = this.tiempo + 1000; return; }
        this.crearRival();
        this.mostrarAviso(TXT.rivalVuelve);
        this.emChispas.setParticleTint(this.rival.colores.cuerpo);
        this.emChispas.explode(20, cx(s.x), cy(s.y));
    }

    /* ------------------------------------------------------------------ piloto (pruebas) */

    pilotoAutomatico() {
        const s = this.jugador;
        const objetivos = new Set();
        if (this.salidaAbierta) objetivos.add(k(this.salida.x, this.salida.y));
        else for (const it of this.items) if (it.tipo === 'manzana' || it.tipo === 'dorada') objetivos.add(k(it.x, it.y));
        if (this.raton && !this.salidaAbierta) objetivos.add(k(this.raton.x, this.raton.y));
        let dir = objetivos.size ? this.caminoA(s, objetivos, this.rival) : null;
        if (dir) {
            const [dx, dy] = DIRS[dir];
            const n = this.vecina(s.cuerpo[0].x, s.cuerpo[0].y, dx, dy);
            if (!this.salidaAbierta && this.sitioLibre(n, s, this.rival, 40) < Math.min(40, s.cuerpo.length + 4)) dir = null;
        }
        if (!dir) dir = this.direccionSegura(s, this.rival);
        if (dir) s.cola = [dir];
    }

    /* ------------------------------------------------------------------ dibujo */

    puntosDe(s, f) {
        return s.cuerpo.map((c, i) => {
            const p = s.previo[i] || c;
            const salto = Math.abs(p.x - c.x) + Math.abs(p.y - c.y) > 1;
            if (salto) return { x: cx(c.x), y: cy(c.y), salto: true };
            return { x: Phaser.Math.Linear(cx(p.x), cx(c.x), f), y: Phaser.Math.Linear(cy(p.y), cy(c.y), f) };
        });
    }

    dibujar(f) {
        const g = this.gSerpientes, gs = this.gSombra, go = this.gOjos;
        g.clear(); gs.clear(); go.clear();
        if (this.rival && this.rival.viva) this.dibujarSerpiente(this.rival, f);
        this.dibujarSerpiente(this.jugador, f);
        // Rocas y ratón interpolados (se mueven cada dos pasos)
        const fr = this.pasoRoca !== undefined ? Math.min(1, (this.pasos - this.pasoRoca + f) / 2) : 1;
        for (const r of this.rocas) {
            r.img.setPosition(Phaser.Math.Linear(cx(r.px), cx(r.x), fr), Phaser.Math.Linear(cy(r.py), cy(r.y), fr));
            if (r.px !== r.x || r.py !== r.y) r.img.setAngle((r.img.angle + (r.dx + r.dy) * 6) % 360);
        }
        if (this.raton) {
            const fm = Math.min(1, ((this.pasos % 2) + f) / 2);
            this.raton.img.setPosition(Phaser.Math.Linear(cx(this.raton.px), cx(this.raton.x), fm), Phaser.Math.Linear(cy(this.raton.py), cy(this.raton.y), fm));
        }
        if (this.oscuridad) this.dibujarOscuridad();
    }

    dibujarSerpiente(s, f) {
        const g = this.gSerpientes, gs = this.gSombra;
        if (!s.cuerpo.length) return;
        const pts = this.puntosDe(s, f);
        const n = pts.length;
        const C = s.colores;
        const fantasma = s === this.jugador && this.poderes.fantasma;
        const alfa = fantasma ? 0.45 + Math.sin(this.tiempo / 90) * 0.15 : s.alfa;
        const radio = (i) => 15.5 * (1 - 0.38 * (i / Math.max(1, n - 1))) + this.bulto(s, i);
        // Muestras intermedias para que el cuerpo sea un tubo continuo
        const muestras = [];
        for (let i = n - 1; i >= 0; i--) {
            muestras.push({ x: pts[i].x, y: pts[i].y, r: radio(i), i });
            if (i > 0 && !pts[i - 1].salto && !pts[i].salto) {
                for (const t of [0.33, 0.66]) muestras.push({ x: Phaser.Math.Linear(pts[i].x, pts[i - 1].x, t), y: Phaser.Math.Linear(pts[i].y, pts[i - 1].y, t), r: Phaser.Math.Linear(radio(i), radio(i - 1), t), i: i - t });
            }
        }
        const saliendo = s === this.jugador && this.estado === 'saliendo';
        const escalaSalida = (m) => {
            if (!saliendo) return 1;
            const d = Phaser.Math.Distance.Between(m.x, m.y, cx(this.salida.x), cy(this.salida.y));
            return Phaser.Math.Clamp(d / 40, 0.15, 1);
        };
        gs.fillStyle(0x000000, 0.18 * alfa);
        for (const m of muestras) gs.fillCircle(m.x + 3, m.y + 5, m.r * escalaSalida(m));
        g.fillStyle(C.borde, alfa);
        for (const m of muestras) g.fillCircle(m.x, m.y, (m.r + 2.5) * escalaSalida(m));
        for (const m of muestras) {
            const raya = Math.floor(m.i) % 4 === 2;
            g.fillStyle(raya ? C.raya : C.cuerpo, alfa);
            g.fillCircle(m.x, m.y, m.r * escalaSalida(m));
        }
        g.fillStyle(C.brillo, 0.35 * alfa);
        for (const m of muestras) g.fillCircle(m.x - m.r * 0.3, m.y - m.r * 0.35, m.r * 0.32 * escalaSalida(m));
        if (saliendo) return;
        this.dibujarCabeza(s, pts[0], alfa);
    }

    bulto(s, i) {
        if (s !== this.jugador || !this.bultos.length) return 0;
        let extra = 0;
        const iv = this.intervalo();
        this.bultos = this.bultos.filter((t0) => (this.tiempo - t0) / iv < s.cuerpo.length + 2);
        for (const t0 of this.bultos) {
            const pos = (this.tiempo - t0) / iv;
            const d = Math.abs(i - pos);
            if (d < 1.5) extra += 4.5 * (1 - d / 1.5);
        }
        return extra;
    }

    dibujarCabeza(s, p, alfa) {
        const g = this.gOjos;
        const C = s.colores;
        const [dx, dy] = DIRS[s.dir];
        const muerta = s.muerta;
        g.fillStyle(C.borde, alfa); g.fillCircle(p.x, p.y, 19);
        g.fillStyle(C.cabeza, alfa); g.fillCircle(p.x, p.y, 16.5);
        g.fillStyle(C.brillo, 0.35 * alfa); g.fillCircle(p.x - 5, p.y - 6, 5);
        // Lengua
        if (s.lengua > 0 && !muerta) {
            s.lengua -= 0.08;
            const L = 12 + 8 * Math.sin(s.lengua * Math.PI);
            const bx = p.x + dx * 16, by = p.y + dy * 16;
            g.lineStyle(3, 0xe8384a, alfa);
            g.lineBetween(bx, by, bx + dx * L, by + dy * L);
            g.lineBetween(bx + dx * L, by + dy * L, bx + dx * (L + 5) + dy * 4, by + dy * (L + 5) + dx * 4);
            g.lineBetween(bx + dx * L, by + dy * L, bx + dx * (L + 5) - dy * 4, by + dy * (L + 5) - dx * 4);
        }
        // Ojos que miran a la manzana más cercana
        const objetivo = this.items.find((i) => i.tipo === 'manzana');
        let mx = dx, my = dy;
        if (objetivo) {
            const vx = cx(objetivo.x) - p.x, vy = cy(objetivo.y) - p.y;
            const l = Math.hypot(vx, vy) || 1;
            mx = vx / l; my = vy / l;
        }
        s.parpadeo = (s.parpadeo + 1) % 220;
        const cerrados = s.parpadeo > 210;
        for (const lado of [-1, 1]) {
            const ex = p.x + dx * 6 - dy * lado * 8, ey = p.y + dy * 6 + dx * lado * 8;
            if (muerta) {
                g.lineStyle(3, 0x1a1a1a, alfa);
                g.lineBetween(ex - 4, ey - 4, ex + 4, ey + 4); g.lineBetween(ex - 4, ey + 4, ex + 4, ey - 4);
                continue;
            }
            g.fillStyle(0xffffff, alfa); g.fillCircle(ex, ey, cerrados ? 1.5 : 6);
            if (!cerrados) { g.fillStyle(0x111111, alfa); g.fillCircle(ex + mx * 2.4, ey + my * 2.4, 3.2); }
        }
        if (s.rey && this.corona) this.corona.setVisible(true).setPosition(p.x, p.y - 22).setAngle(dx * 8);
    }

    dibujarOscuridad() {
        const rt = this.oscuridad;
        rt.clear();
        rt.fill(0x05030c, 0.95);
        const luz = (x, y, escala) => { this.luz.setPosition(x - X0, y - Y0).setScale(escala); rt.erase(this.luz); };
        const s = this.jugador;
        if (s.cuerpo.length) {
            const p = this.puntosDe(s, Math.min(1, this.acc / this.intervalo()))[0];
            luz(p.x, p.y, this.estado === 'saliendo' ? 1.4 : 1);
        }
        for (const it of this.items) luz(cx(it.x), cy(it.y), 0.26);
        if (this.raton) luz(this.raton.img.x, this.raton.img.y, 0.2);
        if (this.salidaAbierta) luz(cx(this.salida.x), cy(this.salida.y), 0.45);
        for (const p of this.imgPortales) luz(cx(p.x), cy(p.y), 0.22);
        if (this.rival && this.rival.viva) luz(cx(this.rival.cuerpo[0].x), cy(this.rival.cuerpo[0].y), 0.3);
    }

    /* ------------------------------------------------------------------ morir y terminar */

    morir() {
        this.estado = 'muerto';
        const s = this.jugador;
        s.muerta = true;
        this.largoFinal = s.cuerpo.length;
        s.previo = s.cuerpo.map((c) => ({ ...c }));
        Sonido.sfx('choque');
        Sonido.parar();
        this.cameras.main.shake(350, 0.012);
        const destello = this.add.rectangle(0, 0, ANCHO, ALTO, 0xff3b3b, 0.25).setOrigin(0).setDepth(55);
        this.tweens.add({ targets: destello, alpha: 0, duration: 450, onComplete: () => destello.destroy() });
        s.colores = { ...s.colores, cuerpo: 0x8f9a86, raya: 0xb7c2ab, cabeza: 0x9aa690 };
        // La serpiente se deshace desde la cola
        const total = s.cuerpo.length;
        for (let i = 0; i < total; i++) {
            this.time.delayedCall(500 + i * 45, () => {
                const c = s.cuerpo.pop();
                if (!c) return;
                s.previo.pop();
                Sonido.sfx('pop', i);
                this.emHojas.setParticleTint(0x8f9a86);
                this.emHojas.explode(4, cx(c.x), cy(c.y));
            });
        }
        this.time.delayedCall(700 + total * 45, () => this.mostrarFin(false));
    }

    completarNivel() {
        this.estado = 'fin';
        Sonido.parar();
        Sonido.sfx('nivel');
        this.mostrarFin(true);
    }

    capaPanel(alto) {
        const objs = [];
        const velo = this.add.rectangle(0, 0, ANCHO, ALTO, 0x000000, 0.55).setOrigin(0).setDepth(90).setInteractive();
        const panel = this.add.nineslice(ANCHO / 2, ALTO / 2, 'panel', 0, 680, alto, 18, 18, 18, 18).setDepth(91);
        velo.setAlpha(0); this.tweens.add({ targets: velo, alpha: 1, duration: 250 });
        panel.setScale(0.85).setAlpha(0); this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
        objs.push(velo, panel);
        this.capa = objs;
        return { top: ALTO / 2 - alto / 2, add: (o) => { objs.push(o.setDepth(92)); return o; } };
    }

    mostrarFin(gano) {
        const segundos = this.tiempo / 1000;
        const d = this.def;
        let bono = 0, estrellas = 0, nuevoRecord = false;
        if (gano) {
            bono = Math.max(0, Math.round((d.par - segundos) * 10));
            this.puntos += bono;
            this.actualizarHUD();
            estrellas = 1 + (this.puntos >= d.estrellas[0] ? 1 : 0) + (this.puntos >= d.estrellas[1] ? 1 : 0);
            Progreso.completar(this.indice, estrellas, this.puntos);
        }
        if (this.clasico && this.puntos > Progreso.datos.record) { Progreso.datos.record = this.puntos; Progreso.guardar(); nuevoRecord = true; }
        const nFilas = Math.min(this.clasico ? 6 : 5, 3 + (this.clasico ? 1 : 0) + (this.doradasComidas ? 1 : 0) + (this.ratones ? 1 : 0)) + (gano ? 1 : 0);
        const alto = 104 + nFilas * 30 + 14 + (gano ? 120 : 0) + 112;
        const { top, add } = this.capaPanel(alto);
        const titulo = gano ? TXT.nivelSuperado : this.clasico ? TXT.finPartida : TXT.chocaste;
        add(this.add.text(ANCHO / 2, top + 50, titulo, estiloTexto(46, gano ? ORO : ROJO, { fontStyle: '700' })).setOrigin(0.5));
        const filas = [];
        if (this.clasico) filas.push([TXT.largo, String(this.largoFinal)], [TXT.manzanas, String(this.comidas)]);
        else filas.push([TXT.manzanas, `${this.comidas}`]);
        if (this.doradasComidas) filas.push([TXT.doradas, String(this.doradasComidas)]);
        if (this.ratones) filas.push([TXT.ratones, String(this.ratones)]);
        filas.push([TXT.mejorCombo, `x${this.mejorCombo}`], [TXT.tiempo, formatoTiempo(segundos)]);
        if (gano) filas.push([TXT.bonoTiempo, `+${bono}`]);
        const filasMostradas = filas.slice(0, nFilas);
        filasMostradas.forEach(([a, b], i) => {
            const y = top + 104 + i * 30;
            add(this.add.text(ANCHO / 2 - 170, y, a, estiloTexto(20, '#d8f0c0')).setOrigin(0, 0.5));
            add(this.add.text(ANCHO / 2 + 170, y, b, estiloTexto(20, CREMA)).setOrigin(1, 0.5));
        });
        let y = top + 104 + filasMostradas.length * 30 + 14;
        add(this.add.text(ANCHO / 2, y, `${TXT.puntos}: ${this.puntos}`, estiloTexto(30, ORO)).setOrigin(0.5));
        if (nuevoRecord) {
            const r = add(this.add.text(ANCHO / 2 + 200, y - 4, TXT.nuevoRecord, estiloTexto(22, '#ff9f43')).setOrigin(0.5).setAngle(-8));
            this.tweens.add({ targets: r, scale: 1.15, duration: 400, yoyo: true, repeat: -1 });
        }
        if (gano) {
            y += 56;
            const textos = TXT.estrellas(d.estrellas);
            for (let i = 0; i < 3; i++) {
                const ex = ANCHO / 2 - 140 + i * 140;
                add(this.add.image(ex, y, 'estrella_vacia').setScale(0.7));
                add(this.add.text(ex, y + 36, textos[i], estiloTexto(14, i < estrellas ? CREMA : '#9aa690')).setOrigin(0.5));
                if (i < estrellas) {
                    const e = add(this.add.image(ex, y, 'estrella').setScale(0));
                    this.tweens.add({ targets: e, scale: 0.7, angle: 360, duration: 420, delay: 400 + i * 300, ease: 'Back.easeOut', onStart: () => Sonido.sfx('estrella') });
                }
            }
        }
        const ultimo = gano && this.indice === NIVELES.length - 1;
        const opciones = [];
        if (gano && !ultimo) opciones.push([TXT.siguiente, () => this.scene.start('Juego', { nivel: this.indice + 1 })]);
        if (ultimo) opciones.push([TXT.siguiente, () => this.scene.start('Final')]);
        opciones.push([gano ? TXT.reiniciar : TXT.reintentar, () => this.scene.start('Juego', this.clasico ? { clasico: true } : { nivel: this.indice })]);
        opciones.push([this.clasico ? TXT.menu : TXT.nivelesBoton, () => this.scene.start('Menu', { pantalla: this.clasico ? 'principal' : 'niveles' })]);
        const ancho = opciones.length === 3 ? 200 : 240;
        const botones = opciones.map(([t, f], i) => {
            const b = crearBoton(this, ANCHO / 2 + (i - (opciones.length - 1) / 2) * (ancho + 16), top + alto - 46, ancho, 54, t, f, { prof: 93, tam: 22 });
            this.capa.push(b);
            return b;
        });
        this.nav = navegacion(this, botones);
        if (this.auto) this.time.delayedCall(1200, () => { if (gano && !ultimo) botones[0].pulsar(); });
    }
}
