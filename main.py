import time
import uuid
import cloudscraper  # requests yerine bunu kullanıyoruz
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, Response
import uvicorn

app = FastAPI()

MAX_WORKERS = 3  # Ban yememek için havuzu küçülttük
TIMEOUT = 25

class VavooPro:
    def __init__(self):
        # cloudscraper standart requests session'ının gelişmiş halidir
        self.session = cloudscraper.create_scraper()
        self.sign = None
        self.sign_time = 0

    def get_signature(self):
        if self.sign and time.time() - self.sign_time < 60:
            return self.sign

        payload = {
            "token": "", "reason": "boot", "locale": "de", "theme": "dark",
            "metadata": {
                "device": {"type": "desktop", "uniqueId": str(uuid.uuid4())},
                "os": {"name": "win32", "version": "Windows 10", "abis": ["x64"], "host": "DESKTOP-" + str(uuid.uuid4())[:8]},
                "app": {"platform": "electron"},
                "version": {"package": "app.lokke.main", "binary": "1.0.19", "js": "1.0.19"}
            },
            "appFocusTime": 120
        }
        try:
            r = self.session.post(
                "https://www.lokke.app/api/app/ping",
                json=payload,
                headers={"accept": "application/json", "user-agent": "okhttp/4.11.0", "content-type": "application/json; charset=utf-8"},
                timeout=TIMEOUT
            )
            self.sign = r.json().get("addonSig")
            self.sign_time = time.time()
        except:
            self.sign = None
        return self.sign

    def get_channels(self, group="Turkey"):
        all_items = []
        cursor = 0
        while True:
            sign = self.get_signature()
            headers = {
                "user-agent": "MediaHubMX/2", "accept": "application/json",
                "content-type": "application/json", "mediahubmx-signature": sign or ""
            }
            payload = {
                "language": "en", "region": "UK", "catalogId": "iptv", "id": "iptv",
                "adult": True, "search": "", "sort": "name", "filter": {"group": group}, "cursor": cursor
            }
            try:
                r = self.session.post("https://vavoo.to/mediahubmx-catalog.json", json=payload, headers=headers, timeout=TIMEOUT)
                data = r.json()
                items = data.get("items", [])
                if not items: break
                all_items.extend(items)
                
                next_cursor = data.get("cursor")
                if next_cursor and next_cursor != cursor:
                    cursor = next_cursor
                else:
                    cursor += len(items)
                time.sleep(0.5)  # Veri merkezi IP'sini korumak için gecikmeyi artırdık
            except:
                break
        return all_items

    def resolve_channel(self, ch):
        if not ch.get("url"): return None
        sign = self.get_signature()
        try:
            # İstekler arasına milisaniyelik bir gecikme atarak sunucuyu boğmuyoruz
            time.sleep(0.1)
            r = self.session.post(
                "https://vavoo.to/mediahubmx-resolve.json",
                json={"language": "en", "region": "UK", "url": ch["url"]},
                headers={"user-agent": "MediaHubMX/2", "accept": "application/json", "content-type": "application/json", "mediahubmx-signature": sign or ""},
                timeout=TIMEOUT
            )
            data = r.json()
            if isinstance(data, list) and data:
                return (ch["name"], data[0].get("url"))
        except:
            return None
        return None

vavoo_bot = VavooPro()

@app.get("/vavoo.m3u")
def generate_live_m3u():
    channels = vavoo_bot.get_channels("Turkey")
    if not channels:
        return Response(content="#EXTM3U\n#INFO: Vavoo baglantisi veri merkezi korumasina takildi.", media_type="application/x-mpegurl")

    seen = set()
    m3u = ["#EXTM3U"]

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        results = executor.map(vavoo_bot.resolve_channel, channels)

    for res in results:
        if not res: continue
        name, url = res
        if url in seen or not url or len(url) < 10: continue
        seen.add(url)

        m3u.append(f'#EXTINF:-1 tvg-name="{name}",{name}')
        m3u.append(url)

    return Response(content="\n".join(m3u), media_type="application/x-mpegurl")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=10000)
