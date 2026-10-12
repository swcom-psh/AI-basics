"""학생 CSV 검사 — CSV제작_원칙.md 의 규칙을 코드로 옮긴 것.

사용:  python -I csv_tools/check_csv.py csv_out/.../학번_data.csv csv_work/specs/학번.json
spec(JSON) 항목
  track        "예측" | "분류"
  id_cols      날짜·식별 열(문자열 허용, 결측 금지, 맨 앞에 둔다)
  x_cols       x 후보 열 5개(순서 그대로. 분류의 이상치 열 = 첫 번째)
  y            y 열(맨 뒤)
  binary_cols  0/1 열          int_cols  정수 열
  hard_range   {열: [최소, 최대]}  현실에서 있을 수 없는 값의 경계 (이상치도 이 안에 있어야 함)
  classes      분류의 두 범주
반환: {"fail": [...], "warn": [...], "metrics": {...}}  (fail 이 비어야 통과)

수행평가지 흐름을 그대로 실행해 본다 — dropna → 첫 x(또는 y) IQR 제거 → corr/직선 쌍 → 하나 빼고 x 4개 → train_test_split(0.3, 42) → 모델.
"""
import json, re, sys
import numpy as np
import pandas as pd

NUM = re.compile(r"^-?\d+(\.\d+)?$")
INT = re.compile(r"^-?\d+$")

# ── 원칙 수치 (CSV제작_원칙.md 와 같이 고칠 것) ──
MISS_ROW_RATE = (0.03, 0.06)      # 결측이 있는 행 / 전체
MISS_COL_RATE = (0.004, 0.022)    # 결측이 있는 열의 열당 비율 (0.5~2% 에 반올림 여유)
MISS_MIN_COLS = 3
OUT_RATE = (0.01, 0.03)           # 의도한 이상치 비율
OTHER_OUT_MAX = 0.02              # 다른 열의 IQR 밖 비율
OUT_MARGIN = 0.25                 # 이상치가 울타리에서 떨어져야 하는 거리(IQR 배수)
KEEP_MIN = 0.70                   # 결측·이상치 처리 뒤 남는 행
ROWS = (200, 1500)
R2_RANGE = (0.4, 0.9)
MAE_MAX_RATIO = 0.20
MINORITY_MIN = 0.20
ACC_MARGIN = 0.10
N_X = 5                           # x 후보는 정확히 5개 (하나를 빼고 4개를 쓴다)
WEAK_MAX = 0.12                   # 예측: 가장 약한 열의 |r|
WEAK_GAP = 0.05                   # 예측: 두 번째로 약한 열과의 차이
PAIR_MIN = 0.85                   # 분류: 직선 쌍의 |r|
PAIR_OTHER_MAX = 0.60             # 분류: 나머지 쌍의 |r|
PAIR_NOT_COPY = 0.995             # 같은 값을 복사한 열은 안 된다


def fence(s):
    q1, q3 = s.quantile(0.25), s.quantile(0.75)
    i = q3 - q1
    return q1 - 1.5 * i, q3 + 1.5 * i, i


def check(path, spec):
    F, W, M = [], [], {}
    fail = lambda m: F.append(m)
    warn = lambda m: W.append(m)

    raw = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    n = len(raw)
    M["행수"] = n
    ids, xs, y, track = spec.get("id_cols", []), spec["x_cols"], spec["y"], spec["track"]
    bins, ints = set(spec.get("binary_cols", [])), set(spec.get("int_cols", []))
    cols = list(raw.columns)

    # ── 1. 형식 ──
    if not (ROWS[0] <= n <= ROWS[1]):
        fail(f"행 수 {n} (기준 {ROWS[0]}~{ROWS[1]})")
    if cols != ids + xs + [y]:
        fail(f"열 순서가 [식별→x→y] 가 아님: {cols}")
    if any(c != c.strip() for c in cols) or len(set(cols)) != len(cols):
        fail("열 이름에 공백이 있거나 중복됨")
    if len(xs) != N_X:
        fail(f"x 후보 열 {len(xs)}개 (기준 정확히 {N_X}개)")

    numcols = xs + ([y] if track == "예측" else [])
    for c in numcols:
        bad = [v for v in raw[c] if v != "" and not NUM.match(v)]
        if bad:
            fail(f"[{c}] 숫자가 아닌 값 {len(bad)}개 예: {bad[:5]}")
        if c in ints:
            b2 = [v for v in raw[c] if v != "" and not INT.match(v)]
            if b2:
                fail(f"[{c}] 정수 열에 소수/문자 {len(b2)}개 예: {b2[:3]}")
        if c in bins:
            b3 = [v for v in raw[c] if v not in ("", "0", "1")]
            if b3:
                fail(f"[{c}] 0/1 이외의 값 {len(b3)}개 예: {b3[:3]}")
    if track == "분류":
        vals = [v for v in raw[y] if v != ""]
        if set(vals) != set(spec["classes"]):
            fail(f"[{y}] 범주가 {sorted(set(vals))} (기준 {spec['classes']})")
    for c in ids:
        if (raw[c] == "").any():
            fail(f"[{c}] 식별 열에 결측")
    key = ids if ids else cols
    if raw.duplicated(subset=key).any():
        fail(f"중복 행 {int(raw.duplicated(subset=key).sum())}개")

    # 숫자로 바꾼 표 (이후 검사는 이 표로)
    df = raw.copy()
    for c in numcols:
        df[c] = pd.to_numeric(raw[c].replace("", np.nan), errors="coerce")
    if track == "분류":
        df[y] = raw[y].replace("", np.nan)

    for c, (lo, hi) in spec.get("hard_range", {}).items():
        if c in df and pd.api.types.is_numeric_dtype(df[c]):
            bad = df[(df[c] < lo) | (df[c] > hi)][c]
            if len(bad):
                fail(f"[{c}] 현실 범위 [{lo},{hi}] 밖 {len(bad)}개 예: {bad.head(3).tolist()}")

    # ── 2. 결측 (원칙 4) ──
    miss_cols = {c: int(df[c].isna().sum()) for c in xs + [y] if df[c].isna().any()}
    M["열별결측"] = miss_cols
    row_miss = df[xs + [y]].isna().any(axis=1)
    M["결측행수"], M["결측행비율"] = int(row_miss.sum()), round(float(row_miss.mean()), 4)
    if len(miss_cols) < MISS_MIN_COLS:
        fail(f"결측이 있는 열 {len(miss_cols)}개 (기준 {MISS_MIN_COLS}개 이상)")
    if not (MISS_ROW_RATE[0] <= row_miss.mean() <= MISS_ROW_RATE[1]):
        fail(f"결측 행 비율 {row_miss.mean():.1%} (기준 {MISS_ROW_RATE[0]:.0%}~{MISS_ROW_RATE[1]:.0%})")
    for c, k in miss_cols.items():
        if not (MISS_COL_RATE[0] <= k / n <= MISS_COL_RATE[1]):
            fail(f"[{c}] 결측 {k}개 = {k/n:.2%} (열당 기준 0.5~2%)")

    # ── 3. 이상치 (원칙 5) ──
    ocol = y if track == "예측" else xs[0]
    M["이상치열"] = ocol
    s = df[ocol].dropna()
    if track == "분류" and (s.nunique() <= 10 or ocol in bins):
        fail(f"첫 번째 x 열 [{ocol}] 이 연속형이 아님 (값 {s.nunique()}종)")
    lo, hi, iqr = fence(s)
    out = df[(df[ocol] < lo) | (df[ocol] > hi)]
    rate = len(out) / len(s)
    M["이상치수"], M["이상치비율"] = len(out), round(rate, 4)
    M["이상치행"] = out.index.tolist()
    if not (OUT_RATE[0] <= rate <= OUT_RATE[1]):
        fail(f"[{ocol}] IQR 밖 {len(out)}개 = {rate:.2%} (기준 {OUT_RATE[0]:.0%}~{OUT_RATE[1]:.0%})")
    dist = np.where(out[ocol] > hi, (out[ocol] - hi) / iqr, (lo - out[ocol]) / iqr)
    if len(dist) and (dist < OUT_MARGIN).any():
        fail(f"[{ocol}] 울타리에 너무 가까운 이상치 {(dist < OUT_MARGIN).sum()}개 (기준 {OUT_MARGIN}×IQR 이상 떨어질 것)")
    for c in xs + ([y] if track == "예측" else []):
        if c == ocol or c in bins:
            continue
        l2, h2, _ = fence(df[c].dropna())
        r2 = float(((df[c] < l2) | (df[c] > h2)).sum()) / df[c].notna().sum()
        if r2 > OTHER_OUT_MAX:
            fail(f"[{c}] 의도하지 않은 IQR 밖 {r2:.1%} (기준 {OTHER_OUT_MAX:.0%} 이하)")
    both = out.index.intersection(df.index[row_miss])
    if len(both):
        fail(f"이상치 행에 결측이 겹침 {len(both)}행 (dropna 로 이상치가 사라짐)")

    # 학생이 처리한 뒤 (dropna → IQR 제거)
    clean = df.dropna(subset=xs + [y])
    l3, h3, _ = fence(clean[ocol])
    clean = clean[(clean[ocol] >= l3) & (clean[ocol] <= h3)]
    M["처리후행수"], M["처리후비율"] = len(clean), round(len(clean) / n, 4)
    if len(clean) / n < KEEP_MIN:
        fail(f"처리 뒤 남는 행 {len(clean)/n:.1%} (기준 {KEEP_MIN:.0%} 이상)")
    l4, h4, _ = fence(clean[ocol])
    resid = float(((clean[ocol] < l4) | (clean[ocol] > h4)).mean())
    if resid > 0.01:
        warn(f"[{ocol}] 제거 뒤에도 IQR 밖이 {resid:.1%} 남음 (연쇄 이상치)")

    # ── 4. x 구조 (원칙 1-3) 와 난이도 (원칙 1-4) ──
    if track == "예측":
        corr = clean[xs].corrwith(clean[y]).abs().sort_values()
        M["상관(|r|)"] = corr.round(3).to_dict()
        weak, gap = float(corr.iloc[0]), float(corr.iloc[1] - corr.iloc[0])
        M["최약열"] = corr.index[0]
        if weak > WEAK_MAX:
            fail(f"가장 약한 열 [{corr.index[0]}] |r|={weak:.2f} (기준 {WEAK_MAX} 이하)")
        if gap < WEAK_GAP:
            fail(f"가장 약한 열과 두 번째 열의 차이 {gap:.2f} (기준 {WEAK_GAP} 이상 — 평가지 ④ 「가장 낮은 1가지」가 분명해야 함)")
        if (corr.iloc[1:] >= 0.2).sum() < 4:
            warn(f"y와 |상관| 0.2 이상인 x가 {(corr.iloc[1:] >= 0.2).sum()}개 (4개 권장)")
        pick = [c for c in xs if c != corr.index[0]]
        M["선택x"] = pick
        r2, mae = _linreg(clean, pick, y)
        M["R2"], M["MAE"], M["MAE/평균"] = round(r2, 3), round(mae, 3), round(mae / clean[y].mean(), 3)
        if not (R2_RANGE[0] <= r2 <= R2_RANGE[1]):
            fail(f"다중 선형 회귀 R² {r2:.2f} (기준 {R2_RANGE[0]}~{R2_RANGE[1]})")
        if mae / clean[y].mean() > MAE_MAX_RATIO:
            fail(f"MAE/평균 {mae/clean[y].mean():.1%} (기준 {MAE_MAX_RATIO:.0%} 이하)")
    else:
        share = df[y].value_counts(normalize=True)
        M["범주비율"] = share.round(3).to_dict()
        if share.min() < MINORITY_MIN:
            fail(f"소수 범주 {share.idxmin()} = {share.min():.1%} (기준 {MINORITY_MIN:.0%} 이상)")
        y01 = (clean[y] == spec["classes"][0]).astype(int)
        ycorr = clean[xs].corrwith(y01).abs()
        M["상관(|r|)"] = ycorr.round(3).sort_values(ascending=False).to_dict()
        if ycorr.get(ocol, 0) < 0.1:
            warn(f"첫 번째 x [{ocol}] 와 y 의 |상관| {ycorr.get(ocol,0):.2f} — 지울 이유가 약함")
        xc = clean[xs].corr().abs()
        pairs = sorted(((float(xc.loc[a, b]), a, b) for i, a in enumerate(xs) for b in xs[i + 1:]), reverse=True)
        M["x쌍상관(상위3)"] = [(round(r, 2), a, b) for r, a, b in pairs[:3]]
        strong = [p for p in pairs if p[0] >= PAIR_MIN]
        if len(strong) != 1:
            fail(f"직선 쌍(|r|≥{PAIR_MIN})이 {len(strong)}개 (기준 정확히 1개). 상위: {M['x쌍상관(상위3)']}")
        else:
            r_, a_, b_ = strong[0]
            M["직선쌍"] = (a_, b_, round(r_, 2))
            if r_ >= PAIR_NOT_COPY:
                fail(f"직선 쌍 {a_}·{b_} 가 사실상 같은 값 (|r|={r_:.3f})")
        rest = [p for p in pairs if p[0] < PAIR_MIN and p[0] >= PAIR_OTHER_MAX]
        if rest:
            fail(f"직선 쌍 말고 |r|≥{PAIR_OTHER_MAX} 인 쌍이 있음: {[(round(r, 2), a, b) for r, a, b in rest[:3]]}")
        if len(strong) == 1:
            drop = a_ if ycorr[a_] < ycorr[b_] else b_
            pick = [c for c in xs if c != drop]
            M["뺄열(쌍 중 y와 약한 쪽)"] = drop
            if abs(ycorr[a_] - ycorr[b_]) < 0.015:
                warn(f"직선 쌍의 두 열이 y와 비슷한 정도 ({ycorr[a_]:.2f}, {ycorr[b_]:.2f}) — 뺄 근거가 약함")
        else:
            pick = list(ycorr.sort_values(ascending=False).index[:4])
        M["선택x"] = pick
        rngs = (clean[pick].max() - clean[pick].min()).replace(0, np.nan).dropna()
        ratio = float(rngs.max() / rngs.min())
        M["x값폭비"] = round(ratio, 1)
        if ratio < 10:
            warn(f"x 열 값의 폭 차이 {ratio:.1f}배 (10배 이상 권장 — 정규화 질문)")
        base = float(clean[y].value_counts(normalize=True).max())
        accs = _classify(clean, pick, y)
        M["다수범주기준"], M["정확도"] = round(base, 3), {k: round(v, 3) for k, v in accs.items()}
        for k in ("결정트리(최적깊이)", "로지스틱", "kNN(정규화,k=3)"):
            if accs[k] < base + ACC_MARGIN:
                fail(f"{k} 정확도 {accs[k]:.1%} < 다수 범주 {base:.1%} + {ACC_MARGIN:.0%}p")
    return {"fail": F, "warn": W, "metrics": M}


def _split(clean, cols, y):
    from sklearn.model_selection import train_test_split
    return train_test_split(clean[cols], clean[y], test_size=0.3, random_state=42)


def _linreg(clean, cols, y):
    from sklearn.linear_model import LinearRegression
    from sklearn.metrics import mean_absolute_error
    xt, xe, yt, ye = _split(clean, cols, y)
    m = LinearRegression().fit(xt, yt)
    return float(m.score(xe, ye)), float(mean_absolute_error(ye, m.predict(xe)))


def _classify(clean, cols, y):
    from sklearn.tree import DecisionTreeClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.neighbors import KNeighborsClassifier
    from sklearn.preprocessing import MinMaxScaler
    from sklearn.metrics import confusion_matrix
    xt, xe, yt, ye = _split(clean, cols, y)
    out = {}
    dt = DecisionTreeClassifier(random_state=42).fit(xt, yt)
    out["결정트리(기본)"] = dt.score(xe, ye)
    best = max(DecisionTreeClassifier(max_depth=d, random_state=42).fit(xt, yt).score(xe, ye) for d in [2, 3, 4, 5, 6, 7, None])
    out["결정트리(최적깊이)"] = best
    out["로지스틱"] = LogisticRegression(max_iter=5000).fit(xt, yt).score(xe, ye)
    out["kNN(정규화 전)"] = KNeighborsClassifier(3).fit(xt, yt).score(xe, ye)
    sc = MinMaxScaler().fit(xt)
    knn = KNeighborsClassifier(3).fit(sc.transform(xt), yt)
    out["kNN(정규화,k=3)"] = knn.score(sc.transform(xe), ye)
    confusion_matrix(ye, knn.predict(sc.transform(xe)))      # 평가지 ⑨ 가 오류 없이 도는지
    return out


def report(res, name=""):
    print(f"━━ {name}")
    for k, v in res["metrics"].items():
        if k not in ("이상치행",):
            print(f"  · {k}: {v}")
    for m in res["fail"]:
        print("  ✗ FAIL", m)
    for m in res["warn"]:
        print("  △ WARN", m)
    print("  →", "통과" if not res["fail"] else f"실패 {len(res['fail'])}건")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    spec = json.load(open(sys.argv[2], encoding="utf-8"))
    r = check(sys.argv[1], spec)
    report(r, sys.argv[1])
    sys.exit(1 if r["fail"] else 0)
