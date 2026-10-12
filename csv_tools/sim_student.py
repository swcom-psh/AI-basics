"""수행평가지 코드 흐름을 학생처럼 그대로 실행해 본다 — 오류 없이 끝까지 돌고 열 형태가 맞는지만 본다(검사 기준은 check_csv.py).
사용: python sim_student.py   (csv_out 의 모든 학번_data.csv)"""
import glob, json, re, sys, warnings
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, confusion_matrix

warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parent.parent
sys.stdout.reconfigure(encoding="utf-8")
bad = 0
for f in sorted(glob.glob(str(ROOT / "csv_out" / "*" / "*_data.csv"))):
    sid = re.match(r"(\d+)_", Path(f).name).group(1)
    spec = json.load(open(ROOT / "csv_work" / "specs" / f"{sid}.json", encoding="utf-8"))
    tr, xs, y, ids = spec["track"], spec["x_cols"], spec["y"], spec["id_cols"]
    try:
        df = pd.read_csv(f)
        n0 = len(df)
        df.head(); df.info(buf=open("nul" if sys.platform == "win32" else "/dev/null", "w")); df.describe()
        df.isnull().sum()
        df = df.dropna()
        ocol = y if tr == "예측" else xs[0]
        Q3, Q1 = df[ocol].quantile(0.75), df[ocol].quantile(0.25)
        IQR = Q3 - Q1
        df = df.loc[(df[ocol] >= Q1 - 1.5 * IQR) & (df[ocol] <= Q3 + 1.5 * IQR)]
        non = [c for c in df.columns if df[c].dtype == object]
        assert set(non) <= set(ids + ([y] if tr == "분류" else [])), f"문자 열 {non}"
        c = df.corr(numeric_only=True)
        assert all(x in c.columns for x in xs), "숫자가 아닌 x"
        if tr == "예측":
            drop = c[y].drop(y).abs().idxmin()
            use = [x for x in xs if x != drop]
            a, b, yt, ye = train_test_split(df[use], df[y], test_size=0.3, random_state=42)
            m = LinearRegression().fit(a, yt)
            msg = f"R2 {m.score(b, ye):.2f} MAE {mean_absolute_error(ye, m.predict(b)):.1f} 빼는열 {drop}"
        else:
            cc = df[xs].corr().abs().where(~np.eye(len(xs), dtype=bool)).stack()
            (p, q) = cc.idxmax()
            use = [x for x in xs if x != q]
            a, b, yt, ye = train_test_split(df[use], df[y], test_size=0.3, random_state=42)
            dt = DecisionTreeClassifier(random_state=42).fit(a, yt)
            lr = LogisticRegression(max_iter=5000).fit(a, yt)
            sc = MinMaxScaler().fit(a)
            kn = KNeighborsClassifier(n_neighbors=3).fit(sc.transform(a), yt)
            confusion_matrix(ye, kn.predict(sc.transform(b)))
            msg = f"결정트리 {dt.score(b, ye):.2f} 로지스틱 {lr.score(b, ye):.2f} kNN(정규화) {kn.score(sc.transform(b), ye):.2f} 쌍 {p}·{q}"
        print(f"OK  {sid} {tr} {n0}→{len(df)}행  {msg}")
    except Exception as e:
        bad += 1
        print(f"ERR {sid} {tr}: {type(e).__name__} {e}")
print("오류", bad, "건")
