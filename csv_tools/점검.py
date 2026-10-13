"""학생 CSV·선택자료 점검의 유일한 입구 — 세 가지를 한 번에 본다.
  ① 규칙(check_csv.py): 결측·이상치 비율, 열 구성, ④ 구조 (학생 자료만 — 선택자료는 만들 때 규칙 예외를 따로 적용함)
  ② 평가지 흐름(nb_test.py): 수행평가지 코드 칸을 빈칸 채운 그대로 끝까지 실행(오류·pairplot 시간)
  ③ 채점(grade_check.py): 정해진 열에서 의도한 이상치가 IQR 로 지워지는지, ④ 정답이 하나인지, 서술형 질문에 답할 거리가 있는지

사용: python 점검.py [학번 | 선택 | csv_out | 자료이름 일부 …]   (없으면 전부)
결과: 화면 + csv_work/점검_결과.csv (학번이 들어 있어 csv_work 에만 쓴다)
make_student.py 도 반영 전에 이 점검(점검 함수)을 거친다.
"""
import contextlib, io, sys, time
from pathlib import Path

import pandas as pd

import check_csv
import grade_check
import nb_test

ROOT = Path(__file__).resolve().parent.parent


def 점검(t):
    """t: dict(kind, name, file, track, x, y, md[, spec]) → (문제 목록, 주의 목록, 지표)"""
    P, W, info = [], [], {}
    if t.get("spec"):
        with contextlib.redirect_stdout(io.StringIO()):
            r = check_csv.check(t["file"], t["spec"])
        P += ["규칙: " + f for f in r["fail"]]
        W += ["규칙: " + w for w in r["warn"]]
    try:
        r = nb_test.run(t)
        P += ["평가지: " + p for p in r["P"]]
        W += ["평가지: " + w for w in r["W"]]
        if r["info"].get("pairplot초") is not None:
            info["pairplot초"] = r["info"]["pairplot초"]
    except Exception as e:
        P.append(f"평가지: 오류 {type(e).__name__}: {str(e)[:100]}")
    try:
        p, w, i = grade_check.run(t)
        P += ["채점: " + x for x in p]
        W += ["채점: " + x for x in w]
        info.update(i)
    except Exception as e:
        P.append(f"채점: 오류 {type(e).__name__}: {str(e)[:100]}")
    return list(dict.fromkeys(P)), list(dict.fromkeys(W)), info


def main():
    want = sys.argv[1:]
    groups = [w for w in want if w in ("선택", "csv_out")]
    rest = [w for w in want if w not in ("선택", "csv_out")]
    T = grade_check.targets(groups or ([] if rest else []))
    if rest:
        T = [t for t in grade_check.targets([]) if any(w in t["name"] for w in rest)]
    rows = []
    t0 = time.time()
    for t in T:
        P, W, info = 점검(t)
        rows.append(dict(구분=t["kind"], 자료=t["name"], 유형=t["track"], 판정="문제" if P else ("주의" if W else "좋음"),
                         문제=" / ".join(P), 주의=" / ".join(W), **info))
    out = pd.DataFrame(rows)
    out.to_csv(ROOT / "csv_work" / "점검_결과.csv", index=False, encoding="utf-8-sig")
    for _, r in out.iterrows():
        if r["판정"] != "좋음":
            print(f"{r['판정']} {r['구분']} {r['자료']} | " + " / ".join(x for x in (r["문제"], r["주의"]) if x))
    print(f"\n{len(out)}개 점검({time.time()-t0:.0f}초):", out.groupby(["구분", "판정"]).size().to_dict())
    print("자세한 표: csv_work/점검_결과.csv")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
