import time
import uuid
import requests
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse, Response
import uvicorn

app = FastAPI()
session = requests.Session()

_sign = None
_sign_time = 0
TIMEOUT = 15

def get_signature():
    global _sign, _sign_time
    if _sign and time.time() - _sign_time < 60:
        return _sign

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
        r = session.post(
            "https://www.lokke.app/api/app/ping",
            json=payload,
            headers={"accept": "application/json", "user-agent": "okhttp/4.11.0", "content-type": "application/json; charset=utf-8"},
            timeout=TIMEOUT
        )
        _sign = r.json().get("addonSig")
        _sign_time = time.time()
    except:
        _sign = None
    return _sign

@app.get("/vavoo.m3u")
def get_m3u():
    sign = get_signature()
    payload = {
        "language": "en", "region": "UK", "catalogId": "iptv", "id": "iptv",
        "adult": True, "search": "", "sort": "name", "filter": {"group": "Turkey"}, "cursor": 0
    }
    
    all_items = []
    for cursor in [0, 300, 600, 900]:
        payload["cursor"] = cursor
        try:
            r = session.post(
                "https://vavoo.to/mediahubmx-catalog.json",
                json=payload,
                headers={"user-agent": "MediaHubMX/2", "accept": "application/json", "mediahubmx-signature": sign or ""},
                timeout=TIMEOUT
            )
            items = r.json().get("items", [])
            if not items: break
            all_items.extend(items)
        except:
            break

    m3u = ["#EXTM3U"]
    seen = set()
    for ch in all_items:
        name = ch.get("name")
        url = ch.get("url")
        if not url or url in seen: continue
        seen.add(url)
        
        m3u.append(f'#EXTINF:-1 tvg-name="{name}",{name}')
        m3u.append(f'https://vwapis.onrender.com/play?url={url}')

    return Response(content="\n".join(m3u), media_type="application/x-mpegurl")

@app.get("/play")
def play(url: str):
    sign = get_signature()
    try:
        r = session.post(
            "https://vavoo.to/mediahubmx-resolve.json",
            json={"language": "en", "region": "UK", "url": url},
            headers={"user-agent": "MediaHubMX/2", "accept": "application/json", "mediahubmx-signature": sign or ""},
            timeout=TIMEOUT
        )
        data = r.json()
        if isinstance(data, list) and data:
            stream_url = data[0].get("url")
            return RedirectResponse(url=stream_url)
    except:
        pass
    raise HTTPException(status_code=404, detail="Kanal yuklenemedi")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=10000)
