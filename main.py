import requests
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

MAX_WORKERS = 10
TIMEOUT = 20

class VavooPro:
    def __init__(self):
        self.session = requests.Session()
        self.sign = None
        self.sign_time = 0

    def log(self, msg):
        print(f"[{time.strftime('%H:%M:%S')}] {msg}")

    # ---------------- SIGNATURE ----------------
    def get_signature(self):
        if self.sign and time.time() - self.sign_time < 60:
            return self.sign

        payload = {
            "token": "",
            "reason": "boot",
            "locale": "de",
            "theme": "dark",
            "metadata": {
                "device": {
                    "type": "desktop",
                    "uniqueId": str(uuid.uuid4())
                },
                "os": {
                    "name": "win32",
                    "version": "Windows 10",
                    "abis": ["x64"],
                    "host": "DESKTOP-" + str(uuid.uuid4())[:8]
                },
                "app": {"platform": "electron"},
                "version": {
                    "package": "app.lokke.main",
                    "binary": "1.0.19",
                    "js": "1.0.19"
                }
            },
            "appFocusTime": 120
        }

        try:
            r = self.session.post(
                "https://www.lokke.app/api/app/ping",
                json=payload,
                headers={
                    "accept": "application/json",
                    "user-agent": "okhttp/4.11.0",
                    "content-type": "application/json; charset=utf-8"
                },
                timeout=TIMEOUT
            )

            data = r.json()
            self.sign = data.get("addonSig")
            self.sign_time = time.time()

        except Exception as e:
            self.log(f"Signature hata: {e}")
            self.sign = None

        return self.sign

    # ---------------- CHANNELS (Döngü Eklendi) ----------------
    def get_channels(self, group="Turkey"):
        all_items = []
        cursor = 0
        
        while True:
            sign = self.get_signature()
            headers = {
                "user-agent": "MediaHubMX/2",
                "accept": "application/json",
                "content-type": "application/json",
                "mediahubmx-signature": sign or ""
            }

            payload = {
                "language": "en",
                "region": "UK",
                "catalogId": "iptv",
                "id": "iptv",
                "adult": True,
                "search": "",
                "sort": "name",
                "filter": {"group": group},
                "cursor": cursor
            }

            try:
                r = self.session.post(
                    "https://vavoo.to/mediahubmx-catalog.json",
                    json=payload,
                    headers=headers,
                    timeout=TIMEOUT
                )

                data = r.json()
                items = data.get("items", [])
                
                if not items:
                    # Eğer bu sayfada hiç item yoksa döngüden çık
                    break
                
                all_items.extend(items)
                self.log(f"Sayfa çekildi (Cursor: {cursor}). Şu ana kadar toplam {len(all_items)} kanal toplandı.")
                
                # Vavoo API genellikle bir sonraki sayfa için yeni bir cursor döner. 
                # Eğer dönmezse otomatik olarak mevcut listenin uzunluğu kadar kaydırıyoruz.
                next_cursor = data.get("cursor")
                if next_cursor and next_cursor != cursor:
                    cursor = next_cursor
                else:
                    cursor += len(items)
                    
                # API'yi yormamak ve ban yememek için küçük bir bekleme
                time.sleep(0.5)

            except Exception as e:
                self.log(f"Kanal listesi çekilirken hata (Cursor {cursor}): {e}")
                break
                
        return all_items

    # ---------------- RESOLVE ----------------
    def resolve_channel(self, ch):
        if not ch.get("url"):
            return None

        sign = self.get_signature()

        try:
            r = self.session.post(
                "https://vavoo.to/mediahubmx-resolve.json",
                json={
                    "language": "en",
                    "region": "UK",
                    "url": ch["url"]
                },
                headers={
                    "user-agent": "MediaHubMX/2",
                    "accept": "application/json",
                    "content-type": "application/json",
                    "mediahubmx-signature": sign or ""
                },
                timeout=TIMEOUT
            )

            data = r.json()

            if isinstance(data, list) and data:
                return (ch["name"], data[0].get("url"))

        except:
            return None

        return None

    # ---------------- M3U ----------------
    def build_m3u(self):
        self.log("Kanallar çekiliyor...")

        channels = self.get_channels("Turkey")

        if not channels:
            self.log("❌ Kanal yok!")
            return

        self.log(f"Toplam {len(channels)} ham kanal bulundu. Çözümleniyor (Resolve)...")

        seen = set()
        m3u = ["#EXTM3U"]

        self.log("Resolve başlıyor...")

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            results = executor.map(self.resolve_channel, channels)

        for res in results:
            if not res:
                continue

            name, url = res

            # ❗ duplicate temizleme
            if url in seen:
                continue

            seen.add(url)

            # ❗ boş link engel
            if not url or len(url) < 10:
                continue

            m3u.append(f'#EXTINF:-1 tvg-name="{name}",{name}')
            m3u.append(url)

        with open("vavoo_clean.m3u", "w", encoding="utf-8") as f:
            f.write("\n".join(m3u))

        self.log(f"✅ Bitti! Temiz benzersiz kanal sayısı: {len(seen)}")


# ---------------- RUN ----------------
if __name__ == "__main__":
    v = VavooPro()
    v.build_m3u()
