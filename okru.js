const axios = require('axios');
const qs = require('querystring');

class OKruSource {
    constructor() {
        this.apiUrl = 'https://api.bnnapp.com/__proxy_host/api.ok.ru/api';
        this.appKey = 'CBAFJIICABABABABA';
        this.token = '800041591478_3f35c54f1911a99d013bc24ab5c86337a3964d5b4c682b1bd15287b04d689ba6';
        this.headers = {
            'Accept': 'application/json',
            'Connection': 'Keep-Alive',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Host': 'api.bnnapp.com',
            'User-Agent': 'OKAndroid/25.11.28 b25112800 (Android 9; tr_TR)'
        };
        this.processedMovies = new Set();
    }

    async login() {
        const loginData = qs.stringify({
            application_key: this.appKey,
            deviceId: 'INSTALL_ID=bfacced7-340e-4cd0-bb05-3ccd1b6b1c69;DEVICE_ID=903910667827172;ANDROID_ID=adcda19bf1b12eb8;',
            gaid: '0501236e-7ba8-46de-bb58-e3bd542aa4c8',
            mtid: 'de3c9872-2ee5-4181-b15d-2a323287c47b',
            token: this.token,
            verification_supported: 'true',
            verification_supported_v: '6'
        });

        try {
            const response = await axios.post(`${this.apiUrl}/auth/loginByToken`, loginData, {
                headers: this.headers,
                timeout: 30000
            });
            
            const match = response.data.match(/"session_key":"(.*?)"/);
            return match ? match[1] : null;
        } catch (error) {
            console.error('❌ OK.ru login hatası:', error.message);
            return null;
        }
    }

    async searchVideos(sessionKey, keyword, count = 20) {
        const methods = [{
            'video.search': {
                params: {
                    q: keyword,
                    fields: 'video.id',
                    count: count
                }
            }
        }];

        const ticketData = qs.stringify({
            application_key: this.appKey,
            session_key: sessionKey,
            methods: JSON.stringify(methods)
        });

        try {
            const response = await axios.post(`${this.apiUrl}/batch/executeV2`, ticketData, {
                headers: this.headers,
                timeout: 30000
            });
            
            const matches = response.data.matchAll(/"id":"(\d+)"/g);
            const ids = [];
            for (const match of matches) {
                ids.push(match[1]);
            }
            return ids;
        } catch (error) {
            console.error(`❌ Arama hatası (${keyword}):`, error.message);
            return [];
        }
    }

    async getVideoDetails(sessionKey, videoId) {
        if (this.processedMovies.has(videoId)) return null;
        
        const methods = [{
            'video.getVideos': {
                params: {
                    fields: 'video.url_mp4,video.title,video.duration,video.thumbnail_url,video.total_views',
                    vids: videoId
                }
            }
        }];

        const ticketData = qs.stringify({
            application_key: this.appKey,
            session_key: sessionKey,
            methods: JSON.stringify(methods)
        });

        try {
            const response = await axios.post(`${this.apiUrl}/batch/executeV2`, ticketData, {
                headers: this.headers,
                timeout: 30000
            });
            
            const data = response.data;
            
            const urlMatch = data.match(/"url_mp4":"(.*?)"/);
            const titleMatch = data.match(/"title":"(.*?)"/);
            const durationMatch = data.match(/"duration":(\d+)/);
            const viewsMatch = data.match(/"total_views":(\d+)/);
            
            if (!urlMatch || !urlMatch[1]) return null;
            
            const title = (titleMatch ? titleMatch[1] : 'Bilinmeyen Film')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '')
                .replace(/&quot;/g, '"');
            
            const duration = durationMatch ? parseInt(durationMatch[1]) : 0;
            
            // Sadece 1 saatten uzun filmleri al
            if (duration < 3600) return null;
            
            this.processedMovies.add(videoId);
            
            return {
                title: title,
                url: 'https:' + urlMatch[1],
                duration: duration,
                views: viewsMatch ? parseInt(viewsMatch[1]) : 0,
                source: 'ok.ru',
                year: new Date().getFullYear(),
                rating: 0, // OK.ru rating vermiyor
                poster: '',
                mainGenre: 'Aksiyon', // Varsayılan
                allGenres: ['Aksiyon']
            };
        } catch (error) {
            console.error(`❌ Video detay hatası (${videoId}):`, error.message);
            return null;
        }
    }

    async getPopularMovies(limit = 100) {
        console.log('📺 OK.ru oturum açılıyor...');
        const sessionKey = await this.login();
        if (!sessionKey) {
            console.error('❌ OK.ru giriş yapılamadı, bu kaynak atlanacak');
            return [];
        }

        // Türkçe film anahtar kelimeleri
        const keywords = [
            'türkçe dublaj film', 'full film türkçe', 'hd film', 
            'aksiyon filmi', 'komedi filmi', 'dram filmi', 
            'bilim kurgu filmi', 'korku filmi', 'romantik film',
            '2024 film', '2025 film', '2026 film'
        ];
        
        const movies = [];
        
        for (const keyword of keywords) {
            if (movies.length >= limit) break;
            
            console.log(`🔍 OK.ru: "${keyword}" aranıyor...`);
            const videoIds = await this.searchVideos(sessionKey, keyword, Math.ceil(limit / keywords.length));
            
            for (const videoId of videoIds) {
                if (movies.length >= limit) break;
                
                const movie = await this.getVideoDetails(sessionKey, videoId);
                if (movie) {
                    movies.push(movie);
                    const durationMin = Math.floor(movie.duration / 60);
                    console.log(`   ✓ ${movie.title} (${durationMin} dk) - ${movie.views?.toLocaleString() || '0'} izlenme`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
            }
        }
        
        console.log(`📊 OK.ru: ${movies.length} film bulundu`);
        return movies;
    }
}

module.exports = OKruSource;
