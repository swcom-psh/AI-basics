"""Open-Meteo(키 불필요)에서 서울·인천 일자료와 서울 밤시간 자료를 받아 csv_work/ 에 저장한다 (2022-01-01 ~ 2025-12-31).
태양광(일사량·운량)·별 관측(밤 구름량·시정)용. 기상청 관측값이 아닌 재분석 자료라 조금 다를 수 있다."""
import requests
import pandas as pd
from pathlib import Path

W = Path(__file__).resolve().parent.parent / "csv_work"
SITES = {"seoul": (37.5665, 126.978), "incheon": (37.4563, 126.7052)}
DAILY = ["temperature_2m_mean", "temperature_2m_max", "temperature_2m_min", "precipitation_sum",
         "relative_humidity_2m_mean", "wind_speed_10m_max", "sunshine_duration", "shortwave_radiation_sum", "cloud_cover_mean"]
NAMES = {"time": "날짜", "temperature_2m_mean": "평균기온", "temperature_2m_max": "최고기온", "temperature_2m_min": "최저기온",
         "precipitation_sum": "강수량", "relative_humidity_2m_mean": "평균습도", "wind_speed_10m_max": "최대풍속",
         "shortwave_radiation_sum": "일사량", "cloud_cover_mean": "운량"}


def get(url, **p):
    import time
    for t in range(6):
        try:
            r = requests.get(url, timeout=60, params=p)
            r.raise_for_status()
            return r.json()
        except Exception as e:          # 연결 시간 초과·한도 초과면 잠시 뒤 다시
            print("재시도", t + 1, type(e).__name__)
            time.sleep(10 * (t + 1))
    raise RuntimeError("Open-Meteo 에 연결하지 못함")


for name, (lat, lon) in SITES.items():
    j = get("https://archive-api.open-meteo.com/v1/archive", latitude=lat, longitude=lon, start_date="2022-01-01",
            end_date="2025-12-31", daily=",".join(DAILY), timezone="Asia/Seoul")
    d = pd.DataFrame(j["daily"]).rename(columns=NAMES)
    d["일조시간"] = (d.pop("sunshine_duration") / 3600).round(1)
    d.to_csv(W / f"weather2_{name}.csv", index=False, encoding="utf-8-sig")
    print(name, len(d), d.isna().sum().to_dict())

j = get("https://archive-api.open-meteo.com/v1/archive", latitude=37.5665, longitude=126.978, start_date="2022-01-01",
        end_date="2025-12-31", hourly="cloud_cover,visibility,relative_humidity_2m,precipitation", timezone="Asia/Seoul")
h = pd.DataFrame(j["hourly"])
h["time"] = pd.to_datetime(h["time"])
for c in ["cloud_cover", "visibility", "relative_humidity_2m", "precipitation"]:
    h[c] = pd.to_numeric(h[c], errors="coerce")
h = h[(h["time"].dt.hour >= 21) | (h["time"].dt.hour <= 3)].copy()
h["밤날짜"] = (h["time"] - pd.Timedelta(hours=4)).dt.strftime("%Y-%m-%d")      # 21~23시는 그날 밤, 0~3시는 전날 밤에 붙인다
g = h.groupby("밤날짜").agg(밤_평균_구름량=("cloud_cover", "mean"), 밤_평균_시정=("visibility", "mean"),
                          밤_평균_습도=("relative_humidity_2m", "mean"), 밤_강수량=("precipitation", "sum")).reset_index()
g["밤_평균_시정"] = (g["밤_평균_시정"] / 1000).round(1)
g.to_csv(W / "night_seoul.csv", index=False, encoding="utf-8-sig")
print("night", len(g), g.isna().sum().to_dict())
