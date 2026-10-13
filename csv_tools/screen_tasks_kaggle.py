"""Kaggle 에서 받은 자료(csv_work/kaggle/…)의 검사 과제 정의. screen_datasets.main() 이 불러다 TASKS 에 더한다.
열 이름은 학생이 알아보기 좋게 한글로(밑줄·공백 없음). 큰 자료는 loader 에서 미리 줄인다."""
import numpy as np
import pandas as pd
from pathlib import Path

K = Path(__file__).resolve().parent.parent / "csv_work" / "kaggle"


def rd(rel, **kw):
    return lambda: pd.read_csv(K / rel, low_memory=False, **kw)


def build_tasks(N, B, T, Ycls, Ynum, yes):
    tasks = []
    A = tasks.append

    # ───── 스포츠 ─────
    A(T("NBA득점_예측", "", "NBA 선수의 시즌 기록으로 경기당 득점 예측", "스포츠·체육", "예측", Ynum("pts", "경기당득점(점)"),
        [N("age", "나이(세)"), N("player_height", "키(cm)"), N("player_weight", "몸무게(kg)"), N("gp", "출전경기수(경기)"), N("reb", "경기당리바운드(개)"), N("ast", "경기당어시스트(개)"),
         N("usg_pct", "공격점유율(%)", mul=100), N("ts_pct", "슛효율(%)", mul=100), N("net_rating", "팀득실마진")],
        loader=lambda: pd.read_csv(K / "justinas_nba-players-data/all_seasons.csv").query("gp >= 20 and ts_pct > 0.2 and ts_pct < 0.9"),
        출처="Kaggle justinas/nba-players-data (NBA 선수 시즌 기록, 라이선스 표시: other)"))
    A(T("FIFA능력치_예측", "", "축구 선수의 세부 능력으로 종합 능력치 예측", "스포츠·체육", "예측", Ynum("overall", "종합능력치(점)"),
        [N("age", "나이(세)"), N("height_cm", "키(cm)"), N("weight_kg", "몸무게(kg)"), N("weak_foot", "약한발능력(1~5)"), N("skill_moves", "개인기등급(1~5)"), N("international_reputation", "국제적명성(1~5)"),
         N("pace", "속도"), N("shooting", "슈팅"), N("passing", "패스"), N("dribbling", "드리블"), N("defending", "수비"), N("physic", "피지컬")],
        loader=lambda: pd.read_csv(K / "stefanoleone992_fifa-20-complete-player-dataset/players_20.csv", low_memory=False).dropna(subset=["pace"]),
        nmax=1200, 출처="Kaggle stefanoleone992/fifa-20-complete-player-dataset (FIFA 20 선수 자료, CC0)"))
    A(T("FIFA몸값_예측", "", "축구 선수의 능력으로 몸값(유로) 예측", "스포츠·체육·경영", "예측", Ynum("value_eur", "몸값(상용로그,유로)", log=True),
        [N("age", "나이(세)"), N("overall", "종합능력치(점)"), N("potential", "잠재력(점)"), N("international_reputation", "국제적명성(1~5)"), N("skill_moves", "개인기등급(1~5)"), N("weak_foot", "약한발능력(1~5)"),
         N("height_cm", "키(cm)"), N("weight_kg", "몸무게(kg)")],
        loader=lambda: pd.read_csv(K / "stefanoleone992_fifa-20-complete-player-dataset/players_20.csv", low_memory=False).query("value_eur > 0"),
        출처="Kaggle stefanoleone992/fifa-20-complete-player-dataset (CC0)"))

    # ───── 미디어·음악·영화 ─────
    sp = lambda: pd.read_csv(K / "maharshipandya_-spotify-tracks-dataset/dataset.csv").drop_duplicates("track_id").sample(6000, random_state=1)
    SPX = [N("loudness", "음량(dB)"), N("acousticness", "어쿠스틱정도(0~1)"), N("valence", "긍정도(0~1)"), N("danceability", "춤추기좋은정도(0~1)"), N("tempo", "템포(BPM)"),
           N("speechiness", "말소리비율(0~1)"), N("instrumentalness", "연주곡정도(0~1)"), N("liveness", "라이브느낌(0~1)"), N("duration_ms", "길이(분)", mul=1 / 60000),
           N("key", "조(0~11)"), B("mode", "장조(0/1)", lambda s: s.astype(int))]
    A(T("음악에너지_예측", "", "음악의 음향 특성으로 에너지(0~1) 예측", "음악·미디어·소프트웨어", "예측", Ynum("energy", "에너지(0~1)"), SPX, loader=sp,
        출처="Kaggle maharshipandya/-spotify-tracks-dataset (Spotify 곡 114,000건 중 6,000건 표본, ODbL)"))
    A(T("음악인기도_예측", "", "음악의 음향 특성으로 인기도(0~100) 예측", "음악·미디어·소프트웨어", "예측", Ynum("popularity", "인기도(0~100)"),
        [x for x in SPX if x["ko"] != "에너지"] + [N("energy", "에너지(0~1)")], loader=sp, 출처="Kaggle maharshipandya/-spotify-tracks-dataset (ODbL)"))
    A(T("영화수익_예측", "", "영화 정보로 수익(백만 달러) 예측", "영화·미디어·경영", "예측", Ynum("Revenue (Millions)", "수익(백만달러)"),
        [N("Runtime (Minutes)", "상영시간(분)"), N("Rating", "평점(0~10)"), N("Votes", "투표수(상용로그)", log=True), N("Metascore", "메타점수(0~100)"), N("Year", "개봉연도(년)")],
        loader=rd("PromptCloudHQ_imdb-data/IMDB-Movie-Data.csv"), 출처="Kaggle PromptCloudHQ/imdb-data (IMDB 영화 1,000편 2006~2016)"))
    A(T("영화흥행_예측", "", "영화의 제작비·평점으로 흥행수입(달러) 예측", "영화·미디어·경영", "예측", Ynum("gross", "흥행수입(상용로그,달러)", log=True),
        [N("budget", "제작비(상용로그,달러)", log=True), N("votes", "투표수(상용로그)", log=True), N("score", "평점(0~10)"), N("runtime", "상영시간(분)"), N("year", "개봉연도(년)")],
        loader=lambda: pd.read_csv(K / "danielgrijalvas_movies/movies.csv").query("budget > 0 and gross > 0"), 출처="Kaggle danielgrijalvas/movies (영화 7,668편, CC0)"))
    A(T("음악조회수_예측", "", "음악 영상의 반응으로 유튜브 조회수 예측", "미디어·광고·음악", "예측", Ynum("Views", "유튜브조회수(상용로그)", log=True),
        [N("Likes", "좋아요수(상용로그)", log=True), N("Comments", "댓글수(상용로그)", log=True), N("Danceability", "춤추기좋은정도(0~1)"), N("Energy", "에너지(0~1)"), N("Valence", "긍정도(0~1)"),
         N("Loudness", "음량(dB)"), N("Duration_ms", "길이(분)", mul=1 / 60000)],
        loader=lambda: pd.read_csv(K / "salvatorerastelli_spotify-and-youtube/Spotify_Youtube.csv").query("Views > 0 and Likes > 0 and Comments > 0"),
        출처="Kaggle salvatorerastelli/spotify-and-youtube (Spotify 곡과 유튜브 영상 20,718건)"))

    # ───── 경찰·교통·행정 ─────
    A(T("운전습관_분류", "", "스마트폰 움직임 센서로 공격적 운전/보통 운전 분류", "경찰·교통·공학", "분류",
        Ycls("Class", lambda s: s.map({"AGGRESSIVE": "공격적운전", "NORMAL": "보통운전"}), ("보통운전", "공격적운전")),
        [N("AccX", "가속도X"), N("AccY", "가속도Y"), N("AccZ", "가속도Z"), N("GyroX", "회전속도X"), N("GyroY", "회전속도Y"), N("GyroZ", "회전속도Z")],
        loader=lambda: pd.read_csv(K / "outofskills_driving-behavior/train_motion_data.csv").query("Class in ['AGGRESSIVE','NORMAL']"), 출처="Kaggle outofskills/driving-behavior (스마트폰 센서)"))

    # ───── 심리·교육 ─────
    ST = lambda: pd.read_csv(K / "mdsultanulislamovi_student-stress-monitoring-datasets/StressLevelDataset.csv")
    STX = [N("anxiety_level", "불안수준(0~21)"), N("self_esteem", "자존감(0~30)"), N("depression", "우울수준(0~27)"), N("sleep_quality", "수면의질(0~5)"), N("study_load", "학업부담(0~5)"),
           N("social_support", "사회적지지(0~3)"), N("noise_level", "소음수준(0~5)"), N("bullying", "괴롭힘경험(0~5)"), N("headache", "두통빈도(0~5)"), N("peer_pressure", "또래압박(0~5)")]
    A(T("학생스트레스_분류", "", "학생의 심리·생활 점수로 스트레스 높음/낮음 분류", "심리·교육·간호", "분류",
        Ycls("stress_level", lambda s: s.map({0: "스트레스낮음", 2: "스트레스높음"}), ("스트레스낮음", "스트레스높음")), STX,
        loader=lambda: ST().query("stress_level in [0, 2]"), 출처="Kaggle mdsultanulislamovi/student-stress-monitoring-datasets"))
    A(T("학생불안_예측", "", "학생의 심리·생활 점수로 불안수준 예측", "심리·교육·간호", "예측", Ynum("anxiety_level", "불안수준(0~21)"), [x for x in STX if x["ko"] != "불안수준(0~21)"] + [N("blood_pressure", "혈압등급(1~3)")],
        loader=ST, 출처="Kaggle mdsultanulislamovi/student-stress-monitoring-datasets"))
    A(T("대학생우울_분류", "", "대학생의 생활로 우울 여부 분류", "심리·교육·간호", "분류", Ycls("Depression", lambda s: s.map({0: "우울아님", 1: "우울"}), ("우울아님", "우울")),
        [N("Age", "나이(세)"), N("Academic Pressure", "학업압박(0~5)"), N("CGPA", "학점(0~10)"), N("Study Satisfaction", "학업만족도(0~5)"), N("Work/Study Hours", "공부시간(시간/일)"),
         N("Financial Stress", "경제적스트레스(1~5)"), B("Have you ever had suicidal thoughts ?", "자살생각경험(0/1)", yes), B("Family History of Mental Illness", "가족정신질환력(0/1)", yes)],
        loader=lambda: pd.read_csv(K / "hopesb_student-depression-dataset/Student Depression Dataset.csv").assign(**{"Financial Stress": lambda d: pd.to_numeric(d["Financial Stress"], errors="coerce")}).sample(8000, random_state=1),
        ratio=0.40, 출처="Kaggle hopesb/student-depression-dataset (인도 대학생 설문)"))
    A(T("수학점수_예측", "", "학생의 읽기·쓰기 점수와 환경으로 수학 점수 예측", "교육·초등교육·사회복지", "예측", Ynum("MathScore", "수학점수(0~100)"),
        [N("ReadingScore", "읽기점수(0~100)"), N("WritingScore", "쓰기점수(0~100)"), B("TestPrep", "시험준비과정이수(0/1)", lambda s: (s == "completed").astype(int)),
         B("LunchType", "표준급식(0/1)", lambda s: (s == "standard").astype(int)), B("Gender", "여학생(0/1)", lambda s: (s == "female").astype(int))],
        loader=lambda: pd.read_csv(K / "desalegngeb_students-exam-scores/Original_data_with_more_rows.csv").dropna(subset=["MathScore"]).sample(5000, random_state=1),
        출처="Kaggle desalegngeb/students-exam-scores (학생 시험 점수)"))

    # ───── 식품·건강 ─────
    def ff():
        d = pd.read_csv(K / "joebeachcapital_fast-food/FastFoodNutritionMenuV3.csv")
        d.columns = ["회사", "메뉴", "열량", "지방열량", "지방", "포화지방", "트랜스지방", "콜레스테롤", "나트륨", "탄수화물", "식이섬유", "당류", "단백질", "웨이트워처점수"]
        for c in d.columns[2:]:
            d[c] = pd.to_numeric(d[c], errors="coerce")
        return d
    A(T("패스트푸드열량_예측", "", "패스트푸드 메뉴의 영양 성분으로 열량(kcal) 예측", "식품·영양·조리", "예측", Ynum("열량", "열량(kcal)"),
        [N("지방", "지방(g)"), N("포화지방", "포화지방(g)"), N("콜레스테롤", "콜레스테롤(mg)"), N("나트륨", "나트륨(mg)"), N("탄수화물", "탄수화물(g)"), N("식이섬유", "식이섬유(g)"), N("당류", "당류(g)"), N("단백질", "단백질(g)")],
        loader=ff, 출처="Kaggle joebeachcapital/fast-food (패스트푸드 메뉴 영양표)"))
    A(T("뇌졸중_분류", "", "환자 정보로 뇌졸중 발생 여부 분류(발생 비율 맞춤)", "의료·간호·약학", "분류", Ycls("stroke", lambda s: s.map({0: "뇌졸중없음", 1: "뇌졸중"}), ("뇌졸중없음", "뇌졸중")),
        [N("age", "나이(세)"), N("avg_glucose_level", "평균혈당"), N("bmi", "체질량지수"), B("hypertension", "고혈압(0/1)", lambda s: s.astype(int)), B("heart_disease", "심장질환(0/1)", lambda s: s.astype(int)),
         B("ever_married", "결혼경험(0/1)", yes)], loader=rd("fedesoriano_stroke-prediction-dataset/healthcare-dataset-stroke-data.csv"), ratio=0.30,
        비고="뇌졸중 5%라 학습용으로 30%가 되게 뇌졸중 없음을 덜어 냄", 출처="Kaggle fedesoriano/stroke-prediction-dataset (환자 5,110명)"))
    A(T("당뇨10만_분류", "", "건강검진 수치로 당뇨 여부 분류(당뇨 비율 맞춤)", "의료·간호·약학", "분류", Ycls("diabetes", lambda s: s.map({0: "당뇨아님", 1: "당뇨"}), ("당뇨아님", "당뇨")),
        [N("age", "나이(세)"), N("bmi", "체질량지수"), N("HbA1c_level", "당화혈색소(%)"), N("blood_glucose_level", "혈당"), B("hypertension", "고혈압(0/1)", lambda s: s.astype(int)),
         B("heart_disease", "심장질환(0/1)", lambda s: s.astype(int))], loader=lambda: pd.read_csv(K / "iammustafatz_diabetes-prediction-dataset/diabetes_prediction_dataset.csv").sample(12000, random_state=1),
        ratio=0.30, 비고="당뇨 8.5%라 학습용으로 30%가 되게 당뇨 아님을 덜어 냄", 출처="Kaggle iammustafatz/diabetes-prediction-dataset"))
    A(T("운동칼로리_예측", "", "운동 정보로 소모 칼로리 예측", "체육·스포츠·간호", "예측", Ynum("Calories Burn", "소모칼로리(kcal)"),
        [N("Duration", "운동시간(분)"), N("Heart Rate", "심박수(회/분)"), N("Actual Weight", "몸무게(kg)"), N("Age", "나이(세)"), N("BMI", "체질량지수"), N("Exercise Intensity", "운동강도(1~10)")],
        loader=rd("aakashjoshi123_exercise-and-fitness-metrics-dataset/exercise_dataset.csv"), 출처="Kaggle aakashjoshi123/exercise-and-fitness-metrics-dataset"))

    # ───── 경영·경제·부동산 ─────
    HR = rd("rishikeshkonapure_hr-analytics-prediction/HR-Employee-Attrition.csv")
    A(T("직원퇴직_분류", "", "직원 정보로 퇴직 여부 분류(퇴직 비율 맞춤)", "경영·인사·사회", "분류", Ycls("Attrition", lambda s: s.map({"No": "재직", "Yes": "퇴직"}), ("재직", "퇴직")),
        [N("Age", "나이(세)"), N("MonthlyIncome", "월급(달러)"), N("TotalWorkingYears", "총근무경력(년)"), N("YearsAtCompany", "현직장근속(년)"), N("DistanceFromHome", "집과의거리(마일)"),
         N("JobLevel", "직급(1~5)"), N("NumCompaniesWorked", "이전근무회사수(곳)"), N("PercentSalaryHike", "급여인상률(%)")], loader=HR, ratio=0.35,
        비고="퇴직 16%라 학습용으로 35%가 되게 재직을 덜어 냄", 출처="Kaggle rishikeshkonapure/hr-analytics-prediction (IBM 가상 인사 자료)"))
    A(T("직원월급_예측", "", "직원의 경력·직급으로 월급 예측", "경영·인사·경제", "예측", Ynum("MonthlyIncome", "월급(달러)"),
        [N("Age", "나이(세)"), N("TotalWorkingYears", "총근무경력(년)"), N("YearsAtCompany", "현직장근속(년)"), N("DistanceFromHome", "집과의거리(마일)"), N("JobLevel", "직급(1~5)"),
         N("NumCompaniesWorked", "이전근무회사수(곳)"), N("PercentSalaryHike", "급여인상률(%)"), N("TrainingTimesLastYear", "작년교육횟수(회)")], loader=HR, 출처="Kaggle rishikeshkonapure/hr-analytics-prediction"))
    A(T("은행이탈_분류", "", "은행 고객 정보로 계좌 해지(이탈) 여부 분류(이탈 비율 맞춤)", "경영·금융·마케팅", "분류", Ycls("Exited", lambda s: s.map({0: "유지", 1: "이탈"}), ("유지", "이탈")),
        [N("CreditScore", "신용점수"), N("Age", "나이(세)"), N("Tenure", "거래기간(년)"), N("Balance", "잔액(유로)"), N("NumOfProducts", "이용상품수(개)"), N("EstimatedSalary", "추정연봉(유로)"),
         N("Point Earned", "적립포인트")], loader=rd("radheshyamkollipara_bank-customer-churn/Customer-Churn-Records.csv"), ratio=0.35,
        비고="이탈 20%라 학습용으로 35%가 되게 유지를 덜어 냄", 출처="Kaggle radheshyamkollipara/bank-customer-churn"))
    def rent():
        d = pd.read_csv(K / "iamsouravbanerjee_house-rent-prediction-dataset/House_Rent_Dataset.csv")
        d["층"] = pd.to_numeric(d["Floor"].astype(str).str.split(" out of").str[0].replace({"Ground": 0, "Upper Basement": -1, "Lower Basement": -2}), errors="coerce")
        return d.query("Rent > 1000 and Rent < 500000")
    A(T("월세_예측", "", "집의 크기·방 수로 월세(루피) 예측", "경제·부동산·건축", "예측", Ynum("Rent", "월세(상용로그,루피)", log=True),
        [N("BHK", "방수(개)"), N("Size", "면적(제곱피트)"), N("Bathroom", "욕실수(개)"), N("층", "층"), B("Furnishing Status", "가구포함(0/1)", lambda s: (s != "Unfurnished").astype(int)),
         B("City", "대도시(뭄바이·델리)(0/1)", lambda s: s.isin(["Mumbai", "Delhi"]).astype(int))], loader=rent, 출처="Kaggle iamsouravbanerjee/house-rent-prediction-dataset (인도 6개 도시 월세)"))

    # ───── 환경·에너지·기상 ─────
    def seoul():
        d = pd.read_csv(K / "bappekim_air-pollution-in-seoul/AirPollutionSeoul/Measurement_summary.csv")
        d = d[(d[["SO2", "NO2", "O3", "CO", "PM10", "PM2.5"]] > 0).all(axis=1)]
        return d.sample(8000, random_state=1)
    A(T("서울초미세먼지_예측", "", "서울의 다른 대기 물질 농도로 초미세먼지(PM2.5) 예측", "환경·대기·도시", "예측", Ynum("PM2.5", "초미세먼지(㎍/㎥)"),
        [N("PM10", "미세먼지(㎍/㎥)"), N("NO2", "이산화질소(ppm)"), N("CO", "일산화탄소(ppm)"), N("O3", "오존(ppm)"), N("SO2", "이산화황(ppm)")], loader=seoul,
        출처="Kaggle bappekim/air-pollution-in-seoul (서울 25개 측정소 2017~2019, 서울시 열린데이터)"))
    A(T("수질_분류", "", "물의 화학 성분으로 마셔도 되는 물/아닌 물 분류", "환경·화학·보건", "분류", Ycls("Potability", lambda s: s.map({0: "마시기부적합", 1: "마시기가능"}), ("마시기부적합", "마시기가능")),
        [N("ph", "pH"), N("Hardness", "경도"), N("Solids", "용존고형물"), N("Chloramines", "클로라민"), N("Sulfate", "황산염"), N("Conductivity", "전기전도도"),
         N("Organic_carbon", "유기탄소"), N("Trihalomethanes", "트리할로메탄"), N("Turbidity", "탁도")], loader=rd("adityakadiwal_water-potability/water_potability.csv"), 출처="Kaggle adityakadiwal/water-potability"))
    def solar():
        g = pd.read_csv(K / "anikannal_solar-power-generation-data/Plant_1_Generation_Data.csv", parse_dates=["DATE_TIME"], dayfirst=True)
        w = pd.read_csv(K / "anikannal_solar-power-generation-data/Plant_1_Weather_Sensor_Data.csv", parse_dates=["DATE_TIME"])
        g = g.groupby("DATE_TIME", as_index=False)["DC_POWER"].sum()
        d = g.merge(w[["DATE_TIME", "AMBIENT_TEMPERATURE", "MODULE_TEMPERATURE", "IRRADIATION"]], on="DATE_TIME")
        d["시각"] = d["DATE_TIME"].dt.hour + d["DATE_TIME"].dt.minute / 60
        d["낮"] = (d["IRRADIATION"] > 0.02).astype(int)
        return d[d["낮"] == 1]
    A(T("태양광발전_예측", "", "날씨 센서로 태양광 발전소의 직류 발전량 예측", "에너지·전기전자·환경", "예측", Ynum("DC_POWER", "직류발전량(kW)"),
        [N("IRRADIATION", "일사량(kW/㎡)"), N("AMBIENT_TEMPERATURE", "기온(℃)"), N("MODULE_TEMPERATURE", "패널온도(℃)"), N("시각", "시각(시)")], loader=solar,
        출처="Kaggle anikannal/solar-power-generation-data (인도 태양광 발전소 34일, 15분 간격)"))
    A(T("호주내일비_분류", "", "오늘의 날씨로 내일 비가 올지 분류(비 비율 맞춤)", "환경·기상·대기과학", "분류", Ycls("RainTomorrow", lambda s: s.map({"No": "비안옴", "Yes": "비옴"}), ("비안옴", "비옴")),
        [N("MaxTemp", "최고기온(℃)"), N("MinTemp", "최저기온(℃)"), N("Rainfall", "강수량(mm)"), N("Humidity3pm", "오후3시습도(%)"), N("Humidity9am", "오전9시습도(%)"), N("Pressure3pm", "오후3시기압(hPa)"),
         N("Pressure9am", "오전9시기압(hPa)"), N("WindGustSpeed", "최대돌풍풍속(km/h)"), N("Temp3pm", "오후3시기온(℃)")],
        loader=lambda: pd.read_csv(K / "jsphyg_weather-dataset-rattle-package/weatherAUS.csv").dropna(subset=["RainTomorrow", "MaxTemp", "MinTemp", "Rainfall", "Humidity3pm", "Humidity9am", "Pressure3pm", "Pressure9am", "WindGustSpeed", "Temp3pm"]).sample(8000, random_state=1),
        ratio=0.35, 비고="비 22%라 학습용으로 35%가 되게 비 안 옴을 덜어 냄", 출처="Kaggle jsphyg/weather-dataset-rattle-package (호주 49개 관측소 일기상)"))
    A(T("런던자전거_예측", "", "날씨와 요일로 런던 자전거 대여 수 예측", "환경·교통·도시", "예측", Ynum("cnt", "대여수(대)"),
        [N("t1", "기온(℃)"), N("t2", "체감온도(℃)"), N("hum", "습도(%)"), N("wind_speed", "풍속(km/h)"), B("is_weekend", "주말(0/1)", lambda s: s.astype(int)), B("is_holiday", "공휴일(0/1)", lambda s: s.astype(int))],
        loader=rd("hmavrodiev_london-bike-sharing-dataset/london_merged.csv"), 출처="Kaggle hmavrodiev/london-bike-sharing-dataset (런던 시간별 자전거 대여)"))
    return tasks
