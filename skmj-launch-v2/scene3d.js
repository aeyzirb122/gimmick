/* ==========================================================================
   SCENE3D - Bintang Islam 8 penjuru (Rub el Hizb) dalam 3D
   Dibina sepenuhnya dalam kod dengan Three.js (tiada fail model).
   API: init, setTheme, setPhase, progress, pulse, burst, setActive, resize
   ========================================================================== */
(function () {
    'use strict';

    var T = window.THREE;
    var api = { ready: false };
    window.Scene3D = api;

    // Semua kaedah selamat dipanggil walaupun 3D tidak tersedia
    ['init', 'setTheme', 'setPhase', 'progress', 'pulse', 'burst', 'setActive', 'resize'].forEach(function (n) {
        api[n] = function () {};
    });
    if (!T) return;

    var COLORS = {
        dark:  { star: 0xffb3c1, ring: 0x8fe0b4, core: 0xff8ca3, glow: 0xe65c7b, pA: 0xff8ca3, pB: 0x8fe0b4, starOp: 0.9,  ringOp: 0.6, glowBase: 0.5 },
        light: { star: 0xb83253, ring: 0x17624a, core: 0xe65c7b, glow: 0xe65c7b, pA: 0xe65c7b, pB: 0x3a9a73, starOp: 0.7,  ringOp: 0.5, glowBase: 0.28 }
    };

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var RM = reduceMotion ? 0.4 : 1;

    var canvas, renderer, scene, camera, tilt, group, clock;
    var squaresOuter, squaresInner, octagon, ringA, ringB, ringC;
    var starMat, ringMat, coreMat, core, glow, glowBase = 0.4;
    var points, pointsMat, pointColors, burstRings = [];
    var state = { speed: 0.12, energy: 0, pulse: 0, kick: 0 };
    var isLight = false, active = true, raf = 0, fit = 1, t = 0, mx = 0, my = 0;
    var quality = 'high';

    function gs() { return window.gsap; }

    function radialTexture() {
        var c = document.createElement('canvas');
        c.width = c.height = 128;
        var x = c.getContext('2d');
        var g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, 128, 128);
        return new T.CanvasTexture(c);
    }

    function basic(color, opacity) {
        return new T.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false });
    }

    // Bingkai segi empat (4 bilah nipis). Dua segi empat bersilang = bintang 8 penjuru
    function squareFrame(size, thick, mat) {
        var g = new T.Group();
        var h = size / 2;
        var horiz = new T.BoxGeometry(size + thick, thick, thick);
        var vert = new T.BoxGeometry(thick, size + thick, thick);
        [[0, h, horiz], [0, -h, horiz], [h, 0, vert], [-h, 0, vert]].forEach(function (p) {
            var m = new T.Mesh(p[2], mat);
            m.position.set(p[0], p[1], 0);
            g.add(m);
        });
        return g;
    }

    function starPair(size, thick, mat) {
        var g = new T.Group();
        var a = squareFrame(size, thick, mat);
        var b = squareFrame(size, thick, mat);
        b.rotation.z = Math.PI / 4;
        g.add(a);
        g.add(b);
        return g;
    }

    function build() {
        scene = new T.Scene();
        camera = new T.PerspectiveCamera(40, 1, 0.1, 100);
        camera.position.set(0, 0, 9);

        tilt = new T.Group();   // untuk kesan parallax tetikus
        group = new T.Group();  // untuk putaran
        tilt.add(group);
        scene.add(tilt);

        starMat = basic(0xffffff, 0.9);
        ringMat = basic(0xffffff, 0.6);
        coreMat = new T.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.9 });

        // Bintang utama + bintang dalam (berputar arah bertentangan)
        squaresOuter = starPair(2.4, 0.035, starMat);
        squaresInner = starPair(1.5, 0.025, starMat);
        group.add(squaresOuter);
        group.add(squaresInner);

        // Segi lapan di tengah
        octagon = new T.Mesh(new T.TorusGeometry(0.95, 0.011, 6, 8), ringMat);
        octagon.rotation.z = Math.PI / 8;
        group.add(octagon);

        // Gelang giroskop bersudut berbeza (beri rasa 3D)
        ringA = new T.Mesh(new T.TorusGeometry(2.35, 0.008, 8, 160), ringMat);
        ringB = new T.Mesh(new T.TorusGeometry(2.0, 0.008, 8, 160), ringMat);
        ringC = new T.Mesh(new T.TorusGeometry(2.15, 0.008, 8, 160), ringMat);
        ringB.rotation.x = Math.PI / 2.6;
        ringC.rotation.y = Math.PI / 2.4;
        group.add(ringA);
        group.add(ringB);
        group.add(ringC);

        // Teras bercahaya
        core = new T.Mesh(new T.IcosahedronGeometry(0.22, 1), coreMat);
        group.add(core);

        var tex = radialTexture();
        glow = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.4 }));
        glow.scale.setScalar(2.4);
        glow.position.z = -0.2;
        group.add(glow);

        // Zarah cahaya
        var N = quality === 'low' ? 200 : 520;
        var pos = new Float32Array(N * 3);
        pointColors = new Float32Array(N * 3);
        for (var i = 0; i < N; i++) {
            var r = 1.3 + Math.pow(Math.random(), 0.6) * 3.4;
            var th = Math.random() * Math.PI * 2;
            var ph = Math.acos(2 * Math.random() - 1);
            pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
            pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
            pos[i * 3 + 2] = r * Math.cos(ph) * 0.6;
        }
        var geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        geo.setAttribute('color', new T.Float32BufferAttribute(pointColors, 3));
        pointsMat = new T.PointsMaterial({
            size: 0.11, map: tex, vertexColors: true, transparent: true,
            opacity: 0.8, depthWrite: false, sizeAttenuation: true
        });
        points = new T.Points(geo, pointsMat);
        group.add(points);

        // Gelombang kejut untuk detik pelancaran
        for (var k = 0; k < 2; k++) {
            var br = new T.Mesh(new T.TorusGeometry(1, 0.02, 8, 128), basic(0xe65c7b, 0));
            br.scale.setScalar(0.3);
            group.add(br);
            burstRings.push(br);
        }
    }

    function applyColors() {
        var c = isLight ? COLORS.light : COLORS.dark;
        var blend = isLight ? T.NormalBlending : T.AdditiveBlending;

        starMat.color.setHex(c.star);
        starMat.opacity = c.starOp;
        ringMat.color.setHex(c.ring);
        ringMat.opacity = c.ringOp;
        coreMat.color.setHex(c.core);

        glowBase = c.glowBase;
        glow.material.color.setHex(c.glow);
        glow.material.blending = blend;
        glow.material.needsUpdate = true;

        pointsMat.blending = blend;
        pointsMat.needsUpdate = true;
        var ca = new T.Color(c.pA), cb = new T.Color(c.pB);
        var n = pointColors.length / 3;
        for (var i = 0; i < n; i++) {
            var col = Math.random() > 0.5 ? ca : cb;
            pointColors[i * 3] = col.r;
            pointColors[i * 3 + 1] = col.g;
            pointColors[i * 3 + 2] = col.b;
        }
        points.geometry.attributes.color.array = pointColors;
        points.geometry.attributes.color.needsUpdate = true;

        burstRings.forEach(function (b, i) {
            b.material.color.setHex(i === 0 ? c.glow : c.ring);
        });
    }

    function resize() {
        if (!renderer || !canvas) return;
        var w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        var visH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI / 180) / 2);
        var visW = visH * camera.aspect;
        fit = Math.min(1, (visW * 0.92) / (2 * 2.4));
        tilt.position.y = -visH * 0.06; // duduk sedikit ke bawah, selari dengan kad
        camera.updateProjectionMatrix();
    }

    function loop() {
        if (!active) return;
        raf = requestAnimationFrame(loop);
        var dt = Math.min(clock.getDelta(), 0.05);
        t += dt;
        var s = state.speed * RM;

        squaresOuter.rotation.z += dt * s * 0.35;
        squaresInner.rotation.z -= dt * s * 0.5;
        octagon.rotation.z += dt * s * 0.2;
        ringA.rotation.z += dt * s * 0.25;
        ringB.rotation.x += dt * s * 0.45;
        ringB.rotation.z += dt * s * 0.1;
        ringC.rotation.y += dt * s * 0.35;
        ringC.rotation.z -= dt * s * 0.12;
        core.rotation.x += dt * s * 1.2;
        core.rotation.y += dt * s * 1.6;
        points.rotation.y += dt * (0.03 + s * 0.08);
        points.rotation.z += dt * 0.01;

        // Parallax lembut mengikut tetikus
        tilt.rotation.y += (mx * 0.35 - tilt.rotation.y) * 0.05;
        tilt.rotation.x += (my * 0.25 - tilt.rotation.x) * 0.05;

        tilt.scale.setScalar(fit * (1 + state.kick + state.pulse * 0.06));
        core.scale.setScalar(1 + state.energy * 0.5 + state.pulse * 0.4);
        glow.scale.setScalar(2.4 * (1 + state.energy * 0.25 + state.pulse * 0.2) + Math.sin(t * 1.2) * 0.08);
        glow.material.opacity = glowBase * (0.7 + 0.5 * Math.min(state.energy, 1.5) + state.pulse * 0.5);

        renderer.render(scene, camera);
    }

    api.init = function (opts) {
        try {
            canvas = document.getElementById('sceneCanvas');
            if (!canvas) return;
            quality = (opts && opts.quality) || 'high';
            renderer = new T.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1 : 2));
            renderer.setClearColor(0x000000, 0);
            clock = new T.Clock();
            build();
            isLight = document.body.classList.contains('theme-light');
            applyColors();
            resize();
            window.addEventListener('resize', resize);
            window.addEventListener('mousemove', function (e) {
                mx = e.clientX / window.innerWidth - 0.5;
                my = e.clientY / window.innerHeight - 0.5;
            });
            api.ready = true;
            loop();
        } catch (e) {
            console.log('3D tidak tersedia, guna paparan 2D sahaja:', e);
            api.ready = false;
            if (canvas) canvas.style.display = 'none';
        }
    };

    api.setTheme = function (light) {
        isLight = !!light;
        if (api.ready) applyColors();
    };

    api.setActive = function (a) {
        a = !!a;
        if (a === active) return;
        active = a;
        if (!api.ready) return;
        cancelAnimationFrame(raf);
        if (a) {
            clock.getDelta();
            resize();
            loop();
        }
    };

    api.resize = resize;

    // Kembali ke keadaan asas setiap fasa
    api.setPhase = function (n) {
        if (!api.ready) return;
        var speeds = { 1: 0.12, 2: 0.5, 3: 0.9 };
        var energies = { 1: 0, 2: 0.2, 3: 0.5 };
        var g = gs();
        // Reset kesan letupan
        points.scale.setScalar(1);
        burstRings.forEach(function (b) {
            b.material.opacity = 0;
            b.scale.setScalar(0.3);
        });
        if (g) {
            g.killTweensOf(state);
            g.to(state, { speed: speeds[n] || 0.12, energy: energies[n] || 0, kick: 0, duration: 1, ease: 'power2.out' });
        } else {
            state.speed = speeds[n] || 0.12;
            state.energy = energies[n] || 0;
            state.kick = 0;
        }
    };

    // p dari 0 hingga 1 semasa imbasan
    api.progress = function (p) {
        if (!api.ready) return;
        var g = gs();
        var to = { speed: 0.5 + p * 0.9, energy: 0.2 + p * 0.7 };
        if (g) g.to(state, { speed: to.speed, energy: to.energy, duration: 0.6, ease: 'power1.out', overwrite: 'auto' });
        else { state.speed = to.speed; state.energy = to.energy; }
    };

    // Denyut lembut (setiap kiraan detik)
    api.pulse = function () {
        if (!api.ready) return;
        var g = gs();
        if (g) g.fromTo(state, { pulse: 1 }, { pulse: 0, duration: 0.8, ease: 'power2.out' });
    };

    // Letupan cahaya semasa pelancaran
    api.burst = function () {
        if (!api.ready) return;
        var g = gs();
        if (!g) return;
        burstRings.forEach(function (b, i) {
            b.material.opacity = 0.9;
            b.scale.setScalar(0.3);
            g.to(b.scale, { x: 7, y: 7, z: 7, duration: 1.5, delay: i * 0.18, ease: 'power2.out' });
            g.to(b.material, { opacity: 0, duration: 1.5, delay: i * 0.18, ease: 'power1.in' });
        });
        g.to(state, { speed: 3.2, energy: 1.5, kick: 0.3, duration: 0.7, ease: 'power2.in' });
        g.to(points.scale, { x: 2.4, y: 2.4, z: 2.4, duration: 1.6, ease: 'power2.out' });
    };
})();
