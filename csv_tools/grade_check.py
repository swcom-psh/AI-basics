"""채점 관점 전수 점검 — csv_out 학생 자료 + 선택자료 학생용. 수행평가지 흐름을 그대로 따라가며 기준과 서술형 문항의 「답할 거리」를 본다.
기준 수치는 check_csv.py 와 같다(결측 행 3~6%·결측 열 3개 이상·열당 0.4~2.2%, 이상치 1~3%·울타리에서 IQR 0.25배 이상, 다른 x 의 IQR 밖 ≤2%, 남는 행 ≥70%).

직접 실행하지 않는다 — 점검.py 가 불러 쓴다.
"""
import glob, json, re, sys, warnings
from pathlib import Path
import numpy as np, pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, confusion_matrix
from sklearn.tree import DecisionTreeClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import MinMaxScaler
import check_csv as C

warnings.filterwarnings("ignore"); sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
SEL = ROOT / "선택자료 csv"


def targets(want):
    T = []
    if not want or "csv_out" in want:
        for f in sorted(glob.glob(str(ROOT / "csv_out" / "*" / "*_data.csv"))):
            sid = re.match(r"(\d+)_", Path(f).name).group(1)
            sp = json.load(open(ROOT / "csv_work" / "specs" / f"{sid}.json", encoding="utf-8"))
            md = next(Path(f).parent.glob(f"{sid}_*_데이터사전.md")).read_text(encoding="utf-8")
            T.append(dict(kind="학생", name=sid, file=f, track=sp["track"], x=sp["x_cols"], y=sp["y"], md=md, spec=sp))
    if not want or "선택" in want:
        for f in sorted((SEL / "학생용").glob("*.csv")):
            md = next((SEL / "교사용_데이터사전").glob(f.stem + "*.md")).read_text(encoding="utf-8")
            m = re.search(r"## x 후보 5개.*?\n(.+)\n\n맞힐 값: (.+)\n", md)
            T.append(dict(kind="선택", name=f.stem, file=str(f), track="분류" if f.stem.endswith("_분류") else "예측",
                          x=[c.strip() for c in m.group(1).split(", ")], y=m.group(2).strip(), md=md))
    return T


def fence(s):
    q1, q3 = s.quantile(.25), s.quantile(.75); i = q3 - q1
    return q1 - 1.5 * i, q3 + 1.5 * i, i


def run(t):
    P, W, info = [], [], {}
    xs, y, tr = t["x"], t["y"], t["track"]
    raw = pd.read_csv(t["file"])
    n0 = len(raw)
    # ── 결측(영역 2) ──
    mc = raw[xs + [y]].isna().sum(); mc = mc[mc > 0]
    mrow = raw[xs + [y]].isna().any(axis=1).mean()
    info["결측행%"] = round(mrow * 100, 1); info["결측열수"] = len(mc)
    if not (C.MISS_ROW_RATE[0] <= mrow <= C.MISS_ROW_RATE[1]): P.append(f"결측 행 {mrow:.1%}(기준 3~6%)")
    if len(mc) < C.MISS_MIN_COLS: P.append(f"결측 열 {len(mc)}개(기준 3개 이상)")
    bad = [f"{k} {v/n0:.1%}" for k, v in mc.items() if not (C.MISS_COL_RATE[0] <= v / n0 <= C.MISS_COL_RATE[1])]
    if bad: W.append("열당 결측 비율 밖: " + ", ".join(bad))
    if raw.drop(columns=xs + [y]).isna().any().any(): P.append("참고·식별 열에 결측 → dropna 가 행을 더 지움")
    df = raw.dropna()
    # ── 이상치(영역 2) ──
    oc = y if tr == "예측" else xs[0]
    m = re.search(r"이상치 열: `(.+?)`.*?줄 번호 \[(.+?)\]", t["md"])
    if not m:
        P.append("교사용 사전에 이상치 정답 없음")
        intended = set()
    else:
        if m.group(1) != oc: P.append(f"이상치 열이 평가지 지정 열과 다름({m.group(1)} ≠ {oc})")
        intended = {int(v) - 2 for v in m.group(2).split(", ")} & set(df.index)
    lo, hi, iqr = fence(df[oc])
    out = set(df.index[(df[oc] < lo) | (df[oc] > hi)])
    info["이상치"] = f"{len(intended & out)}/{len(intended)}+{len(out - intended)}"
    rate = len(intended) / len(df) if len(df) else 0
    if intended - out: P.append(f"의도한 이상치 {len(intended - out)}개가 IQR 로 안 걸림")
    if not (C.OUT_RATE[0] <= rate <= C.OUT_RATE[1]): W.append(f"이상치 비율 {rate:.1%}(기준 1~3%)")
    if out - intended: W.append(f"의도 밖 {len(out - intended)}행도 지워짐")
    if intended & out:
        dist = min((lo - df.loc[i, oc]) if df.loc[i, oc] < lo else (df.loc[i, oc] - hi) for i in intended & out) / iqr if iqr else 0
        if dist < C.OUT_MARGIN: W.append(f"이상치가 울타리에 바짝 붙음({dist:.2f} IQR)")
    d = df.drop(index=list(out))
    keep = len(d) / n0
    info["남은행"] = f"{len(d)}({keep:.0%})"
    if keep < C.KEEP_MIN: P.append(f"남는 행 {keep:.0%}(기준 70% 이상)")
    # ── 영역 3·4 ──
    if tr == "예측":
        c = d[xs + [y]].corr()[y].drop(y).abs().sort_values()
        info["④뺄열"] = c.index[0]; info["④차이"] = round(c.iloc[1] - c.iloc[0], 3)
        c_raw = raw[xs + [y]].corr()[y].drop(y).abs().idxmin()
        if c_raw != c.index[0]: W.append(f"이상치 안 지우면 ④ 답이 「{c_raw}」로 바뀜")
        if c.iloc[1] - c.iloc[0] < 0.03: P.append(f"④ 가장 약한 열과 두 번째 차이 {c.iloc[1]-c.iloc[0]:.3f}")
        use = [v for v in xs if v != c.index[0]]
        a, b, ya, yb = train_test_split(d[use], d[y], test_size=.3, random_state=42)
        mo = LinearRegression().fit(a, ya)
        r2, r2t = mo.score(b, yb), mo.score(a, ya); mae = mean_absolute_error(yb, mo.predict(b))
        info.update(R2=round(r2, 2), MAE=f"{mae:.3g}(평균의 {mae/abs(yb.mean()):.0%})")
        if r2 < 0.3: W.append(f"질문7 R² {r2:.2f} 낮음")
        if r2 > 0.95: W.append(f"질문7 R² {r2:.2f} 지나치게 높음")
    else:
        cc = d[xs].corr().abs()
        p = sorted(((cc.loc[i, j], i, j) for k, i in enumerate(xs) for j in xs[k + 1:]), reverse=True)
        info["④직선쌍"] = f"{p[0][1]}~{p[0][2]} {p[0][0]:.2f}(다음 {p[1][0]:.2f})"
        if p[0][0] < 0.85: W.append(f"④ 직선 쌍 상관 {p[0][0]:.2f}(0.85 미만)")
        if p[0][0] - p[1][0] < 0.15: P.append(f"④ 직선 쌍이 하나로 뚜렷하지 않음({p[0][0]:.2f} vs {p[1][0]:.2f})")
        if d[p[0][1]].nunique() <= 2 or d[p[0][2]].nunique() <= 2: W.append("④ 직선 쌍에 0/1 열 → pairplot 에서 직선이 안 보임")
        y01 = (d[y] == sorted(d[y].unique())[0]).astype(int)
        ry = d[xs].apply(lambda s: abs(s.corr(y01)))
        drop = p[0][1] if ry[p[0][1]] < ry[p[0][2]] else p[0][2]
        use = [v for v in xs if v != drop]
        a, b, ya, yb = train_test_split(d[use], d[y], test_size=.3, random_state=42)
        dt = DecisionTreeClassifier(random_state=42).fit(a, ya)
        tr_, te_ = dt.score(a, ya), dt.score(b, yb)
        curve = {k: DecisionTreeClassifier(max_depth=k, random_state=42).fit(a, ya).score(b, yb) for k in [1, 2, 3, 4, 5, 6, None]}
        bk = max(curve, key=curve.get)
        k1 = KNeighborsClassifier(3).fit(a, ya).score(b, yb)
        sc = MinMaxScaler().fit(a); k2 = KNeighborsClassifier(3).fit(sc.transform(a), ya).score(sc.transform(b), yb)
        span = (a.max() - a.min()); span = span[span > 0]
        ratio = span.max() / span.min()
        maj = yb.value_counts(normalize=True).max()
        info.update(DT=f"{tr_:.2f}/{te_:.2f}", 최적깊이=f"{bk}({curve[bk]:.2f})", kNN=f"{k1:.2f}→{k2:.2f}", 폭큰열=f"{span.idxmax()} {ratio:.0f}배", 다수=round(maj, 2))
        if tr_ - te_ < 0.05: W.append(f"질문6 과대적합이 잘 안 보임({tr_:.2f}/{te_:.2f})")
        if bk is None or curve[bk] - curve[None] < 0.01: W.append("질문7 깊이를 제한해도 시험 정확도가 안 오름")
        if ratio < 10 or k2 - k1 < 0.02: W.append(f"질문7(kNN) 정규화 효과 작음(폭 {ratio:.0f}배, {k1:.2f}→{k2:.2f})")
        for name, mdl, xt in [("결정트리", dt, b), ("kNN정규화", KNeighborsClassifier(3).fit(sc.transform(a), ya), sc.transform(b))]:
            cm = confusion_matrix(yb, mdl.predict(xt))
            if (cm == 0).any(): W.append(f"질문8 {name} 혼동행렬에 0인 칸")
        if max(curve.values()) < maj + 0.05: W.append(f"정확도가 다수범주({maj:.2f})와 비슷")
    return P, W, info
