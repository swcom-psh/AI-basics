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
           classes=None, 합성근거="", miss_cols=7, miss_rate=0.045, out_rate=0.02, 기간="", 현실점검="", pair_min=None, skip_out=(), r2_min=None, mae_max=None, weak_max=None, weak_gap=None, pair_other_max=None):
    hard, dec = dict(hard or {}), dict(dec or {})
    ints, bins = list(ints), list(bins)
    # 열 이름에는 밑줄(_)·공백을 쓰지 않는다 — 학생이 코드에서 이름을 칠 때 헷갈린다(선생님 결정 2026-10-13, 분반 C부터 적용)
    nm = lambda t: t.replace("_", "").replace(" ", "")
    d = d.rename(columns={c: nm(c) for c in d.columns})
    ids, x, y = [nm(c) for c in ids], [nm(c) for c in x], nm(y)
    ints, bins, skip_out = [nm(c) for c in ints], [nm(c) for c in bins], [nm(c) for c in skip_out]
    hard, dec = {nm(k): v for k, v in hard.items()}, {nm(k): v for k, v in dec.items()}
    d = d[ids + x + [y]].copy().dropna().reset_index(drop=True)
    ocol = y if track == "예측" else x[0]
    skip_out = list(skip_out)                       # 0이 대부분인 열(강수량 mm 등)은 IQR 밖이 자연스러워 정리·검사에서 뺀다(선생님 승인)
    cont = [c for c in x if c not in bins and c not in skip_out and d[c].nunique() > 10]
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
    for old in folder.glob(f"{학번}_*.csv"):          # 예전 「학번_이름.csv」가 남으면 서버가 그것을 줄 수 있다
        old.unlink()
    path = folder / f"{학번}_data.csv"
    d.to_csv(path, index=False, encoding="utf-8-sig", lineterminator="\n")
    spec = dict(track=track, id_cols=ids, x_cols=x, y=y, binary_cols=bins, int_cols=ints, hard_range=hard)
    if classes:
        spec["classes"] = list(classes)
    if pair_min:
        spec["pair_min"] = pair_min
    if skip_out:
        spec["skip_out_cols"] = skip_out
    if r2_min:
        spec["r2_min"] = r2_min
    if mae_max:
        spec["mae_max"] = mae_max
    if weak_max:
        spec["weak_max"] = weak_max
    if weak_gap:
        spec["weak_gap"] = weak_gap
    if pair_other_max:
        spec["pair_other_max"] = pair_other_max
    (WORK / "specs").mkdir(exist_ok=True)
    (WORK / "specs" / f"{학번}.json").write_text(json.dumps(spec, ensure_ascii=False, indent=1), encoding="utf-8")
    res = check_csv.check(path, spec)
    check_csv.report(res, path.name)
    M = res["metrics"]
    kind = "예측" if track == "예측" else f"분류({classes[0]} / {classes[1]})"
    clean = d.dropna(subset=x + [y])
    if track == "예측":
        sgn = {c: round(float(clean[c].corr(clean[y])), 2) for c in x}
    else:
        y01 = (clean[y] == classes[0]).astype(int)
        sgn = {c: round(float(clean[c].corr(y01)), 2) for c in x}
    구조 = (f"최약열(평가지 ④에서 빼게 되는 열): `{M.get('최약열')}`" if track == "예측"
            else f"직선 쌍: {M.get('직선쌍')} — 뺄 열(y와 약한 쪽): `{M.get('뺄열(쌍 중 y와 약한 쪽)')}`")
    md = f"""# {학번} {name} — 데이터 사전 (교사용, 학생에게 배부하지 않음)

- 주제: {kind} — {주제}
- y = `{y}`
- 자료등급: **{등급}** ({'실제 자료+규칙에 따른 결측·이상치' if 등급 in ('A', 'B') else '합성 자료: 그 분야에서 알려진 관계로 만든 값에 잡음을 더함. 결측·이상치는 규칙에 따라 인위적으로 만듦'})
- 출처/방법: {자료}
{('- 기간: ' + 기간) if 기간 else ''}
- 처리 전 {N0}행(자연 극단값을 걷어 낸 뒤), 시드 {시드}
- 변경 내역(챗봇 → CSV): {변경}
{('- 합성 근거(현실과의 일치 확인): ' + 합성근거) if 합성근거 else ''}
{('- 현실 점검(가장 약한 열·직선 쌍이 현실과 맞는지): ' + 현실점검) if 현실점검 else ''}

## 정답 (학생에게 알리지 않는다)
- **이상치 열: `{ocol}`** — 의도한 이상치 {len(out_rows)}개, 엑셀 기준 줄 번호 {sorted(int(i)+2 for i in out_rows)}
- 결측: {M['열별결측']} → 결측 행 {M['결측행수']}개({M['결측행비율']:.1%})
- 처리 뒤 남는 행: {M['처리후행수']}개({M['처리후비율']:.1%})

## 검증 결과 (check_csv.py)
- 실패: {res['fail'] or '없음'}
- 경고: {res['warn'] or '없음'}
- 평가지 ④ 구조: {구조}
- 학생이 쓰게 될 x 4개: {M.get('선택x')}
- {('R² ' + str(M.get('R2')) + ' / MAE ' + str(M.get('MAE')) + ' (y 평균 대비 ' + str(M.get('MAE/평균')) + ')') if track == '예측' else ('다수 범주 ' + str(M.get('다수범주기준')) + ' / 정확도 ' + str(M.get('정확도')) + ' / 범주 비율 ' + str(M.get('범주비율')))}
- |상관|: {M.get('상관(|r|)')}

## 학생 가설과 비교용 (세특 서술 근거) — 부호 있는 상관계수
{'(예측: y 와의 상관, +이면 늘어남·−이면 줄어듦)' if track == '예측' else f'(분류: 「{classes[0]}」일 때 값이 클수록 +)'}
{sgn}
"""
    (folder / f"{학번}_{name}_데이터사전.md").write_text(md, encoding="utf-8")
    return res
