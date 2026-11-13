/* ==========================================================================
   MAJLIS KHATAM AL-QURAN SK MERPATI JEPANG 2026 - GIMIK SCRIPT
   Robotic Sound FX Engine & Confetti Free Version
   ========================================================================== */

   const DEFAULT_CONFIG = {
    accessCode: "SKMJ2026",
    countdownSeconds: 3,
    videoType: "direct",
    videoUrl: "launch.mp4",
    quality: "high"
};
const STORAGE_KEY = "skmj2026_launch_config";

// Muat tetapan tersimpan (kekal selepas refresh). Selamat jika localStorage disekat.
function loadConfig() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (saved && typeof saved === "object") {
            return Object.assign({}, DEFAULT_CONFIG, saved);
        }
    } catch (e) { /* abaikan */ }
    return Object.assign({}, DEFAULT_CONFIG);
}

function persistConfig() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
        console.log("Tidak dapat simpan tetapan:", e);
    }
}

const config = loadConfig();

let currentPhase = 1;
let audioCtx = null;
let timerInterval = null;
let scanInterval = null;
let scanTimeout = null;

const stageContainer = document.getElementById('stageContainer');
const phaseAuth = document.getElementById('phase-auth');
const phaseScan = document.getElementById('phase-scan');
const phaseCountdown = document.getElementById('phase-countdown');
const phaseReveal = document.getElementById('phase-reveal');

const accessInput = document.getElementById('accessCode');
const authError = document.getElementById('authError');
const systemStateText = document.getElementById('systemStateText');

// Web Audio API Synthesizer - nada profesional: lembut, hangat, dengan gema halus
let masterBus = null;
let reverbSend = null;

function buildImpulse(ctx, seconds, decay) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
    }
    return buf;
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Pemampat + volum induk supaya bunyi sentiasa rata dan tidak mengejutkan
        const comp = audioCtx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 4;
        const master = audioCtx.createGain();
        master.gain.value = 0.8;
        comp.connect(master);
        master.connect(audioCtx.destination);
        masterBus = comp;

        // Gema (reverb) ringan untuk rasa dewan / sinematik
        const conv = audioCtx.createConvolver();
        conv.buffer = buildImpulse(audioCtx, 2.2, 2.5);
        const wet = audioCtx.createGain();
        wet.gain.value = 0.35;
        conv.connect(wet);
        wet.connect(comp);
        reverbSend = conv;
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Satu nota lembut: attack ringkas, decay panjang, hantaran gema pilihan
function tone({ freq, type = 'sine', start = 0, attack = 0.01, decay = 0.6, peak = 0.2, wet = 0.3, endFreq = null }) {
    const t = audioCtx.currentTime + start;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + attack + decay);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    osc.connect(g);
    g.connect(masterBus);
    if (wet > 0) {
        const send = audioCtx.createGain();
        send.gain.value = wet;
        g.connect(send);
        send.connect(reverbSend);
    }
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
}

// Desir udara halus (noise ditapis) untuk kesan sinematik
function airSwell({ start = 0, duration = 1.4, peak = 0.07, from = 3000, to = 250 }) {
    const t = audioCtx.currentTime + start;
    const len = Math.floor(audioCtx.sampleRate * duration);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + duration);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(masterBus);
    src.start(t);
}

function playSound(type) {
    try {
        initAudio();

        if (type === 'scan') {
            // Ping halus semasa imbasan
            tone({ freq: 1320, decay: 0.14, peak: 0.035, wet: 0.2 });

        } else if (type === 'robot-tick') {
            // Denyut rendah yang tenang untuk setiap kiraan
            tone({ freq: 196, decay: 0.6, peak: 0.16, wet: 0.25 });
            tone({ freq: 392, decay: 0.45, peak: 0.08, wet: 0.3 });

        } else if (type === 'success') {
            // Loceng dua nota yang hangat (perfect fifth)
            tone({ freq: 440, attack: 0.015, decay: 1.1, peak: 0.12, wet: 0.45 });
            tone({ freq: 659.25, start: 0.1, attack: 0.015, decay: 1.2, peak: 0.1, wet: 0.5 });

        } else if (type === 'error') {
            // Dua denyut rendah, tegas tetapi tidak kasar
            tone({ freq: 140, decay: 0.28, peak: 0.18, wet: 0.1 });
            tone({ freq: 140, start: 0.17, decay: 0.32, peak: 0.16, wet: 0.1 });

        } else if (type === 'robot-launch') {
            // Hentaman sinematik: dentuman sub-bass + kord C major yang megah + desir udara
            tone({ freq: 110, endFreq: 45, attack: 0.01, decay: 1.8, peak: 0.34, wet: 0.2 });
            [261.63, 329.63, 392.0, 523.25].forEach((f, i) => {
                tone({ freq: f, start: 0.02 + i * 0.03, attack: 0.06, decay: 2.2, peak: 0.07, wet: 0.55 });
            });
            airSwell({ duration: 1.4, peak: 0.06 });
        }
    } catch (e) {
        console.log("Audio error:", e);
    }
}

// Semakan Kod VIP
function triggerAuth() {
    initAudio();
    const enteredCode = accessInput.value.trim();
    if (enteredCode === config.accessCode) {
        authError.style.display = 'none';
        playSound('success');
        switchPhase(2);
        startAISecurityVerification();
    } else {
        playSound('error');
        authError.style.display = 'block';
        accessInput.value = '';
        accessInput.focus();
    }
}

// ---------- Animasi (GSAP) ----------
const hasGSAP = () => typeof gsap !== 'undefined';
const _pct = { v: 0 };
let launchTl = null;

function showCard(card) {
    card.classList.add('active');
    if (!hasGSAP()) return;
    gsap.killTweensOf(card);
    gsap.fromTo(card,
        { opacity: 0, y: 28, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out', clearProps: 'opacity,transform' });
    const items = card.querySelectorAll(':scope > * > *');
    gsap.fromTo(items,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.07, delay: 0.15, ease: 'power2.out', clearProps: 'opacity,transform' });
}

function animatePercent(el, to) {
    if (!hasGSAP()) { el.innerText = to + '%'; return; }
    gsap.to(_pct, {
        v: to, duration: 0.6, ease: 'power1.out', overwrite: true,
        onUpdate: () => { el.innerText = Math.round(_pct.v) + '%'; },
        onComplete: () => { el.innerText = to + '%'; }
    });
}

function popNumber(el) {
    if (hasGSAP()) {
        gsap.fromTo(el, { scale: 1.35, opacity: 0.2 },
            { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(2.2)', overwrite: true });
    }
    if (window.Scene3D) Scene3D.pulse();
}

// Kilat cahaya mengembang dari tengah, tukar ke video, kemudian pudar
function launchTransition(onCovered) {
    const flash = document.getElementById('launchFlash');
    if (!hasGSAP()) { onCovered(); return; }
    flash.style.display = 'block';
    launchTl = gsap.timeline();
    launchTl
        .fromTo(flash, { clipPath: 'circle(0% at 50% 50%)', opacity: 1 },
                       { clipPath: 'circle(150% at 50% 50%)', duration: 0.9, ease: 'power2.in' })
        .add(() => onCovered())
        .to(flash, { opacity: 0, duration: 1.0, ease: 'power1.out' }, '+=0.15')
        .add(() => {
            flash.style.display = 'none';
            gsap.set(flash, { clearProps: 'clipPath,opacity' });
        });
}

function resetFlash() {
    if (launchTl) { launchTl.kill(); launchTl = null; }
    const flash = document.getElementById('launchFlash');
    flash.style.display = 'none';
    if (hasGSAP()) gsap.set(flash, { clearProps: 'clipPath,opacity' });
}

// Pembukaan halaman: tajuk dan kad muncul perlahan
function introAnimation() {
    if (!hasGSAP()) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.frame-border', { opacity: 0, scale: 1.02, duration: 1.2, clearProps: 'opacity,transform' }, 0)
      .from('.bismillah-text', { opacity: 0, y: -10, filter: 'blur(8px)', duration: 1.2, clearProps: 'opacity,transform,filter' }, 0.2)
      .from('.event-title', { opacity: 0, y: 12, letterSpacing: '14px', duration: 1.5, clearProps: 'opacity,transform,letterSpacing' }, 0.4)
      .from('.school-title', { opacity: 0, y: 10, duration: 1, clearProps: 'opacity,transform' }, 0.9)
      .from('.edition-badge', { scale: 0, duration: 0.7, ease: 'back.out(2)', clearProps: 'transform' }, 1.2)
      .from(phaseAuth, { opacity: 0, y: 28, scale: 0.95, duration: 0.9, clearProps: 'opacity,transform' }, 0.8)
      .from('#phase-auth > * > *', { opacity: 0, y: 14, duration: 0.6, stagger: 0.07, clearProps: 'opacity,transform' }, 1.0);
}

const STATUS_TEXT = {
    1: "STATUS: MENUNGGU PENGESAHAN KOD VIP",
    2: "STATUS: AI SECURITY VERIFICATION SEDANG DIJALANKAN...",
    3: "STATUS: LAUNCH SEQUENCE INITIALIZED",
    4: "STATUS: MAJLIS RASMI DILANCARKAN!"
};

function switchPhase(phaseNum) {
    currentPhase = phaseNum;
    const cards = [phaseAuth, phaseScan, phaseCountdown, phaseReveal];
    const next = cards[phaseNum - 1];
    if (hasGSAP()) cards.forEach(c => gsap.killTweensOf(c));
    const prev = cards.find(c => c !== next && c.classList.contains('active'));
    systemStateText.innerText = STATUS_TEXT[phaseNum];

    if (phaseNum === 4) {
        document.getElementById('adminDrawer').classList.remove('open');
        cards.forEach(c => c.classList.remove('active'));
        stageContainer.classList.add('mode-video');
        phaseReveal.classList.add('active');
        if (window.Scene3D) Scene3D.setActive(false);
        return;
    }

    stageContainer.classList.remove('mode-video');
    if (window.Scene3D) { Scene3D.setActive(true); Scene3D.setPhase(phaseNum); }

    const enter = () => {
        cards.forEach(c => { if (c !== next) c.classList.remove('active'); });
        showCard(next);
        if (phaseNum === 1) {
            accessInput.value = '';
            // Elak papan kekunci mobile terbuka sendiri; fokus hanya pada peranti tanpa sentuhan
            if (!window.matchMedia('(pointer: coarse)').matches) accessInput.focus();
        }
    };

    if (prev && phaseNum !== 1 && hasGSAP()) {
        gsap.to(prev, {
            opacity: 0, y: -18, scale: 0.97, duration: 0.3, ease: 'power2.in',
            onComplete: () => { gsap.set(prev, { clearProps: 'opacity,transform' }); enter(); }
        });
    } else {
        enter();
    }
}

// Fasa 2: AI Security Verification & Peratusan
function startAISecurityVerification() {
    const progressBar = document.getElementById('scanProgress');
    const percentDisplay = document.getElementById('percentDisplay');
    const logStatusText = document.getElementById('logStatusText');
    const accessGrantedBox = document.getElementById('accessGrantedBox');

    accessGrantedBox.classList.add('hidden');
    progressBar.style.width = '0%';
    percentDisplay.innerText = '0%';
    _pct.v = 0;
    if (hasGSAP()) gsap.killTweensOf(_pct);
    logStatusText.innerText = 'INITIALIZING...';

    const steps = [
        { percent: 0, text: "INITIALIZING..." },
        { percent: 20, text: "AUTHENTICATING ENCRYPTED CODE..." },
        { percent: 40, text: "CONNECTING TO QURANIC SERVER..." },
        { percent: 60, text: "VERIFYING LAUNCH PROTOCOLS..." },
        { percent: 80, text: "FINALIZING SECURITY CHECKS..." },
        { percent: 100, text: "ACCESS GRANTED" }
    ];

    let stepIndex = 0;

    clearScanTimers();
    scanInterval = setInterval(() => {
        stepIndex++;
        if (stepIndex < steps.length) {
            const currentStep = steps[stepIndex];
            progressBar.style.width = currentStep.percent + '%';
            animatePercent(percentDisplay, currentStep.percent);
            logStatusText.innerText = currentStep.text;
            playSound('scan');
            if (window.Scene3D) Scene3D.progress(currentStep.percent / 100);

            if (currentStep.percent === 100) {
                clearInterval(scanInterval);
                scanInterval = null;
                playSound('robot-launch');
                if (window.Scene3D) Scene3D.pulse();
                accessGrantedBox.classList.remove('hidden');

                scanTimeout = setTimeout(() => {
                    scanTimeout = null;
                    switchPhase(3);
                    start3SecCountdown();
                }, 2200);
            }
        }
    }, 700);
}

function clearScanTimers() {
    if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
    if (scanTimeout) { clearTimeout(scanTimeout); scanTimeout = null; }
}

// Fasa 3: Countdown 3 Saat Dengan Bunyi Robotik
function start3SecCountdown() {
    const totalSeconds = parseInt(config.countdownSeconds) || 3;
    let timeLeft = totalSeconds;
    const countdownEl = document.getElementById('countdownNumber');
    const pathProgress = document.getElementById('timerPathProgress');

    const fullDash = 283;
    resetCountdownRing();
    countdownEl.innerText = timeLeft < 10 ? '0' + timeLeft : timeLeft;
    playSound('robot-tick');
    popNumber(countdownEl);

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            countdownEl.innerText = timeLeft < 10 ? '0' + timeLeft : timeLeft;
            const dashoffset = fullDash - (timeLeft / totalSeconds) * fullDash;
            pathProgress.style.strokeDashoffset = dashoffset;
            playSound('robot-tick');
            popNumber(countdownEl);
        } else {
            clearInterval(timerInterval);
            timerInterval = null;
            countdownEl.innerText = "00";
            pathProgress.style.strokeDashoffset = fullDash;
            popNumber(countdownEl);
            playSound('robot-launch');
            if (window.Scene3D) Scene3D.burst();
            launchTransition(() => {
                switchPhase(4);
                playLaunchVideo();
            });
        }
    }, 1000);
}

// Fasa 4: Play Launch Video
function showVideoError(msg) {
    const box = document.getElementById('videoError');
    document.getElementById('videoErrorText').innerText = msg;
    box.classList.remove('hidden');
}

function hideVideoError() {
    document.getElementById('videoError').classList.add('hidden');
}

// Tukar pautan YouTube biasa (watch / youtu.be) kepada format embed + autoplay
function normalizeYouTubeUrl(url) {
    url = (url || '').trim();
    let m = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([\w-]{6,})/);
    if (m) return 'https://www.youtube.com/embed/' + m[1] + '?autoplay=1';
    if (/youtube\.com\/embed\//.test(url) && !/autoplay=/.test(url)) {
        return url + (url.includes('?') ? '&' : '?') + 'autoplay=1';
    }
    return url;
}

function playLaunchVideo() {
    const videoEl = document.getElementById('launchVideo');
    const iframeEl = document.getElementById('youtubeIframe');
    hideVideoError();

    if (config.videoType === 'youtube') {
        videoEl.pause();
        videoEl.classList.add('hidden');
        iframeEl.classList.remove('hidden');
        iframeEl.src = normalizeYouTubeUrl(config.videoUrl);
    } else {
        iframeEl.classList.add('hidden');
        iframeEl.removeAttribute('src');
        videoEl.classList.remove('hidden');
        const source = document.getElementById('videoSource');
        source.src = config.videoUrl;
        videoEl.load(); // wajib supaya URL baharu dimuat

        videoEl.currentTime = 0;
        videoEl.muted = true;
        
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                setTimeout(() => {
                    videoEl.muted = false;
                }, 150);
            }).catch((error) => {
                console.log("Autoplay fallback:", error);
                if (error && error.name === 'NotSupportedError') return; // ditangani oleh handler ralat
                // Autoplay disekat: biar pengguna tekan butang play pada kawalan video
                videoEl.muted = false;
                videoEl.play().catch(() => {});
            });
        }
    }
}

// Ralat video: fail tiada / format tidak disokong
(function attachVideoErrorHandlers() {
    const videoEl = document.getElementById('launchVideo');
    const source = document.getElementById('videoSource');
    const onFail = () => showVideoError('Video tidak dapat dimuat. Semak fail "' + config.videoUrl + '" berada dalam folder yang sama.');
    videoEl.addEventListener('error', onFail);
    source.addEventListener('error', onFail);
})();

function retryVideo() {
    playLaunchVideo();
}

// Admin Panel Controls
function toggleAdminDrawer() {
    const drawer = document.getElementById('adminDrawer');
    drawer.classList.toggle('open');
}

function onVideoTypeChange() {
    const type = document.getElementById('settingVideoType').value;
    const inputUrl = document.getElementById('settingVideoUrl');
    if (type === 'youtube') {
        inputUrl.value = "";
        inputUrl.placeholder = "Tampal pautan YouTube di sini";
    } else {
        inputUrl.value = "launch.mp4";
    }
}

function populateSettingsForm() {
    document.getElementById('settingAccessCode').value = config.accessCode;
    document.getElementById('settingVideoType').value = config.videoType;
    document.getElementById('settingVideoUrl').value = config.videoUrl;
    document.getElementById('settingCountdownTime').value = config.countdownSeconds;
    document.getElementById('settingQuality').value = config.quality || 'high';
}

function saveSettings() {
    const type = document.getElementById('settingVideoType').value;
    const url = document.getElementById('settingVideoUrl').value.trim();
    if (!url) {
        alert('Sila isi URL / nama fail video dahulu.');
        return;
    }
    config.accessCode = document.getElementById('settingAccessCode').value.trim() || DEFAULT_CONFIG.accessCode;
    config.videoType = type;
    config.videoUrl = url;
    config.countdownSeconds = Math.min(10, Math.max(1, parseInt(document.getElementById('settingCountdownTime').value) || 3));
    const newQuality = document.getElementById('settingQuality').value;
    const qualityChanged = newQuality !== (config.quality || 'high');
    config.quality = newQuality;
    persistConfig();
    populateSettingsForm();

    alert('Tetapan Gimik Pelancaran Berjaya Disimpan!' + (qualityChanged ? '\nMuat semula halaman untuk menggunakan kualiti animasi baharu.' : ''));
    toggleAdminDrawer();
}

function resetCountdownRing() {
    const pathProgress = document.getElementById('timerPathProgress');
    pathProgress.style.transition = 'none';
    pathProgress.style.strokeDashoffset = 0;
    void pathProgress.getBoundingClientRect(); // paksa reflow supaya tiada animasi semasa reset
    pathProgress.style.transition = '';
}

function resetToPhase1() {
    // Hentikan semua pemasa dan animasi yang sedang berjalan
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    clearScanTimers();
    resetFlash();
    _pct.v = 0;
    if (hasGSAP()) gsap.killTweensOf(_pct);

    // Hentikan video & iframe YouTube (supaya bunyi tidak terus berjalan)
    const videoEl = document.getElementById('launchVideo');
    const iframeEl = document.getElementById('youtubeIframe');
    videoEl.pause();
    try { videoEl.currentTime = 0; } catch (e) {}
    iframeEl.removeAttribute('src');
    iframeEl.classList.add('hidden');
    hideVideoError();

    // Reset paparan fasa 2 & 3
    document.getElementById('scanProgress').style.width = '0%';
    document.getElementById('percentDisplay').innerText = '0%';
    document.getElementById('logStatusText').innerText = 'INITIALIZING...';
    document.getElementById('accessGrantedBox').classList.add('hidden');
    resetCountdownRing();
    const cd = parseInt(config.countdownSeconds) || 3;
    document.getElementById('countdownNumber').innerText = cd < 10 ? '0' + cd : cd;

    switchPhase(1);
    document.getElementById('adminDrawer').classList.remove('open');
}

// Panel SETTING disembunyikan semasa majlis. Buka dengan Ctrl+Shift+S
// atau muatkan halaman dengan ?admin=1 untuk papar butang SETTING.
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        toggleAdminDrawer();
    } else if (e.key === 'Escape') {
        document.getElementById('adminDrawer').classList.remove('open');
    }
});

if (new URLSearchParams(window.location.search).get('admin') === '1') {
    document.body.classList.add('show-admin');
}

populateSettingsForm();

// Togol tema cerah / gelap (pilihan diingati dalam pelayar)
const THEME_KEY = "skmj2026_theme";

function applyTheme(theme) {
    const light = theme === 'light';
    document.body.classList.toggle('theme-light', light);
    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.querySelector('i').className = light ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
        btn.querySelector('span').innerText = light ? 'MOD GELAP' : 'MOD CERAH';
    }
    if (typeof particles !== 'undefined') particles.forEach(p => p.recolor()); // warna kelopak ikut tema
    if (window.Scene3D) Scene3D.setTheme(light);
}

function toggleTheme() {
    const next = document.body.classList.contains('theme-light') ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    // Pulangkan fokus ke kotak kod supaya Enter tidak menekan butang semula
    if (document.activeElement) document.activeElement.blur();
    if (currentPhase === 1 && !window.matchMedia('(pointer: coarse)').matches) accessInput.focus();
}

// Canvas Background Particles
const bgCanvas = document.getElementById('bgCanvas');
const ctx = bgCanvas.getContext('2d');
let particles = [];

function resizeCanvas() {
    bgCanvas.width = bgCanvas.offsetWidth;
    bgCanvas.height = bgCanvas.offsetHeight;
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);
resizeCanvas();

// Kelopak strawberi & daun matcha yang gugur perlahan
class Petal {
    constructor() { this.reset(true); }
    recolor() {
        const light = document.body.classList.contains('theme-light');
        if (this.type === 'petal') this.color = light ? '#e65c7b' : '#ff8ca3';
        else this.color = light ? '#3a9a73' : '#6fbf73';
    }
    reset(initial) {
        this.type = Math.random() > 0.5 ? 'petal' : 'leaf';
        this.x = Math.random() * bgCanvas.width;
        this.y = initial ? Math.random() * bgCanvas.height : -20;
        this.size = Math.random() * 7 + 6;
        this.fall = Math.random() * 0.45 + 0.2;
        this.sway = Math.random() * 1.2 + 0.4;
        this.phase = Math.random() * Math.PI * 2;
        this.rot = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.02;
        this.alpha = Math.random() * 0.3 + 0.2;
        this.recolor();
    }
    update() {
        this.phase += 0.012;
        this.y += this.fall;
        this.x += Math.sin(this.phase) * this.sway * 0.5;
        this.rot += this.rotSpeed;
        if (this.y > bgCanvas.height + 30) this.reset(false);
    }
    draw() {
        const s = this.size;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        if (this.type === 'petal') {
            ctx.moveTo(0, -s);
            ctx.bezierCurveTo(s * 0.9, -s * 0.4, s * 0.7, s * 0.7, 0, s);
            ctx.bezierCurveTo(-s * 0.7, s * 0.7, -s * 0.9, -s * 0.4, 0, -s);
        } else {
            ctx.moveTo(0, -s);
            ctx.quadraticCurveTo(s * 0.8, 0, 0, s);
            ctx.quadraticCurveTo(-s * 0.8, 0, 0, -s);
        }
        ctx.fill();
        ctx.restore();
    }
}

const PETAL_COUNT = config.quality === 'low' ? 12 : 28;
for (let i = 0; i < PETAL_COUNT; i++) particles.push(new Petal());

function animateParticles() {
    requestAnimationFrame(animateParticles);
    if (currentPhase === 4) return; // video: tidak perlu lukis latar
    ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    particles.forEach(p => {
        p.update();
        p.draw();
    });
}
animateParticles();

// Papar keadaan butang togol mengikut tema semasa
if (window.Scene3D) Scene3D.init({ quality: config.quality });
applyTheme(document.body.classList.contains('theme-light') ? 'light' : 'dark');
introAnimation();
