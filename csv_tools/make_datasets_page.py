"""선택자료 웹 페이지(저장소 맨 위 datasets.html)를 만든다.
학생용 CSV 에서 열마다 값의 범위를 계산하고, datasets_info.py 의 설명과 합쳐 datasets_page_template.html 에 넣는다.
x 후보 5개(순서 그대로)는 교사용 데이터 사전의 「## x 후보 5개」 줄에서 읽는다. 정답(이상치 위치·빠지는 열)은 넣지 않는다.

사용: python make_datasets_page.py      (설명이 빠진 열이 있으면 알려 주고 멈춘다)
"""
import json, re, sys
from pathlib import Path

import pandas as pd

from datasets_info import INFO

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
SEL = ROOT / "선택자료 csv"
GROUPS = [
    ("스포츠", ["FIFA능력치_예측", "FIFA몸값_예측", "NBA득점_예측", "야구타율_예측"]),
    ("의료·생명", ["유방암_세포_분류", "심장병_분류", "당뇨발병_분류", "당뇨10만_분류", "당뇨진행도_예측", "체형_예측", "전복나이_예측"]),
    ("공학·환경", ["건물난방부하_예측", "콘크리트강도_예측", "에어포일소음_예측", "자동차연비_예측", "자동차연비_분류", "서울자전거대여_분류", "호주내일비_분류", "행성질량_예측"]),
    ("경제·부동산", ["춘천아파트_예측", "대만집값_예측", "캘리포니아집값_예측", "월세_예측", "다이아몬드가격_예측", "직원월급_예측", "은행가입_분류"]),
    ("교육·사회", ["학생성적_예측", "수학점수_예측", "학생불안_예측", "대학생우울_분류", "대학졸업률_예측", "대학지원자_예측", "타이타닉생존_분류"]),
    ("미디어·식품", ["영화흥행_예측", "음악에너지_예측", "음악조회수_예측", "패스트푸드열량_예측"]),
]


def fmt(v):
    """보기 좋은 숫자(유효숫자 3~4자리, 큰 수는 쉼표)."""
    if pd.isna(v):
        return ""
    a = abs(v)
    if a >= 1000:
        return f"{v:,.0f}"
    if a >= 100:
        return f"{v:.0f}" if float(v).is_integer() else f"{v:.1f}"
    if a >= 10:
        return f"{v:.1f}".rstrip("0").rstrip(".")
    if a >= 1:
        return f"{v:.2f}".rstrip("0").rstrip(".")
    if a == 0:
        return "0"
    return f"{v:.3g}"


def col_stat(s):
    s = s.dropna()
    if s.dtype == bool or not pd.api.types.is_numeric_dtype(s):
        vc = s.astype(str).value_counts()
        return dict(kind="text", n=int(vc.size), top=[[k, int(v)] for k, v in vc.head(4).items()])
    u = set(s.unique())
    if u <= {0, 1}:
        return dict(kind="bin", p1=round(float(s.mean()) * 100))
    return dict(kind="num", lo=fmt(s.quantile(0.05)), hi=fmt(s.quantile(0.95)), mean=fmt(s.mean()), int=bool((s == s.round()).all()))


def main():
    ok = pd.read_csv(SEL / "사용가능_목록.csv", encoding="utf-8-sig").set_index("과제")
    gid = {i: g for g, ids in GROUPS for i in ids}
    miss_all, out = [], []
    for f in sorted((SEL / "학생용").glob("*.csv")):
        tid = f.stem
        if tid not in INFO or tid not in gid:
            miss_all.append(f"{tid}: 자료 설명 없음")
            continue
        info, row = INFO[tid], ok.loc[tid]
        md = next((SEL / "교사용_데이터사전").glob(tid + "*.md")).read_text(encoding="utf-8")
        m = re.search(r"## x 후보 5개.*?\n(.+)\n\n맞힐 값: (.+)\n", md)
        xs, y = [c.strip() for c in m.group(1).split(", ")], m.group(2).strip()
        df = pd.read_csv(f, encoding="utf-8-sig")
        assert df.columns[0] == "번호" and df.columns[-1] == y and list(df.columns[-6:-1]) == xs, tid
        cols = []
        for c in df.columns[1:]:
            if c not in info["cols"]:
                miss_all.append(f"{tid}: 열 「{c}」 설명 없음")
                continue
            unit, desc, how = info["cols"][c]
            role = "y" if c == y else ("x" if c in xs else "ref")
            cols.append(dict(name=c, role=role, unit=unit, desc=desc, how=how, stat=col_stat(df[c]),
                             avoid=info.get("avoid", {}).get(c, "")))
        track = "분류" if tid.endswith("_분류") else "예측"
        grade = str(row["등급"])
        out.append(dict(
            id=tid, group=gid[tid], name=info["name"], track=track, rows=int(len(df)), ncol=int(df.shape[1]),
            what=info["what"], goal=info["goal"], how=info["how"], src=info["src"],
            note=info.get("note", []), avoid_note=info.get("avoid_note", ""),
            real="보정" if grade.startswith("B") else "실제",
            x=xs, y=y, classes=(sorted(df[y].dropna().unique().tolist()) if track == "분류" else None),
            file=f"선택자료 csv/학생용/{tid}.csv", cols=cols,
        ))
    if miss_all:
        print("설명이 빠졌습니다 — datasets_info.py 를 채우세요:\n  " + "\n  ".join(miss_all))
        sys.exit(1)
    order = {i: n for n, (g, ids) in enumerate(GROUPS) for i in ids}
    out.sort(key=lambda d: (order[d["id"]], [i for g, ids in GROUPS for i in ids].index(d["id"])))
    tpl = (Path(__file__).parent / "datasets_page_template.html").read_text(encoding="utf-8")
    data = json.dumps(dict(groups=[g for g, _ in GROUPS], sets=out), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = tpl.replace("/*__DATA__*/null", data)
    (ROOT / "datasets.html").write_text(html, encoding="utf-8")
    print(f"datasets.html 만듦 — 자료 {len(out)}개, 열 {sum(len(d['cols']) for d in out)}개, {len(html)//1024} KB")


if __name__ == "__main__":
    main()
