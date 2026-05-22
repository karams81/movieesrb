const puppeteer = require('puppeteer');

// Önceki debugdan bilinen 18 ID
const KNOWN_IDS = [
    '14806209530478', '14844352858655', '7475662490142', '14621885800010',
    '14909234744037', '14754622474842', '5405311371949', '14181766138606',
    '14875366001183', '14597567679044', '14719534169210', '14786668142185',
    '14869086609955', '14892588424798', '14776413626951', '14816176513628',
    '14833801756330', '14858011614761'
];

async function debug() {
    console.log(`🔍 ${KNOWN_IDS.length} ID için metadata testi\n`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // Önce ok.ru'yu aç - cookie/session için
    await page.goto('https://ok.ru/video', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));

    // Scroll ile yeni ID'ler çıkıyor mu test et
    console.log("SCROLL TESTİ:");
    const idsBefore = new Set();
    let html = await page.content();
    html.match(/\/video\/(\d{8,})/g)?.forEach(m => idsBefore.add(m.replace('/video/', '')));
    console.log(`  Scroll öncesi: ${idsBefore.size} ID`);

    for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 2500));
    }
    html = await page.content();
    const idsAfter = new Set();
    html.match(/\/video\/(\d{8,})/g)?.forEach(m => idsAfter.add(m.replace('/video/', '')));
    console.log(`  Scroll sonrası: ${idsAfter.size} ID`);
    const newIds = [...idsAfter].filter(id => !idsBefore.has(id));
    console.log(`  Yeni gelen ID: ${newIds.length}`);

    // Metadata API testi
    console.log("\nMETADATA API TESTİ (ilk 5 ID):");
    for (const id of KNOWN_IDS.slice(0, 5)) {
        try {
            const result = await page.evaluate(async (videoId) => {
                const res = await fetch(`https://ok.ru/dk?cmd=videoPlayerMetadata&mid=${videoId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                const text = await res.text();
                return { status: res.status, preview: text.substring(0, 200) };
            }, id);
            console.log(`  ID ${id}: status=${result.status}`);
            console.log(`  Preview: ${result.preview}\n`);
        } catch(e) {
            console.log(`  ID ${id}: HATA - ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 500));
    }

    await browser.close();
}

debug().catch(console.error);
