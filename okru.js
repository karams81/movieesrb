const puppeteer = require('puppeteer');

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

    extractIds(html) {
        const ids = new Set();
        const matches = html.matchAll(/\/video\/(\d{8,})/g);
        for (const m of matches) {
            if (!this.processedIds.has(m[1])) ids.add(m[1]);
        }
        return [...ids];
    }

    // Sayfayı scroll ederek ID topla
    async collectIds(page, scrollCount = 15) {
        await page.goto('https://ok.ru/video?typeParam=MOVIE&duration=LONG', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        await new Promise(r => setTimeout(r, 3000));

        for (let i = 0; i < scrollCount; i++) {
            await page.evaluate(() => window.scrollBy(0, 1000));
            await new Promise(r => setTimeout(r, 2000));
        }

        const html = await page.content();
        const ids = this.extractIds(html);
        console.log(`  📋 ${ids.length} video ID bulundu`);
        return ids;
    }

    // Metadata API'yi page.evaluate içinde çağır (cookie/session için)
    async getVideoMeta(page, videoId) {
        if (this.processedIds.has(videoId)) return null;

        try {
            const data = await page.evaluate(async (id) => {
                const res = await fetch(`https://ok.ru/dk?cmd=videoPlayerMetadata&mid=${id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                return await res.json();
            }, videoId);

            if (!data?.movie) return null;

            const movie = data.movie;
            const title = movie.title?.replace(/\\"/g, '"').replace(/&quot;/g, '"').trim();
            if (!title || title.length < 2) return null;

            const duration = parseInt(movie.duration || '0');
            if (duration > 0 && duration < 3600) return null; // 60 dk altı = film değil

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
        console.log('📺 OK.ru taranıyor...');

        const browser = await this.getBrowser();
        const movies = [];

        try {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
            await page.setExtraHTTPHeaders({ 'Accept-Language': 'tr-TR,tr;q=0.9' });

            // Scroll sayısını limit'e göre ayarla (her 3 scroll ~18 yeni ID)
            const scrollCount = Math.ceil(limit / 6) + 5;
            const ids = await this.collectIds(page, scrollCount);

            console.log(`  🎯 ${ids.length} ID kontrol ediliyor...`);

            for (const id of ids) {
                if (movies.length >= limit) break;

                const meta = await this.getVideoMeta(page, id);
                if (meta) {
                    movies.push(meta);
                    const dur = meta.duration ? `${Math.floor(meta.duration / 60)} dk` : '? dk';
                    console.log(`  ✓ ${meta.title} (${meta.year}, ${dur})`);
                }
                await new Promise(r => setTimeout(r, 300));
            }

            await page.close();
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
