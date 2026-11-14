/* ==========================================================================
   MAJLIS KHATAM AL-QURAN SK MERPATI JEPANG 2026 - GIMIK PELANCARAN
   Aliran: 1 Tekan & tahan -> 2 Pengesahan -> 3 Kiraan detik -> 4 Video
   Tetapan ada dalam config.js
   ========================================================================== */
const DEFAULTS = {
    videoType: "direct", videoUrl: "launch.mp4", holdSeconds: 2, countdownSeconds: 3,
    backupCode: "SKMJ2026", defaultTheme: "light", quality: "high", autoFullscreen: true
};
const config = Object.assign({}, DEFAULTS, window.LAUNCH_CONFIG || {});
const params = new URLSearchParams(location.search);
const REHEARSAL = params.get('rehearsal') === '1';
if (REHEARSAL) config.holdSeconds = Math.min(config.holdSeconds, 0.8);

const $ = (id) => document.getElementById(id);
const stage = $('stage'), holdZone = $('holdZone'), ringProg = $('ringProg');
const RING = 628.32;
const hasGSAP = () => typeof gsap !== 'undefined';

let phase = 1, holdP = 0, holding = false, autoHolding = false, lastT = 0;
let timerInterval = null, phaseTimeout = null, launchTl = null, fsTried = false;

/* ---------- Pentas 16:9 diskala mengikut skrin ---------- */
function fit() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.documentElement.style.setProperty('--s', s);
}
window.addEventListener('resize', fit); fit();

/* ---------- Bunyi (lembut & profesional) ---------- */
let audioCtx = null, masterBus = null, reverbSend = null, holdOsc = null, holdGain = null;
function buildImpulse(ctx, seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return buf;
}
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const comp = audioCtx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
        const master = audioCtx.createGain(); master.gain.value = 0.8;
        comp.connect(master); master.connect(audioCtx.destination); masterBus = comp;
        const conv = audioCtx.createConvolver(); conv.buffer = buildImpulse(audioCtx, 2.4, 2.5);
        const wet = audioCtx.createGain(); wet.gain.value = 0.35; conv.connect(wet); wet.connect(comp); reverbSend = conv;
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
function tone({ freq, type = 'sine', start = 0, attack = 0.01, decay = 0.6, peak = 0.2, wet = 0.3, endFreq = null }) {
    const t = audioCtx.currentTime + start, osc = audioCtx.createOscillator(), g = audioCtx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + attack + decay);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    osc.connect(g); g.connect(masterBus);
    if (wet > 0) { const s = audioCtx.createGain(); s.gain.value = wet; g.connect(s); s.connect(reverbSend); }
    osc.start(t); osc.stop(t + attack + decay + 0.05);
}
function airSwell({ start = 0, duration = 1.6, peak = 0.06, from = 3000, to = 250 }) {
    const t = audioCtx.currentTime + start, len = Math.floor(audioCtx.sampleRate * duration);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const f = audioCtx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + duration);
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(f); f.connect(g); g.connect(masterBus); src.start(t);
}
function startHoldTone() {
    try {
        initAudio(); stopHoldTone();
        holdOsc = audioCtx.createOscillator(); holdGain = audioCtx.createGain();
        holdOsc.type = 'sine'; holdOsc.frequency.value = 220; holdGain.gain.value = 0.0001;
        holdOsc.connect(holdGain); holdGain.connect(masterBus);
        const s = audioCtx.createGain(); s.gain.value = 0.4; holdGain.connect(s); s.connect(reverbSend);
        holdOsc.start();
    } catch (e) {}
}
function updateHoldTone(p) {
    if (!holdOsc) return;
    const t = audioCtx.currentTime;
    holdOsc.frequency.setTargetAtTime(220 * Math.pow(2, p * 1.2), t, 0.05);
    holdGain.gain.setTargetAtTime(0.02 + p * 0.07, t, 0.05);
}
function stopHoldTone() {
    if (!holdOsc) return;
    try {
        const t = audioCtx.currentTime;
        holdGain.gain.cancelScheduledValues(t); holdGain.gain.setTargetAtTime(0.0001, t, 0.06);
        holdOsc.stop(t + 0.3);
    } catch (e) {}
    holdOsc = null; holdGain = null;
}
function playSound(type) {
    try {
        initAudio();
        if (type === 'press') tone({ freq: 523.25, decay: 0.25, peak: 0.04, wet: 0.3 });
        else if (type === 'confirm') {
            tone({ freq: 440, attack: 0.015, decay: 1.3, peak: 0.12, wet: 0.5 });
            tone({ freq: 659.25, start: 0.1, attack: 0.015, decay: 1.4, peak: 0.1, wet: 0.55 });
            tone({ freq: 880, start: 0.22, attack: 0.02, decay: 1.5, peak: 0.05, wet: 0.6 });
        } else if (type === 'tick') {
            tone({ freq: 196, decay: 0.6, peak: 0.16, wet: 0.25 });
            tone({ freq: 392, decay: 0.45, peak: 0.08, wet: 0.3 });
        } else if (type === 'launch') {
            tone({ freq: 110, endFreq: 45, attack: 0.01, decay: 2.2, peak: 0.34, wet: 0.2 });
            [261.63, 329.63, 392.0, 523.25, 659.25].forEach((f, i) => tone({ freq: f, start: 0.05 + i * 0.05, attack: 0.08, decay: 2.8, peak: 0.065, wet: 0.6 }));
            airSwell({ duration: 2.2, peak: 0.07 });
        }
    } catch (e) { console.log('Audio:', e); }
}

/* ---------- Skrin penuh / toast ---------- */
function goFullscreen() {
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
    document.documentElement.requestFullscreen().catch(() => {});
}
function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else goFullscreen();
}
let toastT = null;
function toast(msg) {
    if (!REHEARSAL) return;
    const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 1600);
}

/* ---------- UI helpers ---------- */
function setRing(p, transition) {
    ringProg.style.transition = transition || 'none';
    ringProg.style.strokeDashoffset = RING * (1 - Math.max(0, Math.min(1, p)));
}
function setPill(main, sub) { $('pillMain').textContent = main; $('pillSub').textContent = sub; }
function showIcon(which) {
    $('icoPress').classList.toggle('hidden', which !== 'press');
    $('icoCheck').classList.toggle('hidden', which !== 'check');
    $('num').classList.toggle('hidden', which !== 'num');
}
function popNumber(el) {
    if (hasGSAP()) gsap.fromTo(el, { scale: 1.3, opacity: 0.2 }, { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(2.2)', overwrite: true });
    Scene3D.pulse();
}
function swapPill(main, sub) {
    const pill = $('pill');
    if (!hasGSAP()) { setPill(main, sub); return; }
    gsap.to(pill, { opacity: 0, y: 8, duration: 0.2, onComplete: () => { setPill(main, sub); gsap.to(pill, { opacity: 1, y: 0, duration: 0.45 }); } });
}
function clearTimers() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (phaseTimeout) { clearTimeout(phaseTimeout); phaseTimeout = null; }
}

/* ---------- Langkah 1: tekan & tahan ---------- */
function beginHold(auto) {
    if (phase !== 1) return;
    initAudio();
    if (config.autoFullscreen && !fsTried) { fsTried = true; goFullscreen(); }
    if (holding) return;
    holding = true; autoHolding = !!auto;
    holdZone.classList.add('holding');
    playSound('press'); startHoldTone();
}
function endHold() {
    if (!holding || autoHolding) return;
    holding = false; holdZone.classList.remove('holding'); stopHoldTone();
}
function holdLoop(ts) {
    requestAnimationFrame(holdLoop);
    const dt = Math.min(0.5, (ts - lastT) / 1000 || 0); lastT = ts;
    if (phase !== 1) return;
    const dur = Math.max(0.3, config.holdSeconds);
    if (holding) holdP = Math.min(1, holdP + dt / dur);
    else if (holdP > 0) holdP = Math.max(0, holdP - dt / 0.45);
    setRing(holdP);
    Scene3D.progress(holdP);
    if (holding) updateHoldTone(holdP);
    if (holding && holdP >= 1) { holding = false; autoHolding = false; holdZone.classList.remove('holding'); stopHoldTone(); confirmGuest(); }
}
requestAnimationFrame(holdLoop);

holdZone.addEventListener('pointerdown', (e) => { e.preventDefault(); try { holdZone.setPointerCapture(e.pointerId); } catch (x) {} beginHold(false); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => holdZone.addEventListener(ev, endHold));
holdZone.addEventListener('contextmenu', e => e.preventDefault());

/* ---------- Langkah 2: pengesahan ---------- */
function confirmGuest() {
    clearTimers();
    phase = 2; stage.dataset.phase = 2;
    holdP = 1; setRing(1);
    showIcon('check');
    swapPill('Kehadiran disahkan', 'Selamat datang');
    playSound('confirm');
    Scene3D.setPhase(2); Scene3D.pulse();
    if (hasGSAP()) gsap.fromTo('#icoCheck', { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2)' });
    phaseTimeout = setTimeout(startCountdown, 2200);
}

/* ---------- Langkah 3: kiraan detik ---------- */
function startCountdown() {
    clearTimers();
    phase = 3; stage.dataset.phase = 3;
    const total = Math.max(1, parseInt(config.countdownSeconds) || 3);
    let left = total;
    Scene3D.setPhase(3);
    swapPill('Majlis akan dilancarkan', 'Bersedia');
    showIcon('num');
    const num = $('num');
    const show = () => { num.textContent = left; popNumber(num); playSound('tick'); };
    setRing(1); show();
    requestAnimationFrame(() => requestAnimationFrame(() => setRing((left - 1) / total, 'stroke-dashoffset 1s linear')));
    timerInterval = setInterval(() => {
        left--;
        if (left > 0) {
            show();
            setRing((left - 1) / total, 'stroke-dashoffset 1s linear');
        } else {
            clearInterval(timerInterval); timerInterval = null;
            launch();
        }
    }, 1000);
}

/* ---------- Pelancaran: pintu terbuka -> cahaya -> video ---------- */
function launch(skipOpen) {
    clearTimers();
    phase = 3.5; // sedang melancar
    $('num').classList.add('hidden');
    $('holdZone').style.opacity = 0; $('pill').style.opacity = 0;
    playSound('launch');
    if (!skipOpen) Scene3D.open();
    const flash = $('launchFlash');
    if (!hasGSAP()) { showVideo(); return; }
    flash.style.display = 'block';
    launchTl = gsap.timeline();
    launchTl.fromTo(flash, { opacity: 0 }, { opacity: 1, duration: 1.0, ease: 'power2.in' }, skipOpen ? 0 : 1.9)
            .add(() => showVideo())
            .to(flash, { opacity: 0, duration: 1.4, ease: 'power1.out' }, '+=0.2')
            .add(() => { flash.style.display = 'none'; });
}

/* ---------- Langkah 4: video ---------- */
const videoEl = $('launchVideo'), iframeEl = $('youtubeIframe'), videoLayer = $('videoLayer');

function normalizeYouTubeUrl(url) {
    url = (url || '').trim();
    const m = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([\w-]{6,})/);
    if (m) return 'https://www.youtube.com/embed/' + m[1] + '?autoplay=1&rel=0';
    if (/youtube\.com\/embed\//.test(url) && !/autoplay=/.test(url)) return url + (url.includes('?') ? '&' : '?') + 'autoplay=1';
    return url;
}
function showVideoError(msg) { $('videoErrorText').textContent = msg; $('videoError').classList.remove('hidden'); }

// Pramuat video supaya mula serta-merta
function preloadVideo() {
    if (config.videoType === 'youtube') return;
    videoEl.src = config.videoUrl;
    videoEl.load();
}
videoEl.addEventListener('error', () => {
    if (!videoLayer.classList.contains('hidden')) showVideoError('Video tidak dapat dimuat. Semak fail "' + config.videoUrl + '" berada dalam folder yang sama.');
});

function showVideo() {
    phase = 4; stage.dataset.phase = 4;
    clearTimers();
    videoLayer.classList.remove('hidden');
    $('videoError').classList.add('hidden');
    stage.style.visibility = 'hidden';
    $('bgCanvas').style.visibility = 'hidden';
    Scene3D.setActive(false);
    if (config.videoType === 'youtube') {
        videoEl.classList.add('hidden');
        iframeEl.classList.remove('hidden');
        iframeEl.src = normalizeYouTubeUrl(config.videoUrl);
        return;
    }
    iframeEl.classList.add('hidden');
    videoEl.classList.remove('hidden');
    if (!videoEl.getAttribute('src')) preloadVideo();
    try { videoEl.currentTime = 0; } catch (e) {}
    videoEl.muted = false;
    const p = videoEl.play();
    if (p && p.catch) p.catch((err) => {
        if (err && err.name === 'NotSupportedError') return;
        videoEl.muted = true;
        videoEl.play().then(() => setTimeout(() => { videoEl.muted = false; }, 200)).catch(() => {});
    });
}
function retryVideo() { $('videoError').classList.add('hidden'); preloadVideo(); showVideo(); }

/* ---------- Set semula ---------- */
function resetAll() {
    clearTimers();
    if (launchTl) { launchTl.kill(); launchTl = null; }
    if (hasGSAP()) gsap.killTweensOf(['#pill', '#holdZone', '#icoCheck', '#num', '#launchFlash']);
    $('launchFlash').style.display = 'none'; $('launchFlash').style.opacity = 0;
    stopHoldTone();
    holding = false; autoHolding = false; holdP = 0;
    holdZone.classList.remove('holding');
    videoEl.pause(); try { videoEl.currentTime = 0; } catch (e) {}
    iframeEl.removeAttribute('src'); iframeEl.classList.add('hidden');
    videoLayer.classList.add('hidden'); $('videoError').classList.add('hidden');
    stage.style.visibility = 'visible'; $('bgCanvas').style.visibility = 'visible';
    $('holdZone').style.opacity = 1; $('pill').style.opacity = 1; $('pill').style.transform = '';
    $('pill').removeAttribute('style');
    setRing(0); showIcon('press');
    setPill('Tekan & tahan untuk melancarkan', 'Tetamu Kehormat');
    phase = 1; stage.dataset.phase = 1;
    Scene3D.reset(); Scene3D.setPhase(1); Scene3D.setActive(true);
}

/* ---------- Lompat langkah (untuk latihan / kecemasan) ---------- */
function jumpTo(n) {
    initAudio();
    if (n === 1) { resetAll(); return; }
    const wasVideo = phase === 4;
    if (wasVideo) resetAll();
    if (n === 2) { resetAll(); confirmGuest(); }
    else if (n === 3) { resetAll(); holdP = 1; startCountdown(); }
    else if (n === 4) { resetAll(); launch(true); }
}

/* ---------- Papan kekunci ---------- */
let codeBuf = '';
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === ' ') { e.preventDefault(); if (!e.repeat) beginHold(false); return; }
    if (k === 'PageDown' || k === 'ArrowRight' || k === 'Enter') { e.preventDefault(); if (phase === 1) beginHold(true); return; }
    if (/^[1-4]$/.test(k)) { toast('Langkah ' + k); jumpTo(parseInt(k)); return; }
    const lk = k.toLowerCase();
    if (lk === 'r' || k === 'PageUp' || k === 'ArrowLeft') { toast('Set semula'); resetAll(); return; }
    if (lk === 'v') { toast('Terus ke video'); jumpTo(4); return; }
    if (lk === 'f') { toggleFullscreen(); return; }
    if (lk === 't') { toggleTheme(); return; }
    // Kod sandaran: taip pada papan kekunci
    if (k.length === 1 && phase === 1) {
        codeBuf = (codeBuf + k).slice(-24).toUpperCase();
        if (config.backupCode && codeBuf.endsWith(String(config.backupCode).toUpperCase())) { codeBuf = ''; initAudio(); holdP = 1; confirmGuest(); }
    }
});
document.addEventListener('keyup', (e) => { if (e.key === ' ') endHold(); });
window.addEventListener('blur', endHold);

/* ---------- Tema ---------- */
function applyTheme(t) {
    const light = t !== 'dark';
    document.body.classList.toggle('theme-light', light);
    document.body.classList.toggle('theme-dark', !light);
    $('themeLabel').textContent = light ? 'MOD GELAP' : 'MOD CERAH';
    petals.forEach(p => p.recolor());
    Scene3D.setTheme(light);
}
function toggleTheme() {
    const next = document.body.classList.contains('theme-light') ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem('skmj2026_theme', next); } catch (e) {}
    if (document.activeElement) document.activeElement.blur();
}

/* ---------- Kelopak strawberi & daun matcha ---------- */
const bgCanvas = $('bgCanvas'), bctx = bgCanvas.getContext('2d');
function sizeBg() { bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight; }
window.addEventListener('resize', sizeBg); sizeBg();

class Petal {
    constructor() { this.reset(true); }
    recolor() {
        const light = document.body.classList.contains('theme-light');
        this.color = this.type === 'petal' ? (light ? '#e65c7b' : '#ff8ca3') : (light ? '#3a9a73' : '#6fbf73');
    }
    reset(initial) {
        this.type = Math.random() > 0.5 ? 'petal' : 'leaf';
        this.x = Math.random() * bgCanvas.width;
        this.y = initial ? Math.random() * bgCanvas.height : -30;
        this.size = Math.random() * 9 + 8;
        this.fall = Math.random() * 0.5 + 0.25;
        this.sway = Math.random() * 1.3 + 0.5;
        this.phase = Math.random() * Math.PI * 2;
        this.rot = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.02;
        this.alpha = Math.random() * 0.3 + 0.28;
        this.recolor();
    }
    update() {
        this.phase += 0.012; this.y += this.fall;
        this.x += Math.sin(this.phase) * this.sway * 0.5; this.rot += this.rotSpeed;
        if (this.y > bgCanvas.height + 40) this.reset(false);
    }
    draw() {
        const s = this.size;
        bctx.save(); bctx.translate(this.x, this.y); bctx.rotate(this.rot);
        bctx.globalAlpha = this.alpha; bctx.fillStyle = this.color; bctx.beginPath();
        if (this.type === 'petal') {
            bctx.moveTo(0, -s); bctx.bezierCurveTo(s * 0.9, -s * 0.4, s * 0.7, s * 0.7, 0, s); bctx.bezierCurveTo(-s * 0.7, s * 0.7, -s * 0.9, -s * 0.4, 0, -s);
        } else {
            bctx.moveTo(0, -s); bctx.quadraticCurveTo(s * 0.8, 0, 0, s); bctx.quadraticCurveTo(-s * 0.8, 0, 0, -s);
        }
        bctx.fill(); bctx.restore();
    }
}
const petals = [];
for (let i = 0; i < (config.quality === 'low' ? 12 : 30); i++) petals.push(new Petal());
(function loopPetals() {
    requestAnimationFrame(loopPetals);
    if (phase === 4) return;
    bctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    petals.forEach(p => { p.update(); p.draw(); });
})();

/* ---------- Kursor & togol disembunyi bila tidak digerakkan ---------- */
let idleT = null;
function wake() { document.body.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => document.body.classList.add('idle'), 2500); }
window.addEventListener('mousemove', wake); wake();

/* ---------- Mula ---------- */
Scene3D.init({ canvas: $('sceneCanvas'), quality: config.quality, light: !document.body.classList.contains('theme-dark') });
applyTheme(document.body.classList.contains('theme-dark') ? 'dark' : 'light');
preloadVideo();
if (REHEARSAL) $('rehearsal').classList.remove('hidden');
if (hasGSAP() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.from('.titleblock', { opacity: 0, y: -14, duration: 1.4, ease: 'power3.out', clearProps: 'all' });
    gsap.from('#holdZone', { opacity: 0, scale: 0.85, duration: 1.1, delay: 0.5, ease: 'power3.out', clearProps: 'opacity,transform' });
    gsap.from('#pill', { opacity: 0, y: 14, duration: 1, delay: 0.8, ease: 'power3.out', clearProps: 'opacity,transform' });
}
