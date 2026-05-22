const puppeteer = require('puppeteer');

async function debug() {
    console.log("🔍 Puppeteer DEBUG\n");

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    const urls = [
        'https://ok.ru/video/search?q=film',
        'https://ok.ru/video',
    ];

    for (const url of urls) {
        console.log(`\n📡 ${url}`);
        try {
            const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            console.log(`   HTTP Status: ${response.status()}`);
            await new Promise(r => setTimeout(r, 3000));
            const html = await page.content();
            console.log(`   HTML boyutu: ${Math.round(html.length / 1024)} KB`);
            console.log(`   Title: ${await page.title()}`);
            console.log(`   İlk 500 karakter:\n${html.substring(0, 500)}`);
        } catch (e) {
            console.log(`   ❌ HATA: ${e.message}`);
        }
    }

    await browser.close();
}

debug().catch(console.error);
