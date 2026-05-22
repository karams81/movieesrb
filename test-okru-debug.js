const puppeteer = require('puppeteer');

async function debug() {
    console.log("🔍 Puppeteer DEBUG v2\n");

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'tr-TR,tr;q=0.9' });

    // /video sayfasını dene - zaten 493KB geliyor
    console.log("📡 https://ok.ru/video (domcontentloaded + 5sn bekleme)");
    await page.goto('https://ok.ru/video', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    const html = await page.content();
    console.log(`HTML boyutu: ${Math.round(html.length / 1024)} KB`);

    // Video ID'leri var mı?
    const patterns = [
        /\/video\/(\d{8,})/g,
        /"mid"\s*:\s*"(\d{8,})"/g,
        /data-mid="(\d{8,})"/g,
    ];

    const ids = new Set();
    for (const p of patterns) {
        let m;
        p.lastIndex = 0;
        while ((m = p.exec(html)) !== null) ids.add(m[1]);
    }
    console.log(`Bulunan video ID sayısı: ${ids.size}`);
    console.log(`İlk 10 ID: ${[...ids].slice(0, 10).join(', ')}`);

    // Şimdi arama sayfasını farklı bekle
    console.log("\n📡 https://ok.ru/video/search?q=film (domcontentloaded + 8sn)");
    await page.goto('https://ok.ru/video/search?q=film', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 8000));

    const html2 = await page.content();
    console.log(`HTML boyutu: ${Math.round(html2.length / 1024)} KB`);
    console.log(`Title: ${await page.title()}`);

    const ids2 = new Set();
    for (const p of patterns) {
        let m;
        p.lastIndex = 0;
        while ((m = p.exec(html2)) !== null) ids2.add(m[1]);
    }
    console.log(`Bulunan video ID sayısı: ${ids2.size}`);
    if (ids2.size > 0) console.log(`İlk 5 ID: ${[...ids2].slice(0, 5).join(', ')}`);

    await browser.close();
}

debug().catch(console.error);
