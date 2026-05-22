const axios = require('axios');

/**
 * OK.ru Film Kaynağı
 * 
 * Yaklaşım:
 * - OK.ru'nun public /dk/search endpointini kullanır (session gerektirmez)
 * - Embed link formatı: https://ok.ru/videoembed/{videoId}
 * - 60 dakikadan uzun videolar film olarak kabul edilir
 */

class OKruSource {
    constructor() {
        this.baseUrl = 'https://ok.ru';
        this.processedIds = new Set();

        // Tarayıcı gibi görünen header'lar (bot engeline karşı)
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Referer': 'https://ok.ru/'
        };
    }

    // Arama sayfasından video ID'lerini çek
    async searchVideoIds(keyword, maxResults = 20) {
        const ids = [];
        try {
            const searchUrl = `${this.baseUrl}/dk?st.cmd=anonymMain&st.searchQuery=${encodeURIComponent(keyword)}&st.ft=video`;
            const response = await axios.get(searchUrl, {
                headers: this.headers,
                timeout: 20000
            });

            const html = response.data;

            // Video ID'leri HTML içinden çek
            // Format: /video/1234567890 veya videoembed/1234567890
            const patterns = [
                /\/video\/(\d{10,})/g,
                /videoembed\/(\d{10,})/g,
                /"videoId":"(\d{10,})"/g,
                /data-id="(\d{10,})"/g
            ];

            for (const pattern of patterns) {
                const matches = html.matchAll(pattern);
                for (const match of matches) {
                    const id = match[1];
                    if (!this.processedIds.has(id) && ids.length < maxResults) {
                        ids.push(id);
                    }
                }
            }
        } catch (error) {
            console.error(`  ⚠️  Arama hatası (${keyword}): ${error.message}`);
        }
        return [...new Set(ids)]; // tekrarları temizle
    }

    // Video sayfasından metadata çek
    async getVideoMeta(videoId) {
        if (this.processedIds.has(videoId)) return null;

        try {
            const videoUrl = `${this.baseUrl}/video/${videoId}`;
            const response = await axios.get(videoUrl, {
                headers: this.headers,
                timeout: 15000
            });

            const html = response.data;

            // Başlık
            let title = null;
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
                || html.match(/"name"\s*:\s*"([^"]{5,80})"/);
            if (titleMatch) {
                title = titleMatch[1]
                    .replace(/ - OK\.ru.*$/i, '')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&amp;/g, '&')
                    .trim();
            }
            if (!title || title.length < 3) return null;

            // Süre (saniye) - film filtresi için
            let duration = 0;
            const durMatch = html.match(/"duration"\s*:\s*(\d+)/)
                || html.match(/content="PT(\d+)M(\d+)S"/);
            if (durMatch) {
                if (durMatch[2]) {
                    // PT format (ISO 8601)
                    duration = parseInt(durMatch[1]) * 60 + parseInt(durMatch[2]);
                } else {
                    duration = parseInt(durMatch[1]);
                }
            }

            // 60 dakikadan kısa ise film değil, atla
            if (duration > 0 && duration < 3600) return null;

            // Thumbnail
            let poster = '';
            const posterMatch = html.match(/og:image[^>]*content="([^"]+)"/)
                || html.match(/"thumbnailUrl"\s*:\s*"([^"]+)"/);
            if (posterMatch) poster = posterMatch[1];

            // Yıl
            let year = new Date().getFullYear();
            const yearMatch = html.match(/(\b20[0-9]{2}\b)/);
            if (yearMatch) year = parseInt(yearMatch[1]);

            this.processedIds.add(videoId);

            return {
                title,
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
            // 404, private video vb. — sessizce atla
            return null;
        }
    }

    // Ana fonksiyon - popüler filmleri çek
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
            const remaining = limit - movies.length;
            const perSearch = Math.min(20, remaining + 5); // biraz fazla çek, filtre sonrası düşecek

            const ids = await this.searchVideoIds(keyword, perSearch);
            console.log(`     ${ids.length} video ID bulundu`);

            for (const id of ids) {
                if (movies.length >= limit) break;

                const meta = await this.getVideoMeta(id);
                if (meta) {
                    movies.push(meta);
                    const durMin = meta.duration ? `${Math.floor(meta.duration / 60)} dk` : '? dk';
                    console.log(`     ✓ ${meta.title} (${meta.year}, ${durMin})`);
                }

                // Rate limiting — ban yememek için
                await new Promise(r => setTimeout(r, 800));
            }

            // Keyword'ler arası bekleme
            await new Promise(r => setTimeout(r, 1500));
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
