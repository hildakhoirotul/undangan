document.addEventListener('DOMContentLoaded', function () {

    // =========================================================
    // PENGATURAN (gampang di-tweak di sini)
    // =========================================================

    // Jeda setelah tombol "Buka Undangan" diklik sampai pintu mulai
    // kebuka (waktu buat gunungan nyatu lagi)
    const MERGE_MS = 1500;

    // Auto scroll: mulai berapa ms setelah pintu selesai kebuka
    // (nunggu animasi section pertama selesai + tulisan "Auto Scroll is on" muncul)
    const AUTOSCROLL_DELAY = 10500;

    // Kecepatan auto scroll (pixel per detik)
    const AUTOSCROLL_SPEED = 45;

    // Auto scroll nunggu segini lama setelah user terakhir nyentuh/scroll
    const AUTOSCROLL_RESUME = 2500;

    // Aset yang di-fade-in pelan-pelan waktu discroll
    const REVEAL_SELECTORS = [
        '.section-bride .wayang-decoration',
        '.section-groom .wayang-decoration',
        '.section-divider-ring img',
        '.place-canvas-wrapper',
        '.place-joglo',
        '.story-main-title',
        '.story-item',
        '.footprint-1',
        '.footprint-2',
        '.gift-flower-frame',
        '.ucapan-butterflies',
        '.ucapan-card'
    ];


    // =========================================================
    // HELPER
    // =========================================================

    // Jalankan callback sekali aja, begitu elemen masuk layar
    function observeOnce(el, threshold, callback) {
        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                callback(entry.target);
                observer.unobserve(entry.target);
            });
        }, { threshold: threshold });

        observer.observe(el);
    }

    // Baca durasi dari CSS variable (misal "3.2s" / "800ms") jadi milidetik
    function cssTimeMs(name) {
        const raw = getComputedStyle(document.documentElement)
            .getPropertyValue(name).trim();
        const value = parseFloat(raw) || 0;
        return raw.endsWith('ms') ? value : value * 1000;
    }

    function createSparkles(container, total) {
        for (let i = 0; i < total; i++) {
            const sparkle = document.createElement('span');
            const size = Math.random() * 5 + 3;

            sparkle.classList.add('sparkle');
            sparkle.style.left = Math.random() * 100 + '%';
            sparkle.style.top = Math.random() * 100 + '%';
            sparkle.style.width = size + 'px';
            sparkle.style.height = size + 'px';
            sparkle.style.animationDelay = Math.random() * 4 + 's';
            sparkle.style.setProperty('--duration', (2 + Math.random() * 3) + 's');
            sparkle.style.setProperty('--move-duration', (4 + Math.random() * 5) + 's');

            container.appendChild(sparkle);
        }
    }


    // =========================================================
    // SELALU MULAI DARI COVER
    // ---------------------------------------------------------
    // Browser biasanya "mengingat" posisi scroll terakhir waktu
    // halaman di-reload. Kita matikan, supaya reload selalu
    // balik ke cover (bukan nyasar ke halaman kosong).
    // =========================================================

    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);


    // =========================================================
    // ELEMEN YANG DIPAKAI
    // =========================================================

    const root = document.documentElement;
    const cover = document.querySelector('.cover');
    const openButton = document.getElementById('openInvitationBtn');
    const invitationPage = document.getElementById('invitationPage');

    const floatControls = document.getElementById('floatControls');
    const btnAutoScroll = document.getElementById('btnAutoScroll');
    const btnMusic = document.getElementById('btnMusic');
    const scrollText = document.getElementById('scrollText');
    const music = document.getElementById('bgMusic');

    // =========================================================
    // NAMA TAMU DARI LINK
    // ---------------------------------------------------------
    // Contoh: index.html?to=Budi+Santoso  atau  ?to=Budi%20Santoso
    // Dipakai di "Kepada Yth." dan jadi isi awal kolom nama ucapan.
    // Tanpa ?to= tulisan bawaan di HTML tetap dipakai.
    // =========================================================

    const guestName = (new URLSearchParams(location.search).get('to') || '')
        .trim()
        .slice(0, 60);

    if (guestName) {
        const nameEl = document.querySelector('.invitation-name');
        const nameInput = document.getElementById('ucapanNama');

        // textContent (bukan innerHTML) supaya aman dari injeksi lewat URL
        if (nameEl) nameEl.textContent = guestName;

        // defaultValue: tetap bisa diedit tamu, dan balik lagi ke nama ini
        // setelah ucapan terkirim
        if (nameInput) nameInput.defaultValue = guestName;
    }


    // =========================================================
    // SPARKLE (cover, section doa, ucapan)
    // =========================================================

    document.querySelectorAll('.sparkles, .ucapan-sparkles').forEach(function (container) {
        createSparkles(container, 25);
    });


    // =========================================================
    // ANIMASI KUPU-KUPU (cover)
    // =========================================================

    const kupu = document.querySelector('.butterflies');
    const coverSparkles = document.querySelector('.cover .sparkles');

    if (kupu) {

        const startDelay = 4200;     // tunggu opening selesai
        const gifDuration = 3800;    // sesuaikan dengan durasi GIF kamu
        const fadeDuration = 1500;   // durasi fade in & fade out
        const pauseDuration = 1500;  // jeda setelah kupu-kupu menghilang

        function startButterfly() {

            // Reset GIF ke frame pertama
            kupu.src = './assets/images/kupu5.gif?t=' + Date.now();

            // Pastikan dalam kondisi hidden dulu
            kupu.classList.remove('show');
            kupu.classList.add('hide');

            // Tunggu 1 frame supaya browser membaca perubahan src + opacity
            requestAnimationFrame(function () {
                kupu.classList.remove('hide');
                kupu.classList.add('show');
            });

            // Tunggu GIF selesai -> fade out -> jeda -> ulang
            setTimeout(function () {
                kupu.classList.remove('show');
                kupu.classList.add('hide');

                setTimeout(startButterfly, fadeDuration + pauseDuration);
            }, gifDuration);
        }

        setTimeout(function () {
            startButterfly();

            // Sparkle mulai bersamaan dengan kupu-kupu
            if (coverSparkles) {
                coverSparkles.classList.add('show');
            }
        }, startDelay);
    }


    // =========================================================
    // MUSIK
    // =========================================================

    let resumeMusicWhenVisible = false;

    function setMusicButton(isOn) {
        if (!btnMusic) return;
        btnMusic.classList.toggle('is-off', !isOn);
        btnMusic.setAttribute('aria-pressed', String(isOn));
        btnMusic.title = isOn ? 'Pause musik' : 'Putar musik';
    }

    function playMusic() {
        if (!music) return;

        const promise = music.play();

        // Kalau diblokir browser / file belum ada, tombol tampil "mati"
        if (promise && promise.catch) {
            promise.catch(function () {
                setMusicButton(false);
            });
        }
    }

    if (music) {
        // Tombol selalu ngikutin kondisi musik yang sebenarnya
        music.addEventListener('play', function () { setMusicButton(true); });
        music.addEventListener('pause', function () { setMusicButton(false); });

        // Musik berhenti sendiri kalau tab/aplikasi ditinggal, lanjut pas balik
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                resumeMusicWhenVisible = !music.paused;
                music.pause();
            } else if (resumeMusicWhenVisible) {
                resumeMusicWhenVisible = false;
                playMusic();
            }
        });
    }

    if (btnMusic) {
        btnMusic.addEventListener('click', function () {
            if (!music) return;

            if (music.paused) {
                playMusic();
            } else {
                music.pause();
            }
        });
    }


    // =========================================================
    // AUTO SCROLL
    // =========================================================

    let autoOn = true;       // kondisi tombol (aktif / nonaktif)
    let autoReady = false;   // baru true setelah intro section pertama selesai
    let holdUntil = 0;       // auto scroll "ngalah" sampai waktu ini (user lagi pegang)
    let lastTime = 0;
    let scrollPos = 0;

    function setAutoScroll(isOn) {
        autoOn = isOn;

        if (btnAutoScroll) {
            btnAutoScroll.classList.toggle('is-off', !isOn);
            btnAutoScroll.setAttribute('aria-pressed', String(isOn));
            btnAutoScroll.title = isOn ? 'Matikan auto scroll' : 'Nyalakan auto scroll';
        }

        if (scrollText) {
            scrollText.textContent = 'Auto Scroll is ' + (isOn ? 'on' : 'off');
        }
    }

    // Auto scroll berhenti sebentar tiap user nyentuh / scroll / pencet tombol
    function holdAutoScroll() {
        holdUntil = performance.now() + AUTOSCROLL_RESUME;
    }

    ['touchstart', 'touchmove', 'wheel', 'mousedown', 'keydown'].forEach(function (type) {
        window.addEventListener(type, function (event) {
            // klik tombol melayang jangan dianggap "user lagi scroll"
            if (floatControls && floatControls.contains(event.target)) return;
            holdAutoScroll();
        }, { passive: true });
    });

    function autoScrollLoop(time) {
        requestAnimationFrame(autoScrollLoop);

        // dibatasi 100ms supaya nggak "loncat" kalau tab baru aja balik
        const delta = lastTime ? Math.min(time - lastTime, 100) : 0;
        lastTime = time;

        // Lagi ngetik ucapan? Jangan digeser
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
            holdAutoScroll();
        }

        // Nggak aktif / user lagi pegang -> cuma sinkron posisi
        if (!autoOn || !autoReady || time < holdUntil) {
            scrollPos = window.scrollY;
            return;
        }

        // Ada scroll dari luar (scrollbar, momentum jari) -> ngalah
        if (Math.abs(window.scrollY - scrollPos) > 2) {
            holdAutoScroll();
            scrollPos = window.scrollY;
            return;
        }

        const maxScroll = root.scrollHeight - window.innerHeight;

        // Sudah sampai paling bawah -> matikan sendiri
        if (scrollPos >= maxScroll - 1) {
            setAutoScroll(false);
            return;
        }

        scrollPos = Math.min(maxScroll, scrollPos + AUTOSCROLL_SPEED * delta / 1000);

        // 'instant' wajib: Bootstrap memasang scroll-behavior: smooth
        window.scrollTo({ top: scrollPos, behavior: 'instant' });
    }

    requestAnimationFrame(autoScrollLoop);

    if (btnAutoScroll) {
        btnAutoScroll.addEventListener('click', function () {
            setAutoScroll(!autoOn);
        });
    }


    // =========================================================
    // BUKA UNDANGAN
    // ---------------------------------------------------------
    // 1. gunungan nyatu lagi + semua elemen cover memudar
    // 2. pintu kebuka pelan (durasi dari --door-duration di CSS),
    //    halaman isi sudah siap di belakangnya
    // 3. pintu selesai -> cover dibuang, scroll dibuka, animasi
    //    section pertama mulai, tombol melayang muncul, dan
    //    auto scroll disiapkan
    // =========================================================

    if (openButton && cover) {

        let opened = false;

        openButton.addEventListener('click', function () {

            if (opened) return;
            opened = true;

            cover.classList.add('closing');

            // Klik ini = izin dari user, jadi musik boleh langsung main
            playMusic();

            // Pintu mulai kebuka
            setTimeout(function () {
                cover.classList.add('opening-active');

                if (invitationPage) {
                    invitationPage.classList.add('show');
                }

                window.scrollTo(0, 0);
            }, MERGE_MS);

            // Pintu selesai kebuka (+150ms delay opacity di CSS, +100ms cadangan)
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const doorMs = reduceMotion ? 300 : cssTimeMs('--door-duration') + 250;

            setTimeout(function () {
                cover.classList.add('cover-hidden');
                root.classList.remove('is-locked');

                if (invitationPage) {
                    invitationPage.classList.add('started');
                }

                if (floatControls) {
                    floatControls.classList.add('show');
                }

                setTimeout(function () {
                    scrollPos = window.scrollY;
                    autoReady = true;
                }, AUTOSCROLL_DELAY);

            }, MERGE_MS + doorMs);
        });
    }


    // =========================================================
    // ANIMASI SECTION SAAT DI-SCROLL (class "animate", sekali aja)
    // ---------------------------------------------------------
    // [selector, threshold]
    // =========================================================

    [
        ['.section-doa', 0.3],
        ['.section-bride', 0.25],
        ['.section-groom', 0.25],
        ['.section-foto', 0.25],
        ['.section-gift', 0.25],
        ['.section-ucapan', 0.25]
    ].forEach(function (item) {
        const section = document.querySelector(item[0]);

        if (section) {
            observeOnce(section, item[1], function (el) {
                el.classList.add('animate');
            });
        }
    });


    // =========================================================
    // FADE-IN BIASA UNTUK ASET (lihat REVEAL_SELECTORS di atas)
    // =========================================================

    document.querySelectorAll(REVEAL_SELECTORS.join(',')).forEach(function (el) {
        el.classList.add('reveal');

        observeOnce(el, 0.1, function (target) {
            target.classList.add('in-view');
        });
    });


    // =========================================================
    // COUNTDOWN
    // =========================================================

    const targetDate = new Date('2027-01-03T08:00:00+07:00').getTime();

    const countdownEls = {
        days: document.getElementById('days'),
        hours: document.getElementById('hours'),
        minutes: document.getElementById('minutes'),
        seconds: document.getElementById('seconds')
    };

    function pad(number) {
        return String(number).padStart(2, '0');
    }

    function updateCountdown() {
        const distance = Math.max(targetDate - Date.now(), 0);

        const values = {
            days: Math.floor(distance / 86400000),
            hours: Math.floor((distance % 86400000) / 3600000),
            minutes: Math.floor((distance % 3600000) / 60000),
            seconds: Math.floor((distance % 60000) / 1000)
        };

        Object.keys(countdownEls).forEach(function (key) {
            if (countdownEls[key]) {
                countdownEls[key].textContent = pad(values[key]);
            }
        });
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);


    // =========================================================
    // TAB AKAD / RESEPSI
    // =========================================================

    const placeTabs = document.querySelectorAll('.place-tab');
    const placePanels = document.querySelectorAll('.place-panel');

    placeTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {

            placeTabs.forEach(function (item) {
                item.classList.remove('active');
            });
            tab.classList.add('active');

            placePanels.forEach(function (panel) {
                panel.classList.remove('active');
            });

            const targetPanel = document.getElementById('place-' + tab.getAttribute('data-place'));

            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });


    // =========================================================
    // GALLERY: PAUSE / START
    // =========================================================

    const galleryTrack = document.querySelector('.gallery-track');
    const galleryPause = document.getElementById('galleryPause');
    const galleryStart = document.getElementById('galleryStart');

    if (galleryTrack && galleryPause && galleryStart) {

        galleryPause.addEventListener('click', function () {
            galleryTrack.style.animationPlayState = 'paused';
            galleryPause.classList.add('active');
            galleryStart.classList.remove('active');
        });

        galleryStart.addEventListener('click', function () {
            galleryTrack.style.animationPlayState = 'running';
            galleryStart.classList.add('active');
            galleryPause.classList.remove('active');
        });
    }

    // Catatan: tombol pilihan "Hadir / Tidak Hadir" sekarang
    // sepenuhnya di-handle script Firebase di index.html
    // (sebelumnya ada dua handler yang kerjanya dobel).
});