/* ==========================================================================
   MAJLIS KHATAM AL-QURAN SK MERPATI JEPANG 2026 - GIMIK SCRIPT
   Robotic Sound FX Engine & Confetti Free Version
   ========================================================================== */

   const DEFAULT_CONFIG = {
    accessCode: "SKMJ2026",
    countdownSeconds: 3,
    videoType: "direct",
    videoUrl: "launch.mp4"
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

function switchPhase(phaseNum) {
    currentPhase = phaseNum;
    [phaseAuth, phaseScan, phaseCountdown, phaseReveal].forEach(p => p.classList.remove('active'));

    if (phaseNum === 1) {
        stageContainer.classList.remove('mode-video');
        phaseAuth.classList.add('active');
        systemStateText.innerText = "STATUS: MENUNGGU PENGESAHAN KOD VIP";
        accessInput.value = '';
        // Elak papan kekunci mobile terbuka sendiri; fokus hanya pada peranti tanpa sentuhan
        if (!window.matchMedia('(pointer: coarse)').matches) accessInput.focus();
    } else if (phaseNum === 2) {
        stageContainer.classList.remove('mode-video');
        phaseScan.classList.add('active');
        systemStateText.innerText = "STATUS: AI SECURITY VERIFICATION SEDANG DIJALANKAN...";
    } else if (phaseNum === 3) {
        stageContainer.classList.remove('mode-video');
        phaseCountdown.classList.add('active');
        systemStateText.innerText = "STATUS: LAUNCH SEQUENCE INITIALIZED";
    } else if (phaseNum === 4) {
        document.getElementById('adminDrawer').classList.remove('open');
        stageContainer.classList.add('mode-video');
        phaseReveal.classList.add('active');
        systemStateText.innerText = "STATUS: MAJLIS RASMI DILANCARKAN!";
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
            percentDisplay.innerText = currentStep.percent + '%';
            logStatusText.innerText = currentStep.text;
            playSound('scan');

            if (currentStep.percent === 100) {
                clearInterval(scanInterval);
                scanInterval = null;
                playSound('robot-launch');
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

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            countdownEl.innerText = timeLeft < 10 ? '0' + timeLeft : timeLeft;
            const dashoffset = fullDash - (timeLeft / totalSeconds) * fullDash;
            pathProgress.style.strokeDashoffset = dashoffset;
            playSound('robot-tick');
        } else {
            clearInterval(timerInterval);
            countdownEl.innerText = "00";
            pathProgress.style.strokeDashoffset = fullDash;
            playSound('robot-launch');
            switchPhase(4);
            playLaunchVideo();
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
    persistConfig();
    populateSettingsForm();

    alert('Tetapan Gimik Pelancaran Berjaya Disimpan!');
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
    // Hentikan semua pemasa yang sedang berjalan
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    clearScanTimers();

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


class Particle {
    constructor() { this.reset(); }
    reset() {
        this.x = Math.random() * bgCanvas.width;
        this.y = Math.random() * bgCanvas.height;
        this.size = Math.random() * 3 + 1;
        this.speedY = Math.random() * 0.8 + 0.2;
        this.speedX = (Math.random() - 0.5) * 0.5;
        const light = document.body.classList.contains('theme-light');
        const green = light ? 'rgba(58, 154, 115, ' : 'rgba(72, 130, 64, ';
        this.color = Math.random() > 0.5 ? 'rgba(230, 92, 123, ' : green;
        this.alpha = Math.random() * 0.6 + 0.2;
    }
    update() {
        this.y -= this.speedY;
        this.x += this.speedX;
        if (this.y < 0) this.reset();
    }
    draw() {
        ctx.fillStyle = this.color + this.alpha + ')';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

for (let i = 0; i < 40; i++) particles.push(new Particle());

function animateParticles() {
    ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    particles.forEach(p => {
        p.update();
        p.draw();
    });
    requestAnimationFrame(animateParticles);
}
animateParticles();

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
    particles.forEach(p => p.reset());
}

function toggleTheme() {
    const next = document.body.classList.contains('theme-light') ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    // Pulangkan fokus ke kotak kod supaya Enter tidak menekan butang semula
    if (document.activeElement) document.activeElement.blur();
    if (currentPhase === 1 && !window.matchMedia('(pointer: coarse)').matches) accessInput.focus();
}

// Papar keadaan butang togol mengikut tema semasa
applyTheme(document.body.classList.contains('theme-light') ? 'light' : 'dark');
