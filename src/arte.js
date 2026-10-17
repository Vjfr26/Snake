/* Todo el arte de Snake se dibuja por código: los fondos de los tres mundos, los muros de cada
   nivel (setos, arenisca, roca, cristal y agua), manzanas, ratón, rocas, portales, la salida,
   las burbujas de poder, partículas, estrellas, botones e iconos. La serpiente se pinta en
   vivo en juego.js. */

const TEMAS_MUNDO = [
    { casilla: ['#7cc65a', '#71bb50'], marco: ['#2f6b2a', '#1b4318'], borde: '#a8e070' },
    { casilla: ['#ecd093', '#e3c480'], marco: ['#9a6a33', '#5e3e1a'], borde: '#ffe0a0' },
    { casilla: ['#2c2350', '#271f48'], marco: ['#15102e', '#0a0718'], borde: '#8f7dff' },
];

const Arte = (() => {
    function lienzo(w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        return [c, c.getContext('2d')];
    }

    function registrar(escena, clave, canvas, fw, fh) {
        if (escena.textures.exists(clave)) escena.textures.remove(clave);
        const tex = escena.textures.addCanvas(clave, canvas);
        if (fw) {
            let i = 0;
            for (let y = 0; y + fh <= canvas.height; y += fh) for (let x = 0; x + fw <= canvas.width; x += fw) tex.add(i++, 0, x, y, fw, fh);
        }
        return tex;
    }

    function redondeado(g, x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
    }

    const azar = (a, b) => a + Math.random() * (b - a);

    /* ---------------- Escenario de cada mundo (marco + tablero) ---------------- */
    function escenario(escena, mundo) {
        const T = TEMAS_MUNDO[mundo];
        const [c, g] = lienzo(ANCHO, ALTO);
        const mg = g.createLinearGradient(0, 0, 0, ALTO);
        mg.addColorStop(0, T.marco[0]); mg.addColorStop(1, T.marco[1]);
        g.fillStyle = mg; g.fillRect(0, 0, ANCHO, ALTO);
        // Adornos del marco
        for (let i = 0; i < 90; i++) {
            const x = azar(0, ANCHO), y = azar(0, ALTO);
            if (mundo === 0) { g.fillStyle = `rgba(255,255,255,${azar(0.03, 0.08)})`; g.beginPath(); g.ellipse(x, y, azar(6, 16), azar(3, 7), azar(0, 3), 0, Math.PI * 2); g.fill(); }
            else if (mundo === 1) { g.fillStyle = `rgba(255,230,180,${azar(0.04, 0.1)})`; g.fillRect(x, y, azar(20, 70), 2); }
            else { g.fillStyle = `rgba(170,150,255,${azar(0.1, 0.5)})`; g.beginPath(); g.arc(x, y, azar(0.6, 1.8), 0, Math.PI * 2); g.fill(); }
        }
        // Tablero
        const W = COLS * CELDA, H = FILAS * CELDA;
        g.save();
        g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 24; g.shadowOffsetY = 6;
        redondeado(g, X0 - 6, Y0 - 6, W + 12, H + 12, 18); g.fillStyle = T.borde; g.fill();
        g.restore();
        g.save();
        redondeado(g, X0, Y0, W, H, 12); g.clip();
        for (let f = 0; f < FILAS; f++) for (let k = 0; k < COLS; k++) {
            g.fillStyle = T.casilla[(f + k) % 2];
            g.fillRect(X0 + k * CELDA, Y0 + f * CELDA, CELDA, CELDA);
        }
        for (let i = 0; i < 160; i++) {
            const x = X0 + azar(0, W), y = Y0 + azar(0, H);
            if (mundo === 0) {
                if (i % 3 === 0) { // florecillas
                    const col = ['#fff7a8', '#ffffff', '#ffb3d1'][i % 3];
                    for (let p = 0; p < 5; p++) { g.fillStyle = col; g.beginPath(); g.arc(x + Math.cos(p * 1.26) * 3, y + Math.sin(p * 1.26) * 3, 2.2, 0, Math.PI * 2); g.fill(); }
                    g.fillStyle = '#f5c23a'; g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill();
                } else { g.strokeStyle = 'rgba(40,100,30,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 6); g.moveTo(x + 2, y); g.lineTo(x + 3, y - 5); g.stroke(); }
            } else if (mundo === 1) {
                if (i % 4 === 0) { g.fillStyle = 'rgba(150,110,60,0.35)'; g.beginPath(); g.ellipse(x, y, azar(2, 4), azar(1.5, 3), 0, 0, Math.PI * 2); g.fill(); }
                else { g.strokeStyle = 'rgba(200,160,90,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, azar(8, 16), Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
            } else {
                g.fillStyle = `rgba(${150 + azar(0, 100)},${130 + azar(0, 80)},255,${azar(0.15, 0.5)})`;
                g.beginPath(); g.arc(x, y, azar(0.8, 2.2), 0, Math.PI * 2); g.fill();
            }
        }
        g.restore();
        registrar(escena, 'escenario_' + mundo, c);
    }

    /* ---------------- Muros de un nivel (se genera al empezarlo) ---------------- */
    const ESTILO_MURO = {
        '#': [
            { base: '#2f7a2c', luz: '#5fb94a', sombra: '#1d4d1b', borde: '#163b15' },   // seto
            { base: '#c98a4b', luz: '#e9b778', sombra: '#8f5a2a', borde: '#6b421c' },   // arenisca
            { base: '#4a3f6e', luz: '#6d5f9c', sombra: '#2e2650', borde: '#1d1735' },   // roca de la cueva
        ],
        '*': { base: '#4fd4ff', luz: '#c6f4ff', sombra: '#2a7fd1', borde: '#1a4f99' },
        '~': { base: '#3fa2e0', luz: '#8fd6ff', sombra: '#2a74b3', borde: '#1d5384' },
    };

    function muros(escena, mapa, mundo) {
        const W = COLS * CELDA, H = FILAS * CELDA;
        const [c, g] = lienzo(W, H);
        const tipo = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= FILAS ? null : MUROS.has(mapa[y][x]) ? mapa[y][x] : null);
        const estilo = (t) => (t === '#' ? ESTILO_MURO['#'][mundo] : ESTILO_MURO[t]);
        // Sombra en el suelo
        g.fillStyle = 'rgba(0,0,0,0.22)';
        for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) if (tipo(x, y)) { redondeado(g, x * CELDA + 4, y * CELDA + 7, CELDA, CELDA, 10); g.fill(); }
        // Bloques unidos con sus vecinos del mismo tipo
        for (const capa of ['borde', 'base']) {
            for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) {
                const t = tipo(x, y);
                if (!t) continue;
                const e = estilo(t);
                g.fillStyle = e[capa];
                const m = capa === 'borde' ? 1 : 3;
                redondeado(g, x * CELDA + m, y * CELDA + m, CELDA - 2 * m, CELDA - 2 * m, capa === 'borde' ? 11 : 9); g.fill();
                if (tipo(x + 1, y) === t) g.fillRect(x * CELDA + CELDA / 2, y * CELDA + m, CELDA, CELDA - 2 * m);
                if (tipo(x, y + 1) === t) g.fillRect(x * CELDA + m, y * CELDA + CELDA / 2, CELDA - 2 * m, CELDA);
                if (tipo(x + 1, y) === t && tipo(x, y + 1) === t && tipo(x + 1, y + 1) === t) g.fillRect(x * CELDA + CELDA / 2, y * CELDA + CELDA / 2, CELDA, CELDA);
            }
        }
        // Detalles de cada casilla
        for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) {
            const t = tipo(x, y);
            if (!t) continue;
            const e = estilo(t);
            const px = x * CELDA, py = y * CELDA;
            if (t === '#' && mundo === 0) {
                for (let i = 0; i < 7; i++) {
                    g.fillStyle = i % 2 ? e.luz : e.sombra;
                    g.beginPath(); g.ellipse(px + azar(8, 32), py + azar(8, 32), azar(4, 7), azar(2.5, 4), azar(0, 3), 0, Math.PI * 2); g.fill();
                }
                if (Math.random() < 0.15) { g.fillStyle = '#ff5d73'; g.beginPath(); g.arc(px + azar(10, 30), py + azar(10, 30), 3, 0, Math.PI * 2); g.fill(); }
            } else if (t === '#' && mundo === 1) {
                g.strokeStyle = e.sombra; g.lineWidth = 2;
                g.beginPath(); g.moveTo(px + 3, py + 20); g.lineTo(px + 37, py + 20);
                const off = (y % 2) * 18;
                g.moveTo(px + 11 + off * 0.6, py + 3); g.lineTo(px + 11 + off * 0.6, py + 20);
                g.moveTo(px + 26 - off * 0.4, py + 20); g.lineTo(px + 26 - off * 0.4, py + 37);
                g.stroke();
                g.fillStyle = e.luz; g.fillRect(px + 4, py + 4, 30, 3);
            } else if (t === '#') {
                g.fillStyle = e.luz;
                g.beginPath(); g.moveTo(px + 8, py + 30); g.lineTo(px + 16, py + 12); g.lineTo(px + 22, py + 26); g.closePath(); g.fill();
                g.fillStyle = e.sombra; g.beginPath(); g.arc(px + 28, py + 14, 4, 0, Math.PI * 2); g.fill();
            } else if (t === '*') {
                for (let i = 0; i < 3; i++) {
                    const cx = px + 10 + i * 10, alto = azar(18, 30);
                    g.fillStyle = i % 2 ? e.luz : '#9fe6ff';
                    g.beginPath(); g.moveTo(cx - 5, py + 36); g.lineTo(cx, py + 36 - alto); g.lineTo(cx + 5, py + 36); g.closePath(); g.fill();
                }
                g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(px + 9, py + 12, 2, 12);
            } else if (t === '~') {
                g.strokeStyle = e.luz; g.lineWidth = 2;
                for (let i = 0; i < 2; i++) { const wy = py + 12 + i * 14; g.beginPath(); g.moveTo(px + 6, wy); g.quadraticCurveTo(px + 13, wy - 4, px + 20, wy); g.quadraticCurveTo(px + 27, wy + 4, px + 34, wy); g.stroke(); }
            }
            // Brillo de arriba
            if (!tipo(x, y - 1)) { g.fillStyle = 'rgba(255,255,255,0.18)'; redondeado(g, px + 5, py + 4, CELDA - 10, 6, 3); g.fill(); }
        }
        registrar(escena, 'muros', c);
        return 'muros';
    }

    /* ---------------- Objetos ---------------- */
    function manzana(g, cx, cy, r, colores) {
        const grad = g.createRadialGradient(cx - r * 0.35, cy - r * 0.3, r * 0.1, cx, cy, r * 1.1);
        grad.addColorStop(0, colores[0]); grad.addColorStop(0.6, colores[1]); grad.addColorStop(1, colores[2]);
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(cx, cy - r * 0.62);
        g.bezierCurveTo(cx + r * 0.5, cy - r * 1.05, cx + r * 1.15, cy - r * 0.55, cx + r * 0.98, cy + r * 0.1);
        g.bezierCurveTo(cx + r * 0.85, cy + r * 0.75, cx + r * 0.4, cy + r * 1.02, cx, cy + r * 0.86);
        g.bezierCurveTo(cx - r * 0.4, cy + r * 1.02, cx - r * 0.85, cy + r * 0.75, cx - r * 0.98, cy + r * 0.1);
        g.bezierCurveTo(cx - r * 1.15, cy - r * 0.55, cx - r * 0.5, cy - r * 1.05, cx, cy - r * 0.62);
        g.fill();
        g.lineWidth = 2; g.strokeStyle = colores[3]; g.stroke();
        g.strokeStyle = '#5a3a1a'; g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(cx, cy - r * 0.55); g.quadraticCurveTo(cx + 2, cy - r * 0.95, cx + 4, cy - r * 1.1); g.stroke();
        g.fillStyle = '#4caf50';
        g.beginPath(); g.ellipse(cx + r * 0.42, cy - r * 0.92, r * 0.36, r * 0.17, -0.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.beginPath(); g.ellipse(cx - r * 0.42, cy - r * 0.18, r * 0.16, r * 0.26, 0.4, 0, Math.PI * 2); g.fill();
    }

    function objetos(escena) {
        let [c, g] = lienzo(48, 48);
        manzana(g, 24, 26, 17, ['#ff8a80', '#e8261f', '#9c0f0f', '#7a0a0a']);
        registrar(escena, 'manzana', c);
        [c, g] = lienzo(48, 48);
        manzana(g, 24, 26, 17, ['#fff6b0', '#ffc928', '#c98a00', '#8a5a00']);
        registrar(escena, 'dorada', c);

        // Ratón visto desde arriba, mirando a la derecha (2 fotogramas: patitas)
        [c, g] = lienzo(96, 48);
        for (let f = 0; f < 2; f++) {
            const ox = f * 48;
            g.strokeStyle = '#d98a9a'; g.lineWidth = 2.5; g.lineCap = 'round';
            g.beginPath(); g.moveTo(ox + 10, 24); g.bezierCurveTo(ox + 2, f ? 18 : 30, ox + 4, f ? 34 : 14, ox + 1, 24); g.stroke();
            g.fillStyle = '#c9c4cf';
            for (const [lx, ly] of [[18, 14], [18, 34], [30, 14], [30, 34]]) { g.beginPath(); g.ellipse(ox + lx + (f ? 2 : -2) * (ly < 24 ? 1 : -1), ly, 3, 2, 0, 0, Math.PI * 2); g.fill(); }
            g.fillStyle = '#9d97a6'; g.beginPath(); g.ellipse(ox + 22, 24, 12, 9, 0, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.ellipse(ox + 34, 24, 8, 6.5, 0, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#f2b8c6';
            for (const s of [-1, 1]) { g.beginPath(); g.arc(ox + 31, 24 + s * 7, 4, 0, Math.PI * 2); g.fill(); }
            g.fillStyle = '#ff8fa8'; g.beginPath(); g.arc(ox + 42, 24, 2, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#1a1a1a'; for (const s of [-1, 1]) { g.beginPath(); g.arc(ox + 37, 24 + s * 3, 1.6, 0, Math.PI * 2); g.fill(); }
        }
        registrar(escena, 'raton', c, 48, 48);

        // Roca rodante
        [c, g] = lienzo(48, 48);
        let rg = g.createRadialGradient(18, 16, 3, 24, 24, 22);
        rg.addColorStop(0, '#d2c7b8'); rg.addColorStop(0.7, '#8f8478'); rg.addColorStop(1, '#5c5249');
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(26, 40, 16, 5, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = rg; g.beginPath(); g.arc(24, 23, 18, 0, Math.PI * 2); g.fill();
        g.lineWidth = 2.5; g.strokeStyle = '#4a4038'; g.stroke();
        g.strokeStyle = 'rgba(60,50,40,0.6)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(14, 20); g.lineTo(22, 26); g.lineTo(20, 34); g.moveTo(28, 12); g.lineTo(32, 20); g.stroke();
        registrar(escena, 'roca', c);

        // Portal: espiral blanca (se tiñe)
        [c, g] = lienzo(64, 64);
        for (let k = 0; k < 3; k++) {
            g.beginPath();
            for (let a = 0; a < Math.PI * 3.2; a += 0.1) { const r = 4 + a * 7.5; g.lineTo(32 + Math.cos(a + k * 2.09) * r * 0.9, 32 + Math.sin(a + k * 2.09) * r * 0.9); }
            g.lineWidth = 4; g.strokeStyle = `rgba(255,255,255,${0.95 - k * 0.2})`; g.stroke();
        }
        g.beginPath(); g.arc(32, 32, 7, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
        registrar(escena, 'portal', c);

        // Salida: agujero con aro dorado
        [c, g] = lienzo(72, 72);
        rg = g.createRadialGradient(36, 36, 2, 36, 36, 30);
        rg.addColorStop(0, '#000'); rg.addColorStop(0.7, '#1a1030'); rg.addColorStop(1, '#3a2a60');
        g.fillStyle = rg; g.beginPath(); g.arc(36, 36, 28, 0, Math.PI * 2); g.fill();
        g.lineWidth = 5; g.strokeStyle = '#ffd23f'; g.stroke();
        g.setLineDash([6, 6]); g.lineWidth = 2; g.strokeStyle = '#fff2b0'; g.beginPath(); g.arc(36, 36, 33, 0, Math.PI * 2); g.stroke();
        registrar(escena, 'salida', c);
        [c, g] = lienzo(72, 72);
        g.beginPath(); g.arc(36, 36, 26, 0, Math.PI * 2); g.lineWidth = 4; g.setLineDash([8, 7]); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke();
        registrar(escena, 'salida_cerrada', c);

        // Burbujas de poder
        const burbuja = (clave, dibujo) => {
            const [cb, gb] = lienzo(52, 52);
            const bg = gb.createRadialGradient(18, 16, 2, 26, 26, 24);
            bg.addColorStop(0, 'rgba(255,255,255,0.95)'); bg.addColorStop(0.5, 'rgba(160,220,255,0.55)'); bg.addColorStop(1, 'rgba(80,140,255,0.75)');
            gb.fillStyle = bg; gb.beginPath(); gb.arc(26, 26, 23, 0, Math.PI * 2); gb.fill();
            gb.lineWidth = 2.5; gb.strokeStyle = '#ffffff'; gb.stroke();
            gb.save(); gb.translate(26, 26); dibujo(gb); gb.restore();
            gb.fillStyle = 'rgba(255,255,255,0.85)'; gb.beginPath(); gb.ellipse(17, 15, 6, 3.5, -0.6, 0, Math.PI * 2); gb.fill();
            registrar(escena, clave, cb);
        };
        burbuja('p_reloj', (gb) => {
            gb.fillStyle = '#fff'; gb.beginPath(); gb.arc(0, 1, 12, 0, Math.PI * 2); gb.fill();
            gb.lineWidth = 3; gb.strokeStyle = '#2a4b8d'; gb.stroke();
            gb.beginPath(); gb.moveTo(0, 1); gb.lineTo(0, -7); gb.moveTo(0, 1); gb.lineTo(6, 4); gb.stroke();
        });
        burbuja('p_fantasma', (gb) => {
            gb.fillStyle = '#f4f0ff';
            gb.beginPath(); gb.arc(0, -3, 11, Math.PI, 0); gb.lineTo(11, 12);
            for (let i = 0; i < 4; i++) gb.lineTo(11 - (i + 0.5) * 5.5, i % 2 ? 12 : 7);
            gb.lineTo(-11, 12); gb.closePath(); gb.fill();
            gb.lineWidth = 2; gb.strokeStyle = '#6b5aa8'; gb.stroke();
            gb.fillStyle = '#2b2235'; gb.beginPath(); gb.arc(-4, -3, 2.2, 0, Math.PI * 2); gb.arc(4, -3, 2.2, 0, Math.PI * 2); gb.fill();
        });
        burbuja('p_tijeras', (gb) => {
            gb.strokeStyle = '#c0c8d8'; gb.lineWidth = 3.5; gb.lineCap = 'round';
            gb.beginPath(); gb.moveTo(-8, 8); gb.lineTo(9, -10); gb.moveTo(8, 8); gb.lineTo(-9, -10); gb.stroke();
            gb.strokeStyle = '#e8484a'; gb.lineWidth = 3;
            for (const s of [-1, 1]) { gb.beginPath(); gb.arc(s * 8, 10, 4.5, 0, Math.PI * 2); gb.stroke(); }
        });
        burbuja('p_iman', (gb) => {
            gb.lineWidth = 7; gb.strokeStyle = '#e8484a'; gb.lineCap = 'butt';
            gb.beginPath(); gb.arc(0, -1, 9, Math.PI, 0); gb.stroke();
            gb.fillStyle = '#e8484a'; gb.fillRect(-12.5, -1, 7, 8); gb.fillRect(5.5, -1, 7, 8);
            gb.fillStyle = '#e6e6ee'; gb.fillRect(-12.5, 7, 7, 5); gb.fillRect(5.5, 7, 7, 5);
        });

        // Corona del Rey Serpiente
        [c, g] = lienzo(36, 26);
        g.fillStyle = '#ffd23f'; g.strokeStyle = '#8a5a00'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(3, 23); g.lineTo(3, 7); g.lineTo(11, 15); g.lineTo(18, 3); g.lineTo(25, 15); g.lineTo(33, 7); g.lineTo(33, 23); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#ff4f6e'; g.beginPath(); g.arc(18, 17, 3, 0, Math.PI * 2); g.fill();
        registrar(escena, 'corona', c);

        // Luz para los niveles a oscuras
        [c, g] = lienzo(420, 420);
        rg = g.createRadialGradient(210, 210, 30, 210, 210, 210);
        rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.55, 'rgba(255,255,255,0.85)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.fillRect(0, 0, 420, 420);
        registrar(escena, 'luz', c);
    }

    function piezas(escena) {
        let [c, g] = lienzo(24, 24);
        let rg = g.createRadialGradient(12, 12, 0, 12, 12, 12);
        rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.4, 'rgba(255,255,255,0.7)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.fillRect(0, 0, 24, 24);
        registrar(escena, 'chispa', c);
        [c, g] = lienzo(16, 10);
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(8, 5, 7, 3.5, 0, 0, Math.PI * 2); g.fill();
        registrar(escena, 'hoja', c);
        [c, g] = lienzo(12, 7);
        g.fillStyle = '#fff'; g.fillRect(0, 0, 12, 7);
        registrar(escena, 'confeti', c);

        const estrella = (clave, relleno, borde) => {
            const [ce, ge] = lienzo(64, 64);
            ge.beginPath();
            for (let i = 0; i < 10; i++) { const r = i % 2 ? 13 : 29, a = -Math.PI / 2 + (i * Math.PI) / 5; ge.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r); }
            ge.closePath(); ge.fillStyle = relleno; ge.fill(); ge.lineJoin = 'round'; ge.lineWidth = 4; ge.strokeStyle = borde; ge.stroke();
            registrar(escena, clave, ce);
        };
        estrella('estrella', '#ffcf3a', '#7a4a08');
        estrella('estrella_vacia', 'rgba(0,0,0,0.35)', 'rgba(255,255,255,0.4)');

        [c, g] = lienzo(48, 56);
        g.beginPath(); g.arc(24, 22, 13, Math.PI, 0); g.lineWidth = 6; g.strokeStyle = '#c9ced8'; g.stroke();
        redondeado(g, 6, 22, 36, 30, 7); g.fillStyle = '#e8b93a'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#7a5a12'; g.stroke();
        g.beginPath(); g.arc(24, 35, 4, 0, Math.PI * 2); g.fillStyle = '#5a400a'; g.fill(); g.fillRect(22, 36, 4, 8);
        registrar(escena, 'candado', c);

        const boton = (clave, grad, borde, base) => {
            const [cb, gb] = lienzo(64, 64);
            redondeado(gb, 2, 6, 60, 56, 18); gb.fillStyle = base; gb.fill();
            redondeado(gb, 2, 2, 60, 55, 18);
            const bg = gb.createLinearGradient(0, 0, 0, 56);
            bg.addColorStop(0, grad[0]); bg.addColorStop(1, grad[1]);
            gb.fillStyle = bg; gb.fill(); gb.lineWidth = 2.5; gb.strokeStyle = borde; gb.stroke();
            registrar(escena, clave, cb);
        };
        boton('boton', ['#fbfff4', '#dff0c8'], '#6f9a4a', '#9cc27a');
        boton('boton_oro', ['#fff0a8', '#ffc83d'], '#8a5a08', '#c98a10');
        [c, g] = lienzo(64, 64);
        redondeado(g, 2, 2, 60, 60, 18); g.fillStyle = 'rgba(16,22,30,0.96)'; g.fill();
        g.lineWidth = 2.5; g.strokeStyle = '#a8e070'; g.stroke();
        registrar(escena, 'panel', c);

        const icono = (clave, dibujar) => { const [ci, gi] = lienzo(48, 48); gi.fillStyle = '#fff'; gi.strokeStyle = '#fff'; gi.lineWidth = 4; gi.lineCap = 'round'; gi.lineJoin = 'round'; dibujar(gi); registrar(escena, clave, ci); };
        const altavoz = (gi) => { gi.beginPath(); gi.moveTo(8, 18); gi.lineTo(16, 18); gi.lineTo(26, 9); gi.lineTo(26, 39); gi.lineTo(16, 30); gi.lineTo(8, 30); gi.closePath(); gi.fill(); };
        icono('ic_sonido', (gi) => { altavoz(gi); gi.beginPath(); gi.arc(26, 24, 8, -0.9, 0.9); gi.stroke(); gi.beginPath(); gi.arc(26, 24, 15, -0.9, 0.9); gi.stroke(); });
        icono('ic_mudo', (gi) => { altavoz(gi); gi.beginPath(); gi.moveTo(32, 17); gi.lineTo(42, 31); gi.moveTo(42, 17); gi.lineTo(32, 31); gi.stroke(); });
        icono('ic_pausa', (gi) => { gi.fillRect(12, 9, 8, 30); gi.fillRect(28, 9, 8, 30); });
    }

    return {
        generar(escena) {
            for (let m = 0; m < 3; m++) escenario(escena, m);
            objetos(escena);
            piezas(escena);
        },
        muros,
    };
})();
