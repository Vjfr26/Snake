/* Sonido de Snake, sintetizado con WebAudio: efectos chiptune y un tema para cada mundo.
   El navegador solo deja sonar audio tras un gesto del jugador (Sonido.iniciar). */
const Sonido = (() => {
    const CLAVE = 'serpiente-sonido';
    let activo = true, musicaActiva = true;
    try {
        activo = localStorage.getItem(CLAVE) !== 'no';
        musicaActiva = localStorage.getItem(CLAVE + '-musica') !== 'no';
    } catch (e) { /* sin almacenamiento */ }

    let ctx = null, maestro = null, busSfx = null, busMusica = null, ruidoBuffer = null, pendiente = null;

    function iniciar() {
        if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        maestro = ctx.createGain(); maestro.gain.value = activo ? 1 : 0; maestro.connect(comp);
        busSfx = ctx.createGain(); busSfx.gain.value = 0.55; busSfx.connect(maestro);
        busMusica = ctx.createGain(); busMusica.gain.value = musicaActiva ? 0.22 : 0; busMusica.connect(maestro);
        ruidoBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = ruidoBuffer.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        if (pendiente) { const p = pendiente; pendiente = null; musica(p); }
    }

    function tono({ tipo = 'square', f0 = 440, f1 = f0, dur = 0.12, vol = 0.2, retardo = 0, bus = busSfx }) {
        if (!ctx) return;
        const t = ctx.currentTime + retardo;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = tipo;
        osc.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g); g.connect(bus);
        osc.start(t); osc.stop(t + dur + 0.02);
    }

    function ruido({ dur = 0.15, vol = 0.25, f0 = 2000, f1 = 300, tipo = 'lowpass', retardo = 0, bus = busSfx }) {
        if (!ctx) return;
        const t = ctx.currentTime + retardo;
        const src = ctx.createBufferSource();
        src.buffer = ruidoBuffer;
        const filtro = ctx.createBiquadFilter();
        filtro.type = tipo;
        filtro.frequency.setValueAtTime(f0, t);
        filtro.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filtro); filtro.connect(g); g.connect(bus);
        src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    }

    const nota = (n) => 440 * Math.pow(2, (n - 69) / 12);

    const EFECTOS = {
        // Cada manzana del combo sube un poco el tono
        comer: (combo = 0) => { const n = 76 + Math.min(combo, 8) * 2; tono({ tipo: 'square', f0: nota(n), f1: nota(n + 12), dur: 0.07, vol: 0.09 }); tono({ tipo: 'triangle', f0: nota(n + 7), dur: 0.09, vol: 0.12, retardo: 0.05 }); },
        dorada: () => [84, 88, 91, 96].forEach((n, i) => tono({ tipo: 'square', f0: nota(n), dur: 0.08, vol: 0.07, retardo: i * 0.05 })),
        raton: () => { tono({ tipo: 'sine', f0: 1800, f1: 2600, dur: 0.08, vol: 0.12 }); tono({ tipo: 'sine', f0: 2200, f1: 3000, dur: 0.08, vol: 0.1, retardo: 0.09 }); },
        poder: () => [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tono({ tipo: 'square', f0: nota(n + 12), dur: 0.1, vol: 0.06, retardo: i * 0.045 })),
        tijeras: () => { ruido({ dur: 0.06, vol: 0.3, f0: 6000, f1: 3000, tipo: 'highpass' }); ruido({ dur: 0.06, vol: 0.3, f0: 6000, f1: 3000, tipo: 'highpass', retardo: 0.1 }); },
        portal: () => { tono({ tipo: 'sine', f0: 300, f1: 1400, dur: 0.22, vol: 0.12 }); ruido({ dur: 0.25, vol: 0.12, f0: 3000, f1: 800, tipo: 'bandpass' }); },
        salida: () => [72, 79, 84, 88].forEach((n, i) => tono({ tipo: 'triangle', f0: nota(n), dur: 0.3, vol: 0.14, retardo: i * 0.08 })),
        choque: () => { ruido({ dur: 0.45, vol: 0.4, f0: 1800, f1: 60 }); tono({ tipo: 'sawtooth', f0: 260, f1: 50, dur: 0.5, vol: 0.16 }); },
        pop: (i = 0) => tono({ tipo: 'sine', f0: 500 + (i % 8) * 60, f1: 180, dur: 0.06, vol: 0.06 }),
        rival: () => { tono({ tipo: 'square', f0: 600, f1: 120, dur: 0.35, vol: 0.12 }); ruido({ dur: 0.3, vol: 0.2, f0: 2500, f1: 200 }); },
        nivel: () => [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => tono({ f0: nota(n), dur: i === 6 ? 0.55 : 0.12, vol: 0.1, retardo: i * 0.11 })),
        entrar: (i = 0) => tono({ tipo: 'triangle', f0: nota(60 + Math.min(i, 24)), dur: 0.05, vol: 0.07 }),
        menu: () => tono({ f0: nota(84), dur: 0.05, vol: 0.06 }),
        elegir: () => { tono({ f0: nota(79), dur: 0.06, vol: 0.08 }); tono({ f0: nota(86), dur: 0.12, vol: 0.08, retardo: 0.06 }); },
        estrella: () => [79, 84, 91].forEach((n, i) => tono({ tipo: 'triangle', f0: nota(n), dur: 0.22, vol: 0.13, retardo: i * 0.05 })),
        error: () => tono({ tipo: 'square', f0: 200, f1: 150, dur: 0.15, vol: 0.06 }),
        cuenta: (ultima) => tono({ tipo: 'square', f0: ultima ? nota(84) : nota(72), dur: ultima ? 0.3 : 0.12, vol: 0.08 }),
    };

    function sfx(nombre, arg) {
        if (!ctx || !activo) return;
        const f = EFECTOS[nombre];
        if (f) f(arg);
    }

    /* ---------- Música chiptune: bajo, arpegio, batería y melodía ---------- */
    const ACORDES = { M: [0, 4, 7, 12], m: [0, 3, 7, 12] };
    const CANCIONES = {
        menu: { bpm: 118, acordes: [[48, 'M'], [45, 'm'], [53, 'M'], [55, 'M']],
            melodia: [72, null, 76, null, 79, null, 76, 79, 81, null, 79, null, 76, null, null, null,
                      77, null, 76, null, 74, null, 72, 74, 76, null, 72, null, 67, null, null, null] },
        jardin: { bpm: 126, acordes: [[48, 'M'], [53, 'M'], [55, 'M'], [48, 'M']],
            melodia: [79, null, 76, 79, null, 84, null, 81, 79, null, 77, 76, 74, null, null, null,
                      76, null, 77, 79, null, 81, null, 79, 77, null, 76, 74, 72, null, null, null] },
        desierto: { bpm: 132, acordes: [[50, 'm'], [50, 'm'], [46, 'M'], [45, 'M']],
            melodia: [74, 75, 78, null, 79, null, 78, 75, 74, null, 72, null, 74, null, null, null,
                      79, 78, 75, null, 74, null, 75, 78, 79, null, 81, null, 82, null, null, null] },
        cristal: { bpm: 138, acordes: [[45, 'm'], [41, 'M'], [43, 'M'], [40, 'M']],
            melodia: [81, null, 84, 88, null, 86, 84, null, 83, null, 84, null, 81, null, null, null,
                      79, null, 83, 86, null, 84, 83, null, 80, null, 81, null, 83, null, null, null] },
        final: { bpm: 108, acordes: [[48, 'M'], [43, 'M'], [45, 'm'], [41, 'M']],
            melodia: [79, null, 84, null, 88, null, 84, null, 83, null, 79, null, 81, null, null, null,
                      84, null, 83, null, 81, null, 79, null, 81, null, null, null, null, null, null, null] },
    };

    let actual = null, temporizador = null, paso = 0, proxima = 0;

    function programar() {
        const c = CANCIONES[actual];
        if (!c || !ctx) return;
        const dur = 60 / c.bpm / 4;
        while (proxima < ctx.currentTime + 0.12) {
            const compas = Math.floor(paso / 16) % c.acordes.length;
            const p = paso % 16;
            const [raiz, tipo] = c.acordes[compas];
            const t0 = proxima - ctx.currentTime;
            if (p % 2 === 0) tono({ tipo: 'triangle', f0: nota(raiz - 12 + (p % 8 === 4 ? 7 : 0)), dur: dur * 1.8, vol: 0.28, retardo: t0, bus: busMusica });
            tono({ tipo: 'square', f0: nota(raiz + 12 + ACORDES[tipo][p % 4]), dur: dur * 0.7, vol: 0.025, retardo: t0, bus: busMusica });
            if (p % 4 === 0) tono({ tipo: 'sine', f0: 150, f1: 45, dur: 0.1, vol: 0.2, retardo: t0, bus: busMusica });
            if (p % 8 === 4) ruido({ dur: 0.08, vol: 0.09, f0: 6000, f1: 2500, tipo: 'highpass', retardo: t0, bus: busMusica });
            if (p % 2 === 1) ruido({ dur: 0.03, vol: 0.03, f0: 9000, f1: 7000, tipo: 'highpass', retardo: t0, bus: busMusica });
            const m = c.melodia[paso % c.melodia.length];
            if (m) tono({ tipo: 'square', f0: nota(m), dur: dur * 1.7, vol: 0.05, retardo: t0, bus: busMusica });
            proxima += dur;
            paso++;
        }
    }

    function musica(nombre) {
        if (!ctx) { pendiente = nombre; return; }
        if (actual === nombre) return;
        parar();
        actual = nombre;
        paso = 0;
        proxima = ctx.currentTime + 0.05;
        temporizador = setInterval(programar, 30);
    }

    function parar() {
        if (temporizador) clearInterval(temporizador);
        temporizador = null;
        actual = null;
    }

    function guardar() {
        try {
            localStorage.setItem(CLAVE, activo ? 'si' : 'no');
            localStorage.setItem(CLAVE + '-musica', musicaActiva ? 'si' : 'no');
        } catch (e) { /* sin almacenamiento */ }
    }

    document.addEventListener('visibilitychange', () => {
        if (!ctx) return;
        if (document.hidden) ctx.suspend(); else ctx.resume();
    });

    return {
        iniciar, sfx, musica, parar,
        alternar() { activo = !activo; guardar(); if (maestro) maestro.gain.setTargetAtTime(activo ? 1 : 0, ctx.currentTime, 0.02); return activo; },
        alternarMusica() { musicaActiva = !musicaActiva; guardar(); if (busMusica) busMusica.gain.setTargetAtTime(musicaActiva ? 0.22 : 0, ctx.currentTime, 0.05); return musicaActiva; },
        get activo() { return activo; },
        get musicaActiva() { return musicaActiva; },
    };
})();
