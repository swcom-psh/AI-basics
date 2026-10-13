"""선택자료 과제가 규칙을 얼마나 풀면 통과하는지 본다(전체 검사 없이 사전 검사만)."""
import itertools, sys
import pandas as pd
import screen_datasets as S

TIERS = {
  "기준": {},
  "약한열≤0.20": dict(weak=0.20, gap=0.03),
  "+MAE≤30%·R²0.3~0.92": dict(weak=0.20, gap=0.03, r2lo=0.30, r2hi=0.92, mae=0.30),
  "+직선쌍 없이(분류)": dict(weak=0.20, gap=0.03, r2lo=0.30, r2hi=0.92, mae=0.30, need_pair=False, acc=0.08),
}
base = dict(S.TH)
rows = []
for t in S.TASKS:
    W, yname = S.prepare(t)
    xs = [s["ko"] for s in t["X"]]
    cls = t["y"].get("classes")
    if t["track"] == "분류" and t["ratio"]:
        mino = cls[1] if t["ratio"] < 0.5 else cls[0]
        mi = W[W[yname] == mino]; ma = W[W[yname] != mino]
        W = pd.concat([mi, ma.sample(min(int(len(mi) * (1 - t["ratio"]) / t["ratio"]), len(ma)), random_state=1)]).reset_index(drop=True)
    res = {"과제": t["id"], "유형": t["track"], "행": len(W)}
    for name, ch in TIERS.items():
        S.TH.clear(); S.TH.update(base); S.TH.update(ch)
        n = 0; best = None
        for comb in itertools.combinations(xs, 5):
            comb = list(comb)
            if t["track"] == "분류":
                cont = [c for c in comb if W[c].nunique() > 10]
                if not cont: continue
                f = min(cont, key=lambda c: abs(float(W[c].skew()))); comb = [f] + [c for c in comb if c != f]
            q = S.quick(W, comb, yname, t["track"], cls)
            if q: n += 1
        res[name] = n
    rows.append(res)
S.TH.clear(); S.TH.update(base)
d = pd.DataFrame(rows)
pd.set_option("display.width", 250)
print(d.to_string(index=False))
d.to_csv(S.ROOT / "규칙완화_분석.csv", index=False, encoding="utf-8-sig")
