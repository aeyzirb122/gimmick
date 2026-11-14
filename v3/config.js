/* ==========================================================================
   TETAPAN GIMIK PELANCARAN  -  edit fail ini sahaja (Notepad pun boleh)
   Simpan, kemudian muat semula halaman (F5).
   ========================================================================== */
window.LAUNCH_CONFIG = {
    // Video pelancaran
    videoType: "direct",        // "direct" = fail dalam folder ini, "youtube" = pautan YouTube
    videoUrl: "launch.mp4",     // nama fail, atau pautan YouTube penuh

    // Upacara
    holdSeconds: 2,             // berapa saat VIP perlu menekan & menahan
    countdownSeconds: 3,        // kiraan detik selepas ditahan
    backupCode: "SKMJ2026",     // taip kod ini pada papan kekunci untuk memulakan tanpa menahan (sandaran)

    // Paparan
    defaultTheme: "light",      // "light" (cerah) atau "dark" (gelap)
    quality: "high",            // "high" atau "low" (kurangkan kelopak/zarah jika komputer perlahan)
    autoFullscreen: true        // masuk skrin penuh pada tekanan pertama
};
