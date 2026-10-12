"""Open-Meteo(키 불필요)에서 춘천 일자료를 받아 csv_work/weather2_chuncheon.csv 로 저장한다 (2022~2025). fetch_weather2.py 와 같은 열."""
import time, requests, pandas as pd
from pathlib import Path

W = Path(__file__).resolve().parent.parent / "csv_work"
DAILY = ["temperature_2m_mean", "temperature_2m_max", "temperature_2m_min", "precipitation_sum", "relative_humidity_2m_mean",
         "wind_speed_10m_max", "sunshine_duration", "shortwave_radiation_sum", "cloud_cover_mean"]
NAMES = {"time": "날짜", "temperature_2m_mean": "평균기온", "temperature_2m_max": "최고기온", "temperature_2m_min": "최저기온",
         "precipitation_sum": "강수량", "relative_humidity_2m_mean": "평균습도", "wind_speed_10m_max": "최대풍속",
         "shortwave_radiation_sum": "일사량", "cloud_cover_mean": "운량"}
for t in range(6):
    try:
        r = requests.get("https://archive-api.open-meteo.com/v1/archive", timeout=90, params=dict(
            latitude=37.8813, longitude=127.7298, start_date="2022-01-01", end_date="2025-12-31", daily=",".join(DAILY), timezone="Asia/Seoul"))
        r.raise_for_status()
        break
    except Exception as e:
        print("재시도", t + 1, type(e).__name__); time.sleep(10 * (t + 1))
d = pd.DataFrame(r.json()["daily"]).rename(columns=NAMES)
d["일조시간"] = (d.pop("sunshine_duration") / 3600).round(1)
d.to_csv(W / "weather2_chuncheon.csv", index=False, encoding="utf-8-sig")
print(len(d), d.isna().sum().to_dict())
