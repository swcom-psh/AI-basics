"""서울 일자료 날씨를 Open-Meteo(키 불필요)에서 받아 csv_work/weather_seoul.csv 로 저장한다.
기상청 ASOS 키가 생기면 이 파일을 대체하면 된다. 값은 관측 재분석 자료라 기상청 관측값과 조금 다르다."""
import sys, requests, pandas as pd
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "csv_work" / "weather_seoul.csv"
START, END = "2019-01-01", "2025-12-31"
DAILY = ["temperature_2m_mean", "temperature_2m_max", "temperature_2m_min",
         "precipitation_sum", "relative_humidity_2m_mean", "wind_speed_10m_max", "sunshine_duration"]

r = requests.get("https://archive-api.open-meteo.com/v1/archive", timeout=60, params={
    "latitude": 37.5665, "longitude": 126.978, "start_date": START, "end_date": END,
    "daily": ",".join(DAILY), "timezone": "Asia/Seoul"})
r.raise_for_status()
d = r.json()["daily"]
df = pd.DataFrame(d).rename(columns={
    "time": "날짜", "temperature_2m_mean": "평균기온", "temperature_2m_max": "최고기온",
    "temperature_2m_min": "최저기온", "precipitation_sum": "강수량", "relative_humidity_2m_mean": "평균습도",
    "wind_speed_10m_max": "최대풍속", "sunshine_duration": "일조시간초"})
df["일조시간"] = (df.pop("일조시간초") / 3600).round(1)
OUT.parent.mkdir(exist_ok=True)
df.to_csv(OUT, index=False, encoding="utf-8-sig")
print(OUT, len(df), "행", df["날짜"].iloc[0], "~", df["날짜"].iloc[-1])
print(df.isna().sum().to_dict())
