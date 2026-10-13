"""최종 수행평가지(수업자료/기계학습_예측·분류_수행평가지 (2).ipynb)의 코드 칸을 학생이 빈칸을 채운 그대로 따라 실행해 본다.
대상: csv_out 학생 자료(학번_data.csv, x·y 는 csv_work/specs/학번.json) + 선택자료 csv/학생용(x 후보는 교사용_데이터사전의 「x 후보 5개」).
각 자료마다 칸별로 오류·이상(행이 너무 줄어듦, 한 범주만 남음, pairplot 이 너무 느림, R² 음수 등)을 모은다.

사용: python nb_test.py [csv_out|선택|파일이름 일부 …]   결과: csv_work/nb_test_결과.csv
"""
import glob, io, json, re, sys, time, warnings, contextlib
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.tree import DecisionTreeClassifier, plot_tree
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, confusion_matrix

warnings.filterwarnings("ignore")
sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
SEL = ROOT / "선택자료 csv"
PAIR_SAMPLE_SEC = 25          # pairplot 이 이보다 오래 걸리면 「느림」으로 적는다(코랩은 이 컴퓨터보다 느리다)


def targets(want):
    out = []
    if not want or "csv_out" in want:
        for f in sorted(glob.glob(str(ROOT / "csv_out" / "*" / "*_data.csv"))):
            sid = re.match(r"(\d+)_", Path(f).name).group(1)
            sp = json.load(open(ROOT / "csv_work" / "specs" / f"{sid}.json", encoding="utf-8"))
            out.append(dict(name=sid, file=f, track=sp["track"], x=sp["x_cols"], y=sp["y"], kind="학생"))
    if not want or "선택" in want:
        for f in sorted((SEL / "학생용").glob("*.csv")):
            md = next((SEL / "교사용_데이터사전").glob(f.stem + "*.md"))
            t = md.read_text(encoding="utf-8")
            m = re.search(r"## x 후보 5개.*?\n(.+)\n\n맞힐 값: (.+)\n", t)
            out.append(dict(name=f.stem, file=str(f), track="분류" if f.stem.endswith("_분류") else "예측",
                            x=[c.strip() for c in m.group(1).split(", ")], y=m.group(2).strip(), kind="선택"))
    rest = [w for w in want if w not in ("csv_out", "선택")]
    if rest:
        out = [o for o in out if any(w in o["name"] for w in rest)]
    return out


def run(t):
    P, W = [], []                      # 문제(칸이 오류), 경고(돌기는 하지만 이상)
    xs, y = t["x"], t["y"]
    sink = io.StringIO()
    with contextlib.redirect_stdout(sink):
        # ① 불러오기 — 코랩 기본(인코딩 지정 안 함)
        df = pd.read_csv(t["file"])
        n0 = len(df)
        miss = [c for c in xs + [y] if c not in df.columns]
        if miss:
            return dict(P=[f"① 열 없음 {miss}"], W=[], info={})
        # ② 살펴보기
        df.head(); df.info(); d = df.describe()
        nonnum_x = [c for c in xs if not pd.api.types.is_numeric_dtype(df[c])]
        if nonnum_x:
            P.append(f"② x 가 숫자 열이 아님 {nonnum_x}")
        # ③ 결측 확인·제거
        df.isnull().sum()
        df = df.dropna()
        n1 = len(df)
        if n1 < 0.85 * n0:
            lost = pd.read_csv(t["file"]).drop(columns=xs + [y]).isna().sum()
            lost = lost[lost > 0].sort_values(ascending=False)
            P.append(f"③ dropna 뒤 {n1}/{n0}행만 남음 — 결측 많은 열: " + ", ".join(f"{k}({v})" for k, v in lost.head(4).items()))
        # 이상치: 예측 = y, 분류 = 첫 번째 x
        oc = y if t["track"] == "예측" else xs[0]
        sns.boxplot(y=df[oc]); plt.close("all")
        Q3, Q1 = df[oc].quantile(0.75), df[oc].quantile(0.25)
        IQR = Q3 - Q1
        df = df.loc[(df[oc] >= Q1 - 1.5 * IQR) & (df[oc] <= Q3 + 1.5 * IQR)]
        sns.boxplot(y=df[oc]); plt.close("all")
        n2 = len(df)
        if n2 < 100:
            P.append(f"③ 이상치 제거 뒤 {n2}행")
        info = dict(행=f"{n0}→{n1}→{n2}")
        if t["track"] == "예측":
            c = df.corr(numeric_only=True)
            if y not in c:
                return dict(P=P + ["④ y 가 상관표에 없음"], W=W, info=info)
            drop = c[y][xs].abs().idxmin()
            use = [v for v in xs if v != drop]
            x = df[use]; yy = df[y]
            x_train, x_test, y_train, y_test = train_test_split(x, yy, test_size=0.3, random_state=42)
            model = LinearRegression(); model.fit(x_train, y_train)
            for i in range(len(use)):
                print(model.coef_[i])
            model.predict(x_test)
            r2 = model.score(x_test, y_test)
            입력 = pd.DataFrame({k: [float(x_train[k].median())] for k in use})
            model.predict(입력)[0]
            mae = mean_absolute_error(y_test, model.predict(x_test))
            info.update(뺀열=drop, R2=round(r2, 3), MAE=round(mae, 3), y평균=round(float(yy.mean()), 3))
            if r2 < 0.2:
                W.append(f"⑧ 시험 R² {r2:.2f} 낮음")
            nnum = len(c.columns)
            if nnum > len(xs) + 1:
                info["상관표열수"] = nnum
        else:
            ycls = df[y].value_counts()
            if len(ycls) < 2:
                return dict(P=P + [f"③ 범주가 하나만 남음 {dict(ycls)}"], W=W, info=info)
            if ycls.min() / len(df) < 0.2:
                W.append(f"③ 뒤 범주 비율 치우침 {dict(ycls)}")
            nnum = df.select_dtypes("number").shape[1]
            t0 = time.time()
            if nnum <= 30:
                g = sns.pairplot(df, hue=y); plt.close("all")
                sec = time.time() - t0
            else:
                sec = None
            info.update(pairplot숫자열=nnum, pairplot초=None if sec is None else round(sec, 1))
            if sec is None:
                P.append(f"④ pairplot 숫자 열 {nnum}개 → 그림 {nnum}×{nnum}={nnum*nnum}칸(코랩에서 수 분 이상·메모리 부족 우려)")
            elif sec > PAIR_SAMPLE_SEC:
                W.append(f"④ pairplot {sec:.0f}초")
            cc = df[xs].corr().abs()
            pairs = sorted(((cc.loc[a, b], a, b) for i, a in enumerate(xs) for b in xs[i + 1:]), reverse=True)
            r, a, b = pairs[0]
            ry = df[xs].apply(lambda s: abs(s.corr((df[y] == ycls.index[0]).astype(int))))
            use = [v for v in xs if v != (a if ry[a] < ry[b] else b)]
            x = df[use]; yy = df[y]
            x_train, x_test, y_train, y_test = train_test_split(x, yy, test_size=0.3, random_state=42)
            dt = DecisionTreeClassifier(random_state=42).fit(x_train, y_train)
            dtr, dte = dt.score(x_train, y_train), dt.score(x_test, y_test)
            best = 0
            for dd in [1, 2, 3, 4, 5, 6, None]:
                dt2 = DecisionTreeClassifier(max_depth=dd, random_state=42).fit(x_train, y_train)
                best = max(best, dt2.score(x_test, y_test))
            plt.figure(figsize=(16, 8)); plot_tree(dt, feature_names=x.columns, class_names=dt.classes_, max_depth=2, filled=True, fontsize=11); plt.close("all")
            knn = KNeighborsClassifier(n_neighbors=3).fit(x_train, y_train)
            k1 = knn.score(x_test, y_test)
            sc = MinMaxScaler(); x_train2 = sc.fit_transform(x_train); x_test2 = sc.transform(x_test)
            knn = KNeighborsClassifier(n_neighbors=3).fit(x_train2, y_train)
            k2 = knn.score(x_test2, y_test)
            lr = LogisticRegression(max_iter=5000).fit(x_train, y_train)
            l1 = lr.score(x_test, y_test)
            cm = confusion_matrix(y_test, dt.predict(x_test))
            sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", xticklabels=dt.classes_, yticklabels=dt.classes_); plt.close("all")
            maj = float(y_test.value_counts(normalize=True).max())
            info.update(직선쌍=f"{a}~{b} {r:.2f}", 결정트리=f"{dtr:.2f}/{dte:.2f}", 최적깊이시험=round(best, 3), kNN전후=f"{k1:.2f}→{k2:.2f}", 로지스틱=round(l1, 3), 다수범주=round(maj, 3))
            if max(best, k2) < maj + 0.05:
                W.append(f"⑥⑦ 정확도가 다수범주({maj:.2f})와 비슷함")
    return dict(P=P, W=W, info=info)


def main():
    want = sys.argv[1:]
    rows = []
    for t in targets(want):
        t0 = time.time()
        try:
            r = run(t)
        except Exception as e:
            r = dict(P=[f"오류 {type(e).__name__}: {str(e)[:120]}"], W=[], info={})
        mark = "문제" if r["P"] else ("경고" if r["W"] else "통과")
        print(f"{mark} {t['kind']} {t['name']:16s} {r['info']} {' / '.join(r['P'] + r['W'])}  ({time.time()-t0:.0f}초)", flush=True)
        rows.append(dict(구분=t["kind"], 자료=t["name"], 유형=t["track"], 결과=mark, 문제=" / ".join(r["P"]), 경고=" / ".join(r["W"]), **r["info"]))
    out = pd.DataFrame(rows)
    out.to_csv(ROOT / "csv_work" / "nb_test_결과.csv", index=False, encoding="utf-8-sig")
    print("\n", out["결과"].value_counts().to_dict())


if __name__ == "__main__":
    main()
