const puppeteer = require('puppeteer');

/**
 * OK.ru Film Kaynağı - Puppeteer versiyonu
 * /video sayfasından ID çeker, metadata API ile film olanları filtreler
 */

class OKruSource {
    constructor() {
        this.baseUrl = 'https://ok.ru';
        this.processedIds = new Set();
    }

    async getBrowser() {
        return await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });
    }

    // Sayfadan video ID'lerini çek
    extractIds(html) {
        const ids = new Set();
        const patterns = [
            /\/video\/(\d{8,})/g,
            /"mid"\s*:\s*"(\d{8,})"/g,
            /data-mid="(\d{8,})"/g,
        ];
        for (const p of patterns) {
            let m;
            p.lastIndex = 0;
            while ((m = p.exec(html)) !== null) {
                if (!this.processedIds.has(m[1])) ids.add(m[1]);
            }
        }
        return [...ids];
    }

    // /video sayfasını scroll ederek ID topla
    async collectIds(page, targetCount = 200) {
        const allIds = new Set();

        // Ana video sayfası
        const pages = [
            'https://ok.ru/video',
            'https://ok.ru/video?typeParam=MOVIE',
            'https://ok.ru/video?typeParam=MOVIE&duration=LONG',
        ];

        for (const url of pages) {
            if (allIds.size >= targetCount) break;
            console.log(`  📄 ${url}`);

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(r => setTimeout(r, 3000));

            // Aşağı kaydır - daha fazla içerik yüklensin
            for (let i = 0; i < 5; i++) {
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await new Promise(r => setTimeout(r, 1500));
            }

            const html = await page.content();
            const ids = this.extractIds(html);
            ids.forEach(id => allIds.add(id));
            console.log(`     ${ids.length} ID bulundu (toplam: ${allIds.size})`);
        }

        return [...allIds];
    }

    // videoPlayerMetadata API ile film bilgilerini al
    async getVideoMeta(videoId) {
        try {
            const url = `${this.baseUrl}/dk?cmd=videoPlayerMetadata&mid=${videoId}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            const data = await res.json();
            if (!data?.movie) return null;

            const movie = data.movie;
            const title = movie.title?.replace(/\\"/g, '"').replace(/&quot;/g, '"').trim();
            if (!title || title.length < 2) return null;

            const duration = parseInt(movie.duration || '0');
            // 60 dakikadan kısa = film değil, atla
            if (duration > 0 && duration < 3600) return null;

            this.processedIds.add(videoId);

            let year = new Date().getFullYear();
            const yearMatch = title.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
            if (yearMatch) year = parseInt(yearMatch[1]);

            return {
                title,
                url: `https://ok.ru/videoembed/${videoId}`,
                duration,
                poster: movie.poster || '',
                year,
                rating: 0,
                mainGenre: 'Diğer',
                allGenres: ['Diğer'],
                source: 'ok.ru'
            };
        } catch {
            return null;
        }
    }

    async getPopularMovies(limit = 100) {
        console.log('📺 OK.ru taranıyor (Puppeteer)...');

        const browser = await this.getBrowser();
        const movies = [];

        try {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
            await page.setExtraHTTPHeaders({ 'Accept-Language': 'tr-TR,tr;q=0.9' });

            // ID'leri topla
            const ids = await this.collectIds(page, limit * 3); // film filtresi düşüreceği için fazla al
            console.log(`\n  🎯 Toplam ${ids.length} video ID bulundu, metadata kontrol ediliyor...`);

            await page.close();

            // Her ID için metadata çek, film olanları al
            for (const id of ids) {
                if (movies.length >= limit) break;

                const meta = await this.getVideoMeta(id);
                if (meta) {
                    movies.push(meta);
                    const dur = meta.duration ? `${Math.floor(meta.duration / 60)} dk` : '? dk';
                    console.log(`  ✓ ${meta.title} (${meta.year}, ${dur})`);
                }
                await new Promise(r => setTimeout(r, 400));
            }
        } finally {
            await browser.close();
        }

        // Tekrar eden başlıkları temizle
        const seen = new Set();
        const unique = movies.filter(m => {
            const key = m.title.toLowerCase().trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        console.log(`📊 OK.ru: ${unique.length} benzersiz film bulundu`);
        return unique;
    }
}

module.exports = OKruSource;
