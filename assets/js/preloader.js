/* =========================================================
   PRELOADER
   ---------------------------------------------------------
   Alur:
   1. Loading screen tampil. Aset TAHAP WAJIB dimuat dulu:
      semua yang dipakai cover + section pertama + font.
      Progress bar jalan sesuai berapa aset yang sudah selesai.
   2. Selesai -> loading screen memudar, animasi cover mulai.
   3. Aset sisanya (section doa sampai ucapan, musik, video)
      dimuat DI BELAKANG LAYAR, berurutan sesuai urutan section,
      jadi biasanya sudah siap sebelum tamu sampai ke sana.

   Daftar aset dikumpulkan OTOMATIS dari halaman: tag <img>,
   <video>, dan semua background-image di CSS. Jadi kalau nanti
   nambah gambar/section baru, nggak perlu mendaftarkan apa-apa.
   ========================================================= */

(function () {
    'use strict';

    // ---------------------------------------------------------
    // PENGATURAN
    // ---------------------------------------------------------
    var CONFIG = {
        // true  = loading screen menunggu SEMUA aset (bisa sangat lama
        //         kalau ukuran total aset besar, apalagi di data seluler)
        // false = hanya tahap wajib, sisanya di belakang layar (disarankan)
        PRELOAD_ALL: false,

        // Loading screen minimal tampil segini lama (ms), biar nggak
        // berkedip kalau semua aset sudah ada di cache
        MIN_SHOW_MS: 900,

        // Satu aset yang macet dilewati setelah segini lama (ms)
        ASSET_TIMEOUT_MS: 30000,

        // Batas total menunggu tahap wajib (ms). Lewat dari ini, undangan
        // tetap dibuka walaupun ada aset yang belum selesai.
        CRITICAL_TIMEOUT_MS: 25000,

        // Berapa aset yang diunduh bersamaan di belakang layar
        BACKGROUND_CONCURRENCY: 2,

        // Unduhan latar belakang baru mulai segini lama (ms) setelah loading
        // screen hilang, supaya animasi pembuka cover berjalan mulus dulu
        BACKGROUND_START_DELAY_MS: 3000,

        // Font yang dipakai undangan (dimuat di tahap wajib)
        FONTS: [
            '1em "Satisfy"', '1em "Story Script"', '1em "Comforter"',
            '1em "Space Mono"', 'italic 1em "Space Mono"', 'bold 1em "Space Mono"',
            '1em "Montserrat"'
        ]
    };

    var root = document.documentElement;
    var loader = document.getElementById('preloader');
    var bar = document.getElementById('preloaderBar');
    var percentText = document.getElementById('preloaderPercent');
    var guestText = document.getElementById('preloaderGuest');

    var isDone = false;
    var doneCallbacks = [];

    // Dipakai main.js: jalankan sesuatu SETELAH loading screen selesai
    window.whenInvitationLoaded = function (callback) {
        if (isDone) {
            callback();
        } else {
            doneCallbacks.push(callback);
        }
    };

    // Tanpa elemen loading screen, jangan menahan apa pun
    if (!loader) {
        root.classList.remove('is-loading');
        isDone = true;
        return;
    }


    // ---------------------------------------------------------
    // HELPER
    // ---------------------------------------------------------
    function withTimeout(promise, ms) {
        return new Promise(function (resolve) {
            var timer = setTimeout(resolve, ms);
            promise.then(function () {
                clearTimeout(timer);
                resolve();
            }, function () {
                clearTimeout(timer);
                resolve();
            });
        });
    }

    function wait(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function absoluteUrl(url) {
        return new URL(url, document.baseURI).href;
    }


    // ---------------------------------------------------------
    // MENGUMPULKAN DAFTAR ASET
    // ---------------------------------------------------------
    function collectAssets() {
        var critical = new Map();     // url -> { url, type, el }
        var background = new Map();

        function add(rawUrl, type, el) {
            if (!rawUrl || rawUrl.indexOf('data:') === 0) return;

            var url = absoluteUrl(rawUrl);
            var item = { url: url, type: type, el: el };

            // Cover & section pertama = tahap wajib. Selain itu = latar belakang.
            // Video tidak pernah masuk tahap wajib (ukurannya besar).
            if (type !== 'video' && el.closest('.cover, .section-opening')) {
                item.critical = true;
                background.delete(url);
                critical.set(url, item);
            } else if (!critical.has(url) && !background.has(url)) {
                background.set(url, item);
            }
        }

        // querySelectorAll mengembalikan urutan dokumen = urutan section
        document.querySelectorAll('*').forEach(function (el) {
            var tag = el.tagName;

            if (tag === 'IMG') {
                add(el.getAttribute('src'), 'image', el);
            } else if (tag === 'VIDEO') {
                var source = el.querySelector('source');
                if (source) {
                    add(source.getAttribute('data-src') || source.getAttribute('src'), 'video', el);
                }
            }

            // background-image dari CSS (termasuk yang ada di section tersembunyi)
            var bg = getComputedStyle(el).backgroundImage;
            if (bg && bg !== 'none') {
                var pattern = /url\((['"]?)(.*?)\1\)/g;
                var match;
                while ((match = pattern.exec(bg))) {
                    add(match[2], 'image', el);
                }
            }
        });

        return {
            critical: Array.from(critical.values()),
            background: Array.from(background.values())
        };
    }


    // ---------------------------------------------------------
    // MEMUAT ASET
    // ---------------------------------------------------------
    function loadImage(url, decode) {
        return new Promise(function (resolve) {
            var img = new Image();

            img.onload = function () {
                // decode() = gambar sudah siap tampil, nggak perlu diproses lagi
                // waktu pertama dilihat (mencegah "kedip" di HP lambat).
                // Hanya untuk tahap wajib; di latar belakang cukup diunduh
                // supaya tidak membebani prosesor HP.
                if (decode && img.decode) {
                    img.decode().then(resolve, resolve);
                } else {
                    resolve();
                }
            };
            img.onerror = resolve;
            img.src = url;
        });
    }

    // Video dimuat belakangan: sumbernya baru dipasang saat diperlukan
    // (atribut data-src), supaya tidak berebut koneksi dengan aset cover.
    function activateVideo(video) {
        var source = video.querySelector('source[data-src]');
        if (!source) return false;

        source.src = source.getAttribute('data-src');
        source.removeAttribute('data-src');
        video.preload = 'auto';
        video.load();

        var played = video.play();
        if (played && played.catch) played.catch(function () { });

        return true;
    }

    function loadVideo(video) {
        return new Promise(function (resolve) {
            if (!activateVideo(video) && video.readyState >= 4) {
                return resolve();
            }
            video.addEventListener('canplaythrough', function () { resolve(); }, { once: true });
            video.addEventListener('error', function () { resolve(); }, { once: true });
        });
    }

    function loadAsset(asset) {
        var job = asset.type === 'video' ? loadVideo(asset.el) : loadImage(asset.url, asset.critical);
        return withTimeout(job, CONFIG.ASSET_TIMEOUT_MS);
    }

    function loadFonts() {
        if (!document.fonts || !document.fonts.load) return Promise.resolve();

        return Promise.all(CONFIG.FONTS.map(function (font) {
            return document.fonts.load(font).catch(function () { });
        }));
    }


    // ---------------------------------------------------------
    // PROGRESS BAR
    // ---------------------------------------------------------
    var targetProgress = 0;
    var shownProgress = 0;
    var progressFinished;
    var progressPromise = new Promise(function (resolve) { progressFinished = resolve; });

    function setProgress(value) {
        targetProgress = Math.min(1, value);
    }

    function renderProgress() {
        // bergerak halus mengejar nilai sebenarnya
        shownProgress += (targetProgress - shownProgress) * 0.15;
        if (targetProgress - shownProgress < 0.002) shownProgress = targetProgress;

        if (bar) bar.style.transform = 'scaleX(' + shownProgress + ')';
        if (percentText) percentText.textContent = Math.round(shownProgress * 100) + '%';

        if (shownProgress >= 1) {
            progressFinished();
        } else {
            requestAnimationFrame(renderProgress);
        }
    }


    // ---------------------------------------------------------
    // TAHAP WAJIB
    // ---------------------------------------------------------
    function runCritical(list) {
        var total = list.length + 1;     // +1 = font
        var finished = 0;

        function tick() {
            finished++;
            setProgress(finished / total);
        }

        var jobs = list.map(function (asset) {
            return loadAsset(asset).then(tick);
        });
        jobs.push(withTimeout(loadFonts(), 8000).then(tick));

        // Kalau ada yang macet, tetap lanjut setelah batas waktu
        return withTimeout(Promise.all(jobs), CONFIG.CRITICAL_TIMEOUT_MS)
            .then(function () { setProgress(1); });
    }


    // ---------------------------------------------------------
    // LATAR BELAKANG (setelah loading screen hilang)
    // ---------------------------------------------------------
    function runBackground(list) {
        // Mode hemat data di browser: jangan unduh diam-diam
        var connection = navigator.connection || {};
        if (connection.saveData) return;

        // Musik mulai diunduh paling awal
        var music = document.getElementById('bgMusic');
        if (music && music.paused && music.readyState === 0) {
            music.preload = 'auto';
            music.load();
        }

        var queue = list.slice();
        var active = 0;

        function next() {
            while (active < CONFIG.BACKGROUND_CONCURRENCY && queue.length) {
                run(queue.shift());
            }
        }

        function run(asset) {
            active++;
            // aset besar boleh lebih lama dari batas tahap wajib
            withTimeout(loadAsset(asset), CONFIG.ASSET_TIMEOUT_MS * 4).then(function () {
                active--;
                next();
            });
        }

        next();
    }

    // Jaga-jaga: video tetap menyala kalau tamu sudah dekat sectionnya,
    // walau antrean latar belakang belum sampai (atau mode hemat data).
    function watchVideos() {
        var videos = document.querySelectorAll('video');

        if (!('IntersectionObserver' in window)) {
            videos.forEach(activateVideo);
            return;
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                activateVideo(entry.target);
                observer.unobserve(entry.target);
            });
        }, { rootMargin: '150% 0px' });

        videos.forEach(function (video) { observer.observe(video); });
    }


    // ---------------------------------------------------------
    // SELESAI
    // ---------------------------------------------------------
    function finish(backgroundList) {
        if (isDone) return;
        isDone = true;

        root.classList.remove('is-loading');   // animasi cover mulai
        loader.classList.add('is-hidden');     // loading screen memudar

        setTimeout(function () {
            if (loader.parentNode) loader.parentNode.removeChild(loader);
        }, 1200);

        doneCallbacks.forEach(function (callback) { callback(); });
        doneCallbacks = [];

        if (!CONFIG.PRELOAD_ALL) {
            setTimeout(function () { runBackground(backgroundList); }, CONFIG.BACKGROUND_START_DELAY_MS);
        }
    }

    function start() {
        // nama tamu dari link (?to=...) ikut tampil di loading screen
        var guest = (new URLSearchParams(location.search).get('to') || '').trim().slice(0, 60);
        if (guest && guestText) guestText.textContent = 'Kepada Yth. ' + guest;

        var assets = collectAssets();
        var criticalList = CONFIG.PRELOAD_ALL
            ? assets.critical.concat(assets.background)
            : assets.critical;
        if (CONFIG.PRELOAD_ALL) {
            assets.background.forEach(function (asset) { asset.critical = true; });
        }

        watchVideos();
        requestAnimationFrame(renderProgress);

        Promise.all([
            runCritical(criticalList),
            wait(CONFIG.MIN_SHOW_MS)
        ]).then(function () {
            // tunggu bar benar-benar penuh sebelum menutup
            return progressPromise;
        }).then(function () {
            finish(assets.background);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
