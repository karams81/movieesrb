const puppeteer = require('puppeteer');

async function debug() {
    console.log("🔍 OK.ru Sayfa Testi\n");

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'tr-TR,tr;q=0.9' });

    const urls = [
        'https://ok.ru/video?typeParam=MOVIE',
        'https://ok.ru/video?typeParam=MOVIE&duration=LONG',
        'https://ok.ru/video/catalog',
        'https://ok.ru/video/catalog?type=film',
        // Türkçe film grupları
        'https://ok.ru/group/turkce-film',
        'https://ok.ru/group/52904139276383',  // Türkçe Dublaj Film grubu
    ];

    function extractIds(html) {
        const ids = new Set();
        const patterns = [/\/video\/(\d{8,})/g, /"mid"\s*:\s*"(\d{8,})"/g, /data-mid="(\d{8,})"/g];
        for (const p of patterns) {
            let m; p.lastIndex = 0;
            while ((m = p.exec(html)) !== null) ids.add(m[1]);
        }
        return [...ids];
    }

    for (const url of urls) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await new Promise(r => setTimeout(r, 3000));
            const html = await page.content();
            const ids = extractIds(html);
            console.log(`${ids.length > 0 ? '✅' : '❌'} ${url}`);
            console.log(`   Boyut: ${Math.round(html.length/1024)}KB | ID: ${ids.length} | Title: ${await page.title()}`);
            if (ids.length > 0) console.log(`   İlk 3 ID: ${ids.slice(0,3).join(', ')}`);
        } catch(e) {
            console.log(`❌ ${url} → ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    await browser.close();
}

debug().catch(console.error);
