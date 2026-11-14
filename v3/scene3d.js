/* ==========================================================================
   SCENE3D - "GERBANG CAHAYA" (Gate of Light)
   Pintu gerbang 3D bercorak Islam dengan bintang kunci di tengah.
   Canvas bersaiz tetap 1920x1080 (skala oleh CSS bersama pentas).
   API: init, setTheme, setPhase, progress, pulse, open, reset, setActive
   Jika WebGL gagal, semua fungsi menjadi no-op (halaman terus berfungsi).
   ========================================================================== */
(function () {
    const noop = () => {};
    const api = { ready: false, init: noop, setTheme: noop, setPhase: noop, progress: noop, pulse: noop, open: noop, reset: noop, setActive: noop };
    window.Scene3D = api;
    if (typeof THREE === 'undefined') return;

    const W = 1920, H = 1080;
    const FOV = 40, CAM_Z = 10;
    const OFFSET_Y = -0.45;              // gerbang diturunkan sedikit untuk ruang tajuk
    const DW = 2.2, Y0 = -3.45, YS = -0.5, YT = 2.0; // separuh lebar, bawah, garis lengkung, puncak
    const STAR_Y = 0.35;

    const PAL = {
        light: {
            frames: ['#0c3b2e', '#c9a45a', '#17624a'],
            doorBase: '#e4f2eb', lattice: 'rgba(23,98,74,0.55)', latticeFine: 'rgba(201,164,90,0.7)',
            edge: '#c9a45a', starA: '#0c3b2e', starRing: '#c9a45a', starB: '#17624a', disc: '#fbf7ef',
            glow: '#ff9fb2', glowAlpha: 0.38, glowAdd: false,
            lightCore: '255,255,255', lightMid: '255,240,222', lightEdge: '255,196,196',
            seam: '255,246,214', mote: '#e0889c', moteAdd: false, moteAlpha: 0.75
        },
        dark: {
            frames: ['#06241b', '#e6c36a', '#17624a'],
            doorBase: '#0b2a21', lattice: 'rgba(58,154,115,0.6)', latticeFine: 'rgba(230,195,106,0.55)',
            edge: '#e6c36a', starA: '#e6c36a', starRing: '#f3dc9a', starB: '#17624a', disc: '#04130e',
            glow: '#ffd88a', glowAlpha: 0.5, glowAdd: true,
            lightCore: '255,255,255', lightMid: '255,224,150', lightEdge: '255,170,90',
            seam: '255,236,170', mote: '#ffe2a8', moteAdd: true, moteAlpha: 0.9
        }
    };

    let renderer, scene, camera, clock;
    let gateGroup, doorL, doorR, doorMats = [], frameMeshes = [], edgeMeshes = [];
    let starGroup, starA, starRing, starB, disc, glowSprite;
    let lightPlane, seamPlane, motes, moteGeo;
    let latticeTex = [null, null];
    let theme = 'light', active = true, mouse = { x: 0, y: 0 }, opening = false;
    const state = { energy: 0, base: 0, pulse: 0, prog: 0, openT: 0, unlock: 0, camZ: CAM_Z };
    const g = () => (typeof gsap !== 'undefined' ? gsap : null);

    // ---------- Bentuk ----------
    function archShape(w, y0, ys, yt, shape) {
        const s = shape || new THREE.Shape();
        const r = yt - ys;
        s.moveTo(-w, y0);
        s.lineTo(-w, ys);
        s.bezierCurveTo(-w, ys + 0.62 * r, -w * 0.4, yt - 0.22 * r, 0, yt);
        s.bezierCurveTo(w * 0.4, yt - 0.22 * r, w, ys + 0.62 * r, w, ys);
        s.lineTo(w, y0);
        s.closePath();
        return s;
    }

    // Gelang dari dua bentuk berstruktur sama (lebih mantap daripada lubang earcut)
    function ringGeo(outer, inner, div) {
        const a = outer.getPoints(div), b = inner.getPoints(div), n = Math.min(a.length, b.length);
        const pos = [], idx = [];
        for (let i = 0; i < n; i++) { pos.push(a[i].x, a[i].y, 0, b[i].x, b[i].y, 0); }
        for (let i = 0; i < n - 1; i++) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        return g;
    }

    // Separuh pintu; hinge di x=0 tempatan. side = +1 (kiri, memanjang ke +x) atau -1 (kanan)
    function doorShape(side, w, y0, ys, yt) {
        const r = yt - ys, s = new THREE.Shape();
        s.moveTo(0, y0);
        s.lineTo(0, ys);
        s.bezierCurveTo(0, ys + 0.62 * r, side * w * 0.6, yt - 0.22 * r, side * w, yt);
        s.lineTo(side * w, y0);
        s.closePath();
        return s;
    }

    function starPoly(R, r, rot, n) {
        n = n || 8;
        const pts = [];
        for (let i = 0; i < n * 2; i++) {
            const a = rot + (i * Math.PI) / n;
            const rad = i % 2 === 0 ? R : r;
            pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
        }
        return pts;
    }
    function starShape(R, ratio, rot, shape) {
        const s = shape || new THREE.Shape();
        starPoly(R, R * ratio, rot).forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
        s.closePath();
        return s;
    }
    function starFrameGeo(R, thick, ratio) {
        const outer = starShape(R, ratio, Math.PI / 8);
        outer.holes.push(starShape(R - thick, ratio, Math.PI / 8));
        return new THREE.ShapeGeometry(outer);
    }

    // ---------- Tekstur ----------
    function makeLattice(p) {
        const N = 256, c = document.createElement('canvas');
        c.width = c.height = N;
        const x = c.getContext('2d');
        x.fillStyle = p.doorBase; x.fillRect(0, 0, N, N);
        const drawStar = (cx, cy, R, ratio, rot) => {
            x.beginPath();
            starPoly(R, R * ratio, rot).forEach((q, i) => (i ? x.lineTo(cx + q[0], cy + q[1]) : x.moveTo(cx + q[0], cy + q[1])));
            x.closePath(); x.stroke();
        };
        x.lineWidth = 3; x.strokeStyle = p.lattice;
        [[0, 0], [N, 0], [0, N], [N, N]].forEach(([cx, cy]) => { drawStar(cx, cy, N / 2, 0.52, Math.PI / 8); });
        x.lineWidth = 2; x.strokeStyle = p.latticeFine;
        [[0, 0], [N, 0], [0, N], [N, N]].forEach(([cx, cy]) => { drawStar(cx, cy, N * 0.3, 0.55, 0); });
        // belah ketupat di tengah sel
        x.lineWidth = 3; x.strokeStyle = p.lattice;
        x.beginPath();
        x.moveTo(N / 2, N * 0.18); x.lineTo(N * 0.82, N / 2); x.lineTo(N / 2, N * 0.82); x.lineTo(N * 0.18, N / 2); x.closePath(); x.stroke();
        x.lineWidth = 2; x.strokeStyle = p.latticeFine;
        x.beginPath(); x.arc(N / 2, N / 2, N * 0.1, 0, Math.PI * 2); x.stroke();
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(1 / 1.25, 1 / 1.25);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        return t;
    }

    function radialTex(stops) {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const x = c.getContext('2d');
        const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
        stops.forEach(s => gr.addColorStop(s[0], s[1]));
        x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    }
    function seamTex(rgb) {
        const c = document.createElement('canvas'); c.width = 128; c.height = 8;
        const x = c.getContext('2d');
        const gr = x.createLinearGradient(0, 0, 128, 0);
        gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.5, `rgba(${rgb},1)`); gr.addColorStop(1, `rgba(${rgb},0)`);
        x.fillStyle = gr; x.fillRect(0, 0, 128, 8);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    }

    const mat = (color, extra) => new THREE.MeshBasicMaterial(Object.assign({ color: new THREE.Color(color) }, extra || {}));

    // ---------- Bina ----------
    function build(quality) {
        gateGroup = new THREE.Group();
        gateGroup.position.y = OFFSET_Y;
        scene.add(gateGroup);

        // Cahaya di belakang pintu (muncul bila pintu terbuka)
        lightPlane = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
        lightPlane.position.set(0, 0.3, -1.2);
        gateGroup.add(lightPlane);

        // Bingkai gerbang berlapis
        const specs = [{ d: 0.5, t: 0.2, z: -0.05, c: 0 }, { d: 0.3, t: 0.09, z: 0.02, c: 1 }, { d: 0.15, t: 0.15, z: 0.08, c: 2 }];
        specs.forEach(sp => {
            const w = DW + sp.d, yt = YT + sp.d * 1.25, y0 = Y0 - 0.17;
            const outer = archShape(w, y0, YS, yt);
            const inner = archShape(w - sp.t, y0, YS, yt - sp.t * 1.2);
            const m = new THREE.Mesh(ringGeo(outer, inner, 28), mat('#000', { side: THREE.DoubleSide }));
            m.position.z = sp.z; m.userData.ci = sp.c;
            gateGroup.add(m); frameMeshes.push(m);
        });

        // Pintu
        const mkDoor = (side) => {
            const grp = new THREE.Group();
            grp.position.set(-side * DW, 0, 0);
            const m = mat('#fff');
            doorMats.push(m);
            const mesh = new THREE.Mesh(new THREE.ShapeGeometry(doorShape(side, DW - 0.02, Y0, YS, YT - 0.02), 28), m);
            grp.add(mesh);
            // palang tebal di tepi pintu (menimbulkan kesan ketebalan)
            const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, YT - Y0, 0.12), mat('#000'));
            bar.position.set(side * (DW - 0.035) - side * 0.0, (YT + Y0) / 2 - 0.02, 0.02);
            bar.visible = false;
            grp.add(bar);
            const seamBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, YT - Y0 - 0.05, 0.1), mat('#000'));
            seamBar.position.set(side * (DW - 0.03), (YT + Y0) / 2 - 0.05, 0.03);
            edgeMeshes.push(seamBar);
            grp.add(seamBar);
            gateGroup.add(grp);
            return grp;
        };
        doorL = mkDoor(1);
        doorR = mkDoor(-1);
        // Garis cahaya di celah pintu
        seamPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, YT - Y0), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
        seamPlane.position.set(0, (YT + Y0) / 2, 0.06);
        gateGroup.add(seamPlane);

        // Bintang kunci
        starGroup = new THREE.Group();
        starGroup.position.set(0, STAR_Y, 0.1);
        gateGroup.add(starGroup);
        glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
        glowSprite.scale.set(5.2, 5.2, 1); glowSprite.position.z = 0.05;
        starGroup.add(glowSprite);
        starRing = new THREE.Mesh(starFrameGeo(1.42, 0.07, 0.62), mat('#000'));
        starRing.position.z = 0.02; starGroup.add(starRing);
        starB = new THREE.Mesh(new THREE.ShapeGeometry(starShape(1.34, 0.6, Math.PI / 8)), mat('#000', { transparent: true }));
        starB.position.z = 0.04; starGroup.add(starB);
        starA = new THREE.Mesh(new THREE.ShapeGeometry(starShape(1.14, 0.6, 0)), mat('#000', { transparent: true }));
        starA.position.z = 0.07; starGroup.add(starA);
        const dShape = new THREE.Shape(); dShape.absarc(0, 0, 0.74, 0, Math.PI * 2, false);
        disc = new THREE.Mesh(new THREE.ShapeGeometry(dShape, 48), mat('#000', { transparent: true, opacity: 0.94 }));
        disc.position.z = 0.1; starGroup.add(disc);

        // Zarah cahaya
        const n = quality === 'low' ? 70 : 150;
        const pos = new Float32Array(n * 3), spd = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 13;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
            pos[i * 3 + 2] = Math.random() * 3 - 1;
            spd[i] = 0.1 + Math.random() * 0.25;
        }
        moteGeo = new THREE.BufferGeometry();
        moteGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        moteGeo.userData.spd = spd;
        const dot = radialTex([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]);
        motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ size: 0.16, map: dot, transparent: true, depthWrite: false, sizeAttenuation: true }));
        scene.add(motes);

        glowSprite.userData.tex = radialTex([[0, 'rgba(255,255,255,0.95)'], [0.35, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
        glowSprite.material.map = glowSprite.userData.tex;
    }

    // ---------- Tema ----------
    function applyPalette() {
        const p = PAL[theme];
        frameMeshes.forEach(m => m.material.color.set(p.frames[m.userData.ci]));
        edgeMeshes.forEach(m => m.material.color.set(p.edge));
        const idx = theme === 'light' ? 0 : 1;
        if (!latticeTex[idx]) latticeTex[idx] = makeLattice(p);
        doorMats.forEach(m => { m.map = latticeTex[idx]; m.color.set('#ffffff'); m.needsUpdate = true; });
        starA.material.color.set(p.starA);
        starRing.material.color.set(p.starRing);
        starB.material.color.set(p.starB);
        disc.material.color.set(p.disc);
        glowSprite.material.color.set(p.glow);
        glowSprite.material.blending = p.glowAdd ? THREE.AdditiveBlending : THREE.NormalBlending;
        glowSprite.material.needsUpdate = true;
        // cahaya belakang
        if (lightPlane.material.map) lightPlane.material.map.dispose();
        lightPlane.material.map = radialTex([[0, `rgba(${p.lightCore},1)`], [0.5, `rgba(${p.lightMid},0.97)`], [0.8, `rgba(${p.lightEdge},0.55)`], [1, `rgba(${p.lightEdge},0)`]]);
        lightPlane.material.needsUpdate = true;
        if (seamPlane.material.map) seamPlane.material.map.dispose();
        seamPlane.material.map = seamTex(p.seam);
        seamPlane.material.blending = p.glowAdd ? THREE.AdditiveBlending : THREE.NormalBlending;
        seamPlane.material.needsUpdate = true;
        motes.material.color.set(p.mote);
        motes.material.blending = p.moteAdd ? THREE.AdditiveBlending : THREE.NormalBlending;
        motes.material.opacity = p.moteAlpha;
        motes.material.needsUpdate = true;
    }

    // ---------- Gelung ----------
    function frame() {
        requestAnimationFrame(frame);
        if (!active || document.hidden) return;
        const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
        const p = PAL[theme];
        const e = Math.max(state.base, state.prog) * 0.8 + state.energy;

        starA.rotation.z += dt * (0.05 + e * 0.35);
        starB.rotation.z -= dt * (0.08 + e * 0.5);
        starRing.rotation.z += dt * 0.02;

        const pulseS = 1 + state.pulse * 0.07 + state.prog * 0.04;
        const unlockS = 1 + state.unlock * 0.55;
        starGroup.scale.setScalar(pulseS * unlockS);
        const fade = 1 - state.unlock;
        starA.material.opacity = fade; starB.material.opacity = fade; disc.material.opacity = 0.94 * fade;
        starRing.visible = fade > 0.02; starA.visible = fade > 0.02; starB.visible = fade > 0.02; disc.visible = fade > 0.02;

        const gl = (0.28 + e * 0.6 + state.pulse * 0.25) * p.glowAlpha * 2.1;
        glowSprite.material.opacity = Math.min(1, gl) * (1 - state.unlock * 0.5);
        const gs = 5.0 + e * 1.0 + state.pulse * 0.6;
        glowSprite.scale.set(gs, gs, 1);

        seamPlane.material.opacity = Math.min(1, 0.06 + state.prog * 0.5 + state.energy * 0.3 + state.openT * 0.8);
        seamPlane.scale.x = 1 + state.openT * 3;

        lightPlane.material.opacity = Math.min(1, state.openT * 1.4);
        lightPlane.scale.setScalar(1 + state.openT * 0.9);

        // zarah naik perlahan
        const arr = moteGeo.attributes.position.array, sp = moteGeo.userData.spd;
        for (let i = 0; i < sp.length; i++) {
            arr[i * 3 + 1] += sp[i] * dt * (1 + e);
            arr[i * 3] += Math.sin(t * 0.4 + i) * dt * 0.05;
            if (arr[i * 3 + 1] > 4.2) { arr[i * 3 + 1] = -4.2; arr[i * 3] = (Math.random() - 0.5) * 13; }
        }
        moteGeo.attributes.position.needsUpdate = true;

        // kamera: hanyut halus + parallax tetikus
        const sway = opening ? 0 : 1;
        camera.position.x += ((mouse.x * 0.14 + Math.sin(t * 0.25) * 0.08 * sway) - camera.position.x) * 0.04;
        camera.position.y += ((mouse.y * 0.08 + Math.cos(t * 0.2) * 0.04 * sway) - camera.position.y) * 0.04;
        camera.position.z = state.camZ;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
    }

    // ---------- API ----------
    api.init = function (opts) {
        opts = opts || {};
        try {
            const canvas = opts.canvas;
            renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
            renderer.setPixelRatio(1);
            renderer.setSize(W, H, false);
            renderer.setClearColor(0x000000, 0);
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 60);
            camera.position.set(0, 0, CAM_Z);
            clock = new THREE.Clock();
            build(opts.quality);
            theme = opts.light === false ? 'dark' : 'light';
            applyPalette();
            window.addEventListener('mousemove', (ev) => {
                mouse.x = (ev.clientX / window.innerWidth - 0.5) * 2;
                mouse.y = -(ev.clientY / window.innerHeight - 0.5) * 2;
            });
            api.ready = true;
            frame();
        } catch (err) {
            console.log('Scene3D dimatikan:', err);
            api.ready = false;
        }
    };
    const guard = (fn) => function () { if (api.ready) return fn.apply(null, arguments); };

    api.setTheme = guard((light) => { theme = light ? 'light' : 'dark'; applyPalette(); });
    api.setActive = guard((b) => { active = b; if (b) clock.getDelta(); });
    api.setPhase = guard((n) => {
        const target = n === 1 ? 0 : n === 2 ? 0.55 : 1;
        if (g()) g().to(state, { base: target, duration: 1.2, ease: 'power2.out', overwrite: 'auto' }); else state.base = target;
    });
    api.progress = guard((v) => { state.prog = v; });
    api.pulse = guard(() => {
        if (g()) { state.pulse = 1; g().to(state, { pulse: 0, duration: 1.0, ease: 'power2.out' }); }
    });
    // Pintu terbuka + masuk ke dalam cahaya
    api.open = guard(() => {
        opening = true;
        active = true;
        if (!g()) { state.openT = 1; state.unlock = 1; state.camZ = 3.2; doorL.rotation.y = 1.45; doorR.rotation.y = -1.45; return; }
        const G = g();
        G.killTweensOf([state, doorL.rotation, doorR.rotation]);
        const tl = G.timeline();
        tl.to(state, { prog: 1, energy: 1, duration: 0.5, ease: 'power2.out' }, 0)
          .to(state, { unlock: 1, duration: 0.8, ease: 'power2.inOut' }, 0)
          .to(state, { openT: 1, duration: 2.4, ease: 'power2.inOut' }, 0.5)
          .to(doorL.rotation, { y: 1.45, duration: 2.4, ease: 'power2.inOut' }, 0.6)
          .to(doorR.rotation, { y: -1.45, duration: 2.4, ease: 'power2.inOut' }, 0.6)
          .to(state, { camZ: 3.2, duration: 2.6, ease: 'power2.in' }, 0.9);
        api._tl = tl;
    });
    api.reset = guard(() => {
        const G = g();
        if (api._tl) { api._tl.kill(); api._tl = null; }
        if (G) G.killTweensOf([state, doorL.rotation, doorR.rotation]);
        opening = false;
        Object.assign(state, { energy: 0, base: 0, pulse: 0, prog: 0, openT: 0, unlock: 0, camZ: CAM_Z });
        doorL.rotation.y = 0; doorR.rotation.y = 0;
        active = true;
    });
})();
