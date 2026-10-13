"""선택자료 과제별로 어떤 규칙이 왜 안 맞는지 진단한다(사전 검사만)."""
import itertools
import numpy as np, pandas as pd
from sklearn.linear_model import LinearRegression
import screen_datasets as S

rows = []
for t in S.TASKS:
    W, yn = S.prepare(t)
    xs = [s["ko"] for s in t["X"]]
    cls = t["y"].get("classes")
    if t["track"] == "분류" and t["ratio"]:
        mino = cls[1] if t["ratio"] < 0.5 else cls[0]
        mi = W[W[yn] == mino]; ma = W[W[yn] != mino]
        W = pd.concat([mi, ma.sample(min(int(len(mi) * (1 - t["ratio"]) / t["ratio"]), len(ma)), random_state=1)]).reset_index(drop=True)
    d = W[xs + [yn]].dropna()
    if t["track"] == "분류":
        X = d[xs].astype(float); c = X.corr().abs()
        prs = sorted([(c.loc[a, b], a, b) for a, b in itertools.combinations(xs, 2)], reverse=True)
        top = prs[0] if prs else (0, "", "")
        n85 = sum(1 for p in prs if p[0] >= 0.85); n60 = sum(1 for p in prs if p[0] >= 0.60)
        # 「가장 강한 쌍이 분명」: 0.8 이상이고 2등보다 0.15 이상 큼, 다른 쌍은 0.7 미만인 5열 조합 수
        n_clear = 0
        for comb in itertools.combinations(xs, 5):
            cc = c.loc[list(comb), list(comb)].values; iu = np.triu_indices(5, 1); v = np.sort(cc[iu])[::-1]
            if v[0] >= 0.80 and v[0] < 0.99 and v[0] - v[1] >= 0.15: n_clear += 1
        rows.append(dict(과제=t["id"], 유형="분류", 행=len(d), 가장강한쌍=f"{top[1]}↔{top[2]} {top[0]:.2f}", 쌍0_85이상=n85, 쌍0_60이상=n60, 분명한쌍조합수=n_clear))
    else:
        X = d[xs].astype(float); y = d[yn].astype(float)
        r = X.corrwith(y).abs()
        best = None
        for comb in itertools.combinations(xs, 5):
            rr = r[list(comb)].sort_values()
            weak, gap = rr.iloc[0], rr.iloc[1] - rr.iloc[0]
            keep = list(rr.index[1:])
            m = LinearRegression().fit(X[keep], y); p = m.predict(X[keep])
            r2 = m.score(X[keep], y); mae = np.abs(p - y).mean() / abs(y.mean())
            cand = (weak + (0 if gap >= 0.05 else 0.05), weak, gap, r2, mae, comb)
            if best is None or cand[0] < best[0]: best = cand
        if best is None:
            rows.append(dict(과제=t["id"], 유형="예측", 행=len(d), 가장약한열최소=round(float(r.min()), 2), 약한열0_12이하조합수=0, 그조합의R2=np.nan, MAE비=np.nan)); continue
        okc = sum(1 for comb in itertools.combinations(xs, 5) if r[list(comb)].min() <= 0.12)
        rows.append(dict(과제=t["id"], 유형="예측", 행=len(d), 가장약한열최소=round(float(r.min()), 2), 약한열0_12이하조합수=okc, 그조합의R2=round(best[3], 2), MAE비=round(best[4], 2)))
pd.set_option("display.width", 250); pd.set_option("display.max_colwidth", 60)
df = pd.DataFrame(rows)
print(df[df.유형 == "분류"].drop(columns=["가장약한열최소", "약한열0_12이하조합수", "그조합의R2", "MAE비"], errors="ignore").to_string(index=False))
print(df[df.유형 == "예측"].dropna(axis=1, how="all").drop(columns=["가장강한쌍", "쌍0_85이상", "쌍0_60이상", "분명한쌍조합수"], errors="ignore").to_string(index=False))
