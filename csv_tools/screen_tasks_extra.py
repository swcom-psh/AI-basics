"""Rdatasets·fivethirtyeight 등에서 받은 자료(csv_work/extra/…)의 검사 과제. screen_datasets.main() 이 불러다 TASKS 에 더한다."""
import numpy as np
import pandas as pd
from pathlib import Path

K = Path(__file__).resolve().parent.parent / "csv_work" / "extra"


def rd(f, **kw):
    return lambda: pd.read_csv(K / f, low_memory=False, **kw)


def rq(f, q):
    return lambda: pd.read_csv(K / f, low_memory=False).query(q)


def build_tasks(N, B, T, Ycls, Ynum, yes):
    A = (tasks := []).append
    A(T("대학졸업률_예측", "", "미국 대학의 입시·재정 정보로 졸업률 예측", "교육·행정", "예측", Ynum("Grad.Rate", "졸업률(%)"),
        [N("Top10perc", "상위10%신입생비율(%)"), N("Outstate", "타주학생등록금(달러)"), N("Room.Board", "기숙사식비(달러)"), N("PhD", "박사교수비율(%)"), N("S.F.Ratio", "교수당학생수(명)"),
         N("perc.alumni", "기부동문비율(%)"), N("Expend", "학생당지출(상용로그,달러)", log=True), N("Books", "교재비(달러)"), N("Personal", "개인지출(달러)"), B("Private", "사립(0/1)", lambda s: (s == "Yes").astype(int))],
        loader=rq("R_College.csv", "`Grad.Rate` <= 100"), 출처="Rdatasets ISLR College (미국 대학 777곳, 1995년 US News)"))
    A(T("대학지원자_예측", "", "미국 대학의 규모와 입시 정보로 지원자 수 예측", "교육·행정", "예측", Ynum("Apps", "지원자수(상용로그,명)", log=True),
        [N("Accept", "합격자수(상용로그,명)", log=True), N("Top10perc", "상위10%신입생비율(%)"), N("F.Undergrad", "재학생수(상용로그,명)", log=True), N("Outstate", "타주학생등록금(달러)"), N("S.F.Ratio", "교수당학생수(명)"), N("PhD", "박사교수비율(%)"), N("Grad.Rate", "졸업률(%)")],
        loader=rd("R_College.csv"), 출처="Rdatasets ISLR College"))
    A(T("임금_예측", "", "근로자의 나이·학력 등으로 연봉 예측", "경제·행정·사회", "예측", Ynum("wage", "임금(천달러)"),
        [N("age", "나이(세)"), N("year", "조사연도(년)"), B("edu", "학력(1~5)", lambda s: s.astype(str).str[0].astype(int)), B("ins", "건강보험가입(0/1)", lambda s: s.astype(str).str.contains("1").astype(int)),
         B("job", "사무직(0/1)", lambda s: s.astype(str).str.contains("Info").astype(int)), B("mar", "기혼(0/1)", lambda s: s.astype(str).str.contains("Married").astype(int))],
        loader=lambda: pd.read_csv(K / "R_Wage.csv").assign(edu=lambda d: d["education"], ins=lambda d: d["health_ins"], job=lambda d: d["jobclass"], mar=lambda d: d["maritl"]),
        nmax=1500, 출처="Rdatasets ISLR Wage (미국 중부대서양 남성 근로자 3000명)"))
    A(T("교수연봉_예측", "", "대학 교수의 경력으로 9개월 연봉 예측", "경제·교육·행정", "예측", Ynum("salary", "연봉(달러)"),
        [N("yrs.since.phd", "박사후경과(년)"), N("yrs.service", "근속(년)"), B("rank", "정교수(0/1)", lambda s: (s == "Prof").astype(int)), B("discipline", "이공계열(0/1)", lambda s: (s == "B").astype(int)), B("sex", "남성(0/1)", lambda s: (s == "Male").astype(int))],
        loader=rd("R_Salaries.csv"), 출처="Rdatasets carData Salaries (미국 대학 교수 397명, 2008~09)"))
    A(T("대학진학_예측", "", "학생의 가정·학교 환경으로 최종 학력 연수 예측", "교육·사회복지", "예측", Ynum("education", "최종학력(년)"),
        [N("score", "성취도점수"), N("distance", "대학까지거리(10마일)"), N("tuition", "대학등록금(천달러)"), N("unemp", "지역실업률(%)"), N("wage", "지역시급(달러)"), B("fc", "아버지대졸(0/1)", lambda s: (s == "yes").astype(int)),
         B("mc", "어머니대졸(0/1)", lambda s: (s == "yes").astype(int))],
        loader=lambda: pd.read_csv(K / "R_CollegeDistance.csv").assign(fc=lambda d: d["fcollege"], mc=lambda d: d["mcollege"]), nmax=1500, 출처="Rdatasets AER CollegeDistance (미국 고교생 4739명 추적)"))
    A(T("신생아체중_예측", "", "산모의 나이·임신 기간 등으로 신생아 몸무게 예측", "의료·간호·보건", "예측", Ynum("weight", "신생아몸무게(파운드)"),
        [N("weeks", "임신기간(주)"), N("mage", "산모나이(세)"), N("fage", "아버지나이(세)"), N("visits", "산전검진횟수(회)"), N("gained", "임신중체중증가(파운드)"), B("hab", "흡연(0/1)", lambda s: (s == "smoker").astype(int))],
        loader=lambda: pd.read_csv(K / "R_ncbirths.csv").assign(hab=lambda d: d["habit"]).dropna(subset=["weeks", "fage", "visits", "gained", "habit"]), 출처="Rdatasets openintro ncbirths (미국 노스캐롤라이나 출생 1000건)"))
    A(T("저체중아_분류", "", "산모의 정보로 저체중아 출생 여부 분류", "의료·간호·보건", "분류", Ycls("lowbirthweight", lambda s: s.map({"low": "저체중", "not low": "정상체중"}), ("정상체중", "저체중")),
        [N("weeks", "임신기간(주)"), N("mage", "산모나이(세)"), N("fage", "아버지나이(세)"), N("visits", "산전검진횟수(회)"), N("gained", "임신중체중증가(파운드)")],
        loader=lambda: pd.read_csv(K / "R_ncbirths.csv").dropna(subset=["weeks", "fage", "visits", "gained"]), 출처="Rdatasets openintro ncbirths"))
    A(T("야구타율_예측", "", "프로야구 타자의 기록으로 OPS 예측", "스포츠·체육", "예측", Ynum("OPS", "OPS"),
        [N("games", "출전경기수(경기)"), N("HR", "홈런(개)"), N("walks", "볼넷(개)"), N("strike_outs", "삼진(개)"), N("stolen_bases", "도루(개)"), N("doubles", "2루타(개)"), N("RBI", "타점(점)")],
        loader=rq("R_mlb_players_18.csv", "AB >= 100"), 출처="Rdatasets openintro mlb_players_18 (메이저리그 2018 타자)"))
    A(T("체형_예측", "", "신체 둘레로 몸무게 예측", "체육·간호·보건", "예측", Ynum("wgt", "몸무게(kg)"),
        [N("age", "나이(세)"), N("hgt", "키(cm)"), N("che_gi", "가슴둘레(cm)"), N("wai_gi", "허리둘레(cm)"), N("hip_gi", "엉덩이둘레(cm)"), N("thi_gi", "허벅지둘레(cm)"), N("bic_gi", "위팔둘레(cm)"), N("wri_gi", "손목둘레(cm)")],
        loader=rd("R_bdims.csv"), 출처="Rdatasets openintro bdims (신체 측정 507명)"))
    A(T("성별_분류", "", "신체 치수로 성별 분류", "체육·간호·보건", "분류", Ycls("sex", lambda s: s.map({0: "여성", 1: "남성"}), ("여성", "남성")),
        [N("age", "나이(세)"), N("hgt", "키(cm)"), N("wgt", "몸무게(kg)"), N("sho_gi", "어깨둘레(cm)"), N("wai_gi", "허리둘레(cm)"), N("hip_gi", "엉덩이둘레(cm)"), N("wri_gi", "손목둘레(cm)")],
        loader=rd("R_bdims.csv"), 출처="Rdatasets openintro bdims"))
    A(T("영화수익_538_예측", "", "영화의 제작비·연도로 국내 흥행수입 예측", "미디어·경영", "예측", Ynum("domgross_2013$", "국내흥행수입(상용로그,달러)", log=True),
        [N("budget_2013$", "제작비(상용로그,달러)", log=True), N("year", "개봉연도(년)"), N("imdb_rating", "평점(0~10)")],
        loader=lambda: pd.read_csv(K / "F_movies.csv").assign(imdb_rating=lambda d: pd.to_numeric(d["imdb"].astype(str).str.extract(r"(\d+\.?\d*)")[0], errors="coerce")).dropna(subset=["domgross_2013$", "budget_2013$"]).query("`domgross_2013$` > 0"),
        출처="fivethirtyeight bechdel (영화 1794편)"))
    A(T("저체중_분류2", "", "산모의 습관과 정보로 조산 여부 분류", "의료·간호·보건", "분류", Ycls("premie", lambda s: s.map({"full term": "만삭", "premie": "조산"}), ("만삭", "조산")),
        [N("mage", "산모나이(세)"), N("fage", "아버지나이(세)"), N("visits", "산전검진횟수(회)"), N("gained", "임신중체중증가(파운드)"), N("weight", "신생아몸무게(파운드)")],
        loader=lambda: pd.read_csv(K / "R_ncbirths.csv").dropna(subset=["fage", "visits", "gained"]), 출처="Rdatasets openintro ncbirths"))
    return tasks
