"""Open-Meteo(키 불필요) 서울 시간자료에서 저녁 21시 습도·구름량을 받아 csv_work/evening_seoul.csv 로 저장한다 (2022~2025).
예측을 「전날 저녁」에 하는 별 관측 주제용 — 저녁 21시에 이미 알 수 있는 값."""
import time, requests, pandas as pd
from pathlib import Path

W = Path(__file__).resolve().parent.parent / "csv_work"
for t in range(6):
    try:
        r = requests.get("https://archive-api.open-meteo.com/v1/archive", timeout=90, params=dict(
            latitude=37.5665, longitude=126.978, start_date="2022-01-01", end_date="2025-12-31",
            hourly="relative_humidity_2m,cloud_cover", timezone="Asia/Seoul"))
        r.raise_for_status()
        break
    except Exception as e:
        print("재시도", t + 1, type(e).__name__); time.sleep(10 * (t + 1))
h = pd.DataFrame(r.json()["hourly"])
h["time"] = pd.to_datetime(h["time"])
e = h[h["time"].dt.hour == 21].copy()
e["날짜"] = e["time"].dt.strftime("%Y-%m-%d")
e = e.rename(columns={"relative_humidity_2m": "저녁9시_습도", "cloud_cover": "저녁9시_구름량"})[["날짜", "저녁9시_습도", "저녁9시_구름량"]]
e.to_csv(W / "evening_seoul.csv", index=False, encoding="utf-8-sig")
print(len(e), e.isna().sum().to_dict())
