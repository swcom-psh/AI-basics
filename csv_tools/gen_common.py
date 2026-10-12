"""학생 CSV 마무리 공통 단계 — 자연 극단값 정리 → 이상치·결측 넣기 → 저장 → 검사 → 데이터 사전.

각 학생의 생성 스크립트(build_*.py, 학번이 들어가서 깃에 올리지 않음)가 원자료/합성 표 d 를 만들고 finish() 를 부른다.
d 는 [식별열…, x…, y] 의 열을 모두 가진 표(결측·이상치는 아직 없음)여야 한다.
"""
import json
import numpy as np
import pandas as pd

from common import WORK, class_dir
from synth_utils import trim_natural, add_outliers, add_missing
import check_csv


def finish(학번, d, *, ids, x, y, track, 주제, 자료, 변경, 시드, 등급="B", ints=(), bins=(), hard=None, dec=None,
           classes=None, 합성근거="", miss_cols=7, miss_rate=0.045, out_rate=0.02, 기간=""):
    hard, dec = dict(hard or {}), dict(dec or {})
    ints, bins = list(ints), list(bins)
    d = d[ids + x + [y]].copy().dropna().reset_index(drop=True)
    ocol = y if track == "예측" else x[0]
    cont = [c for c in x if c not in bins and d[c].nunique() > 10]
    trim_cols = cont + ([y] if track == "예측" else [])
    d = trim_natural(d, trim_cols, max_rate=0.012, zero_cols=(ocol,)).reset_index(drop=True)
    N0 = len(d)
    for c in ints + bins:
        d[c] = d[c].astype(int)

    n_out = max(4, int(round(N0 * out_rate)))
    out_rows = add_outliers(d, ocol, n_out, 시드, hard.get(ocol, (-1e12, 1e12)), decimals=dec.get(ocol, 0))
    pool = x + ([y] if track == "예측" else [])
    rng = np.random.RandomState(시드 + 7)
    mc = list(rng.choice(pool, min(miss_cols, len(pool)), replace=False))
    per = int(np.ceil(0.0055 * N0))                  # 열마다 같은 개수(0.5~2.2%)로, 전체 결측 행은 3.5~6% 안에 오게
    while per * len(mc) / N0 < 0.035:
        per += 1
    cells = add_missing(d, mc, per * len(mc), 시드 + 1, protect=out_rows)

    for c in ints + bins:
        d[c] = d[c].astype("Int64")
    folder, name = class_dir(학번)
    path = folder / f"{학번}_{name}.csv"
    d.to_csv(path, index=False, encoding="utf-8-sig")
    spec = dict(track=track, id_cols=ids, x_cols=x, y=y, binary_cols=bins, int_cols=ints, hard_range=hard)
    if classes:
        spec["classes"] = list(classes)
    (WORK / "specs").mkdir(exist_ok=True)
    (WORK / "specs" / f"{학번}.json").write_text(json.dumps(spec, ensure_ascii=False, indent=1), encoding="utf-8")
    res = check_csv.check(path, spec)
    check_csv.report(res, path.name)
    M = res["metrics"]
    kind = "예측" if track == "예측" else f"분류({classes[0]} / {classes[1]})"
    md = f"""# {학번} {name} — 데이터 사전 (교사용, 학생에게 배부하지 않음)

- 주제: {kind} — {주제}
- y = `{y}`
- 자료등급: **{등급}** ({'실제 자료+규칙에 따른 결측·이상치' if 등급 in ('A', 'B') else '합성 자료: 그 분야에서 알려진 관계로 만든 값에 잡음을 더함. 결측·이상치는 규칙에 따라 인위적으로 만듦'})
- 출처/방법: {자료}
{('- 기간: ' + 기간) if 기간 else ''}
- 처리 전 {N0}행(자연 극단값을 걷어 낸 뒤), 시드 {시드}
- 변경 내역(챗봇 → CSV): {변경}
{('- 합성 근거(현실과의 일치 확인): ' + 합성근거) if 합성근거 else ''}

## 정답 (학생에게 알리지 않는다)
- **이상치 열: `{ocol}`** — 의도한 이상치 {len(out_rows)}개, 엑셀 기준 줄 번호 {sorted(int(i)+2 for i in out_rows)}
- 결측: {M['열별결측']} → 결측 행 {M['결측행수']}개({M['결측행비율']:.1%})
- 처리 뒤 남는 행: {M['처리후행수']}개({M['처리후비율']:.1%})

## 검증 결과 (check_csv.py)
- 실패: {res['fail'] or '없음'}
- 경고: {res['warn'] or '없음'}
- 선택 x(상관 상위 4): {M.get('선택x(상관상위4)')}
- {('R² ' + str(M.get('R2')) + ' / MAE ' + str(M.get('MAE')) + ' (y 평균 대비 ' + str(M.get('MAE/평균')) + ')') if track == '예측' else ('다수 범주 ' + str(M.get('다수범주기준')) + ' / 정확도 ' + str(M.get('정확도')) + ' / 범주 비율 ' + str(M.get('범주비율')))}
- |상관|: {M.get('상관(|r|)')}
"""
    (folder / f"{학번}_{name}_데이터사전.md").write_text(md, encoding="utf-8")
    return res
