"""KOBIS 일별 박스오피스(상위 10편)를 내려받아 csv_work/kobis_daily.csv 로 저장한다."""
import sys, time, requests, pandas as pd
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from common import env, WORK

KEY = env("KOBIS_KEY")
URL = "https://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json"
START, END = date(2023, 1, 1), date(2025, 12, 31)
COLS = ["rank", "rankInten", "rankOldAndNew", "movieCd", "movieNm", "openDt",
        "salesAmt", "audiCnt", "audiInten", "audiChange", "audiAcc", "scrnCnt", "showCnt"]

def one(d):
    for t in range(4):
        try:
            r = requests.get(URL, params={"key": KEY, "targetDt": d.strftime("%Y%m%d")}, timeout=30)
            L = r.json()["boxOfficeResult"]["dailyBoxOfficeList"]
            return [{"날짜": d.isoformat(), **{c: x.get(c) for c in COLS}} for x in L]
        except Exception:
            time.sleep(1.5 * (t + 1))
    print("실패", d); return []

days = [START + timedelta(n) for n in range((END - START).days + 1)]
with ThreadPoolExecutor(6) as ex:
    rows = [r for part in ex.map(one, days) for r in part]
df = pd.DataFrame(rows)
for c in ["rank", "rankInten", "salesAmt", "audiCnt", "audiInten", "audiChange", "audiAcc", "scrnCnt", "showCnt"]:
    df[c] = pd.to_numeric(df[c])
WORK.mkdir(exist_ok=True)
df.to_csv(WORK / "kobis_daily.csv", index=False, encoding="utf-8-sig")
print(len(df), "행,", df["날짜"].nunique(), "일,", df["movieCd"].nunique(), "편")
