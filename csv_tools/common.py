"""CSV 만들기 공통 도구 — .env 읽기, 경로"""
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "csv_work"      # 내려받은 원자료(깃에 올리지 않음)
OUT = ROOT / "csv_out"        # 학생별 CSV(학번이 들어가서 깃에 올리지 않음)

def env(name):
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip()
    raise KeyError(f".env 에 {name} 이(가) 없습니다")


def roster():
    """분반 명단 {'20609': {'분반': 'B', '이름': '양지후'}, ...} — csv_work/roster.json (학생 이름이 있어 깃에 올리지 않음)"""
    import json
    return json.loads((WORK / "roster.json").read_text(encoding="utf-8"))

def class_dir(학번):
    """8자리 학번(2026+학년+반+번호) → csv_out/인공지능기초 A|B|C  (명단 코드 = "20" + 반 + 번호)"""
    r = roster()["20" + str(학번)[5:]]
    d = OUT / f"인공지능기초 {r['분반']}"
    d.mkdir(parents=True, exist_ok=True)
    return d, r["이름"]
