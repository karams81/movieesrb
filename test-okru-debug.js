const axios = require('axios');

async function debug() {
    console.log("🔍 OK.ru DEBUG\n");

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    const urls = [
        'https://ok.ru/video/search?q=film',
        'https://ok.ru/video',
        'https://ok.ru',
    ];

    for (const url of urls) {
        try {
            const r = await axios.get(url, { headers, timeout: 15000 });
            console.log(`✅ ${url}`);
            console.log(`   Status: ${r.status}`);
            console.log(`   Boyut: ${Math.round(r.data.length / 1024)} KB`);
            console.log(`   İlk 300 karakter:\n   ${r.data.substring(0, 300)}\n`);
        } catch (e) {
            console.log(`❌ ${url}`);
            console.log(`   Hata: ${e.message}`);
            console.log(`   HTTP Status: ${e.response?.status || 'yok'}`);
            console.log(`   Response: ${JSON.stringify(e.response?.data || '').substring(0, 200)}\n`);
        }
    }
}

debug();
