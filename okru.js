const axios = require('axios');

/**
 * OK.ru Film Kaynağı
 * 
 * Arama: https://ok.ru/video/search?q=...  (HTML parse)
 * Metadata: https://ok.ru/dk?cmd=videoPlayerMetadata&mid={id}  (JSON API)
 * Embed link: https://ok.ru/videoembed/{id}
 */

class OKruSource {
    constructor() {
        this.baseUrl = 'https://ok.ru';
        this.processedIds = new Set();
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        };
    }

    // Arama sayfasından video ID'lerini çek
    async searchVideoIds(keyword, maxResults = 20) {
        const ids = [];
        try {
            const url = `${this.baseUrl}/video/search?q=${encodeURIComponent(keyword)}`;
            const response = await axios.get(url, {
                headers: this.headers,
                timeout: 20000
            });
            const html = response.data;

            // ok.ru arama sayfasındaki video ID pattern'leri
            const patterns = [
                /\/video\/(\d{8,})/g,
                /"videoId"\s*:\s*"(\d{8,})"/g,
                /data-mid="(\d{8,})"/g,
                /data-id="(\d{8,})"/g,
                /"mid"\s*:\s*"(\d{8,})"/g,
            ];

            for (const pattern of patterns) {
                let match;
                pattern.lastIndex = 0;
                while ((match = pattern.exec(html)) !== null) {
                    const id = match[1];
                    if (!this.processedIds.has(id) && !ids.includes(id)) {
                        ids.push(id);
                        if (ids.length >= maxResults) break;
                    }
                }
                if (ids.length >= maxResults) break;
            }

            console.log(`     HTML boyutu: ${Math.round(html.length/1024)}KB, bulunan ID: ${ids.length}`);
        } catch (error) {
            console.error(`  ⚠️  Arama hatası (${keyword}): ${error.message}`);
        }
        return ids;
    }

    // videoPlayerMetadata API ile video bilgilerini al
    async getVideoMeta(videoId) {
        if (this.processedIds.has(videoId)) return null;

        try {
            const url = `${this.baseUrl}/dk?cmd=videoPlayerMetadata&mid=${videoId}`;
            const response = await axios.post(url, null, {
                headers: {
                    ...this.headers,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': `https://ok.ru/video/${videoId}`,
                },
                timeout: 15000
            });

            const data = response.data;
            if (!data || !data.movie) return null;

            const movie = data.movie;
            const title = movie.title;
            if (!title || title.length < 2) return null;

            // Süre saniye cinsinden
            const duration = parseInt(movie.duration || '0');

            // 60 dakikadan kısa ise film değil
            if (duration > 0 && duration < 3600) return null;

            this.processedIds.add(videoId);

            // Poster URL
            const poster = movie.poster || '';

            // Yıl: başlıktan veya o anki yıldan tahmin
            let year = new Date().getFullYear();
            const yearMatch = title.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
            if (yearMatch) year = parseInt(yearMatch[1]);

            return {
                title: title.replace(/\\"/g, '"').replace(/&quot;/g, '"').trim(),
                url: `https://ok.ru/videoembed/${videoId}`,
                duration,
                poster,
                year,
                rating: 0,
                mainGenre: 'Diğer',
                allGenres: ['Diğer'],
                source: 'ok.ru'
            };
        } catch (error) {
            return null; // private/silinen video — sessizce atla
        }
    }

    async getPopularMovies(limit = 100) {
        console.log('📺 OK.ru taranıyor...');

        const keywords = [
            'türkçe dublaj film 2024',
            'türkçe dublaj film 2025',
            'full hd film türkçe',
            'aksiyon filmi türkçe dublaj',
            'komedi filmi türkçe',
            'dram filmi türkçe',
            'korku filmi türkçe dublaj',
            'bilim kurgu filmi türkçe',
            'animasyon filmi türkçe',
            'gerilim filmi türkçe'
        ];

        const movies = [];

        for (const keyword of keywords) {
            if (movies.length >= limit) break;

            console.log(`  🔍 "${keyword}" aranıyor...`);
            const perSearch = Math.min(25, limit - movies.length + 5);
            const ids = await this.searchVideoIds(keyword, perSearch);

            for (const id of ids) {
                if (movies.length >= limit) break;

                const meta = await this.getVideoMeta(id);
                if (meta) {
                    movies.push(meta);
                    const dur = meta.duration ? `${Math.floor(meta.duration / 60)} dk` : '? dk';
                    console.log(`     ✓ ${meta.title} (${meta.year}, ${dur})`);
                }
                await new Promise(r => setTimeout(r, 600));
            }

            await new Promise(r => setTimeout(r, 1200));
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
