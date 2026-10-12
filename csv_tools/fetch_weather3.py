"""Open-Meteo(키 불필요) 서울 시간자료에서 「그날 저녁 9시까지 이미 아는 값」을 받아 csv_work/evening_seoul.csv 로 저장한다 (2022~2025).
별 관측처럼 저녁에 밤 일을 예측하는 주제용 — 저녁 9시 이후의 값은 넣지 않는다.
열: 날짜, 습도_19시, 습도_21시, 구름_15시, 구름_21시, 강수_18_21시(18~21시 강수량 합, mm)"""
import time, requests, pandas as pd
from pathlib import Path

W = Path(__file__).resolve().parent.parent / "csv_work"
for t in range(6):
    try:
        r = requests.get("https://archive-api.open-meteo.com/v1/archive", timeout=90, params=dict(
            latitude=37.5665, longitude=126.978, start_date="2022-01-01", end_date="2025-12-31",
            hourly="relative_humidity_2m,cloud_cover,precipitation", timezone="Asia/Seoul"))
        r.raise_for_status()
        break
    except Exception as e:
        print("재시도", t + 1, type(e).__name__); time.sleep(10 * (t + 1))
h = pd.DataFrame(r.json()["hourly"])
h["time"] = pd.to_datetime(h["time"])
h["날짜"] = h["time"].dt.strftime("%Y-%m-%d")
hr = h["time"].dt.hour
out = pd.DataFrame({"날짜": sorted(h["날짜"].unique())}).set_index("날짜")
out["습도_19시"] = h[hr == 19].set_index("날짜")["relative_humidity_2m"]
out["습도_21시"] = h[hr == 21].set_index("날짜")["relative_humidity_2m"]
out["구름_15시"] = h[hr == 15].set_index("날짜")["cloud_cover"]
out["구름_21시"] = h[hr == 21].set_index("날짜")["cloud_cover"]
out["강수_18_21시"] = h[(hr >= 18) & (hr <= 21)].groupby("날짜")["precipitation"].sum()
out.reset_index().to_csv(W / "evening_seoul.csv", index=False, encoding="utf-8-sig")
print(len(out), out.isna().sum().to_dict())
