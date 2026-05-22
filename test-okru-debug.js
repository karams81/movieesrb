const puppeteer = require('puppeteer');

async function debug() {
    console.log("🔍 OK.ru Scroll + API Testi\n");

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'tr-TR,tr;q=0.9' });

    function extractIds(html) {
        const ids = new Set();
        const patterns = [/\/video\/(\d{8,})/g, /"mid"\s*:\s*"(\d{8,})"/g, /data-mid="(\d{8,})"/g];
        for (const p of patterns) {
            let m; p.lastIndex = 0;
            while ((m = p.exec(html)) !== null) ids.add(m[1]);
        }
        return [...ids];
    }

    // TEST 1: Scroll ile daha fazla ID yükleniyor mu?
    console.log("TEST 1: Scroll testi");
    await page.goto('https://ok.ru/video?typeParam=MOVIE&duration=LONG', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    let prevCount = 0;
    for (let i = 0; i < 8; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 2000));
        const html = await page.content();
        const ids = extractIds(html);
        console.log(`  Scroll ${i+1}: ${ids.size} ID`);
        if (ids.size === prevCount && i > 2) { console.log('  (artış yok, durdu)'); break; }
        prevCount = ids.size;
    }

    // TEST 2: OK.ru'nun kendi AJAX API'si
    console.log("\nTEST 2: OK.ru AJAX API");
    const apiUrls = [
        'https://ok.ru/dk?st.cmd=anonymVideoAll&st.ft=video&cmd=AnonymVideoAll&typeParam=MOVIE',
        'https://ok.ru/dk?cmd=AnonymVideoAll&typeParam=MOVIE&duration=LONG&st.page=2',
    ];
    
    for (const url of apiUrls) {
        try {
            const r = await page.evaluate(async (u) => {
                const res = await fetch(u, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
                const text = await res.text();
                return { status: res.status, length: text.length, preview: text.substring(0, 300) };
            }, url);
            console.log(`  ${url.substring(0, 60)}...`);
            console.log(`  Status: ${r.status} | Boyut: ${Math.round(r.length/1024)}KB`);
            console.log(`  Preview: ${r.preview}\n`);
        } catch(e) {
            console.log(`  Hata: ${e.message}`);
        }
    }

    await browser.close();
}

debug().catch(console.error);
