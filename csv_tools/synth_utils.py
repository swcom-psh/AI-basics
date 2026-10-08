"""CSV제작_원칙.md 의 결측·이상치를 만드는 도구. 값은 항상 숫자 타입을 유지한다."""
import numpy as np
import pandas as pd


def fence(s):
    q1, q3 = s.quantile(0.25), s.quantile(0.75)
    i = q3 - q1
    return q1 - 1.5 * i, q3 + 1.5 * i, i


def trim_natural(df, cols, max_rate=0.012, zero_cols=(), rounds=30):
    """자연스러운 극단값(IQR 밖)을 되풀이해 걷어 낸다. zero_cols 는 0%가 될 때까지."""
    df = df.copy()
    for _ in range(rounds):
        bad = pd.Series(False, index=df.index)
        again = False
        for c in cols:
            lo, hi, _ = fence(df[c])
            out = (df[c] < lo) | (df[c] > hi)
            lim = 0 if c in zero_cols else max_rate
            if out.mean() > lim:
                bad |= out
                again = True
        if not again:
            break
        df = df[~bad]
    return df


def add_outliers(df, col, n, seed, hard_range, decimals=0, upper_share=0.75):
    """col 에 IQR 울타리에서 0.5~3×IQR 떨어진 값 n 개를 넣는다. 넣은 행 번호를 돌려준다."""
    rng = np.random.RandomState(seed)
    lo, hi, iqr = fence(df[col].dropna())
    idx = rng.choice(df.index[df[col].notna()], n, replace=False)
    vals = []
    for _ in idx:
        up = rng.rand() < upper_share
        v = hi + rng.uniform(0.5, 3.0) * iqr if up else lo - rng.uniform(0.5, 2.0) * iqr
        if not (hard_range[0] <= v <= hard_range[1]):      # 불가능한 값이면 반대쪽
            v = hi + rng.uniform(0.5, 3.0) * iqr if not up else lo - rng.uniform(0.5, 2.0) * iqr
        v = min(max(v, hard_range[0]), hard_range[1])
        vals.append(round(v, decimals) if decimals else int(round(v)))
    df.loc[idx, col] = vals
    return list(idx)


def add_missing(df, cols, n_rows, seed, protect=()):
    """n_rows 개 행에 한 칸씩, cols 에 고르게 빈 칸을 만든다. protect 행은 건드리지 않는다."""
    rng = np.random.RandomState(seed)
    pool = [i for i in df.index if i not in set(protect)]
    rows = rng.choice(pool, n_rows, replace=False)
    order = np.resize(rng.permutation(len(cols)), n_rows)
    cells = []
    for r, k in zip(rows, order):
        df.loc[r, cols[k]] = np.nan
        cells.append((r, cols[k]))
    return cells
