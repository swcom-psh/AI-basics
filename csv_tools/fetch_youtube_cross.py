"""분야별로 여러 채널(구독자 5천 ~ 300만 명)의 영상 정보를 받아 csv_work/youtube/cross_<분야>.csv 로 저장한다.
한 채널 안에서는 조회수가 거의 예측되지 않지만(상관 0.1~0.3), 채널이 여러 개면 구독자 수 같은 채널 정보가 조회수를 잘 설명해
수업용 예측 자료로 쓸 수 있다. 채널 찾기(search, 100유닛) 몇 번과 채널·영상 정보(1유닛)만 쓴다. 키는 .env 의 YOUTUBE_KEY."""
import sys
import time
import pandas as pd
from common import WORK
import fetch_youtube as F

분야 = {
    "디자인": ["디자인 강의", "그래픽 디자인 튜토리얼", "UI UX 디자인", "포토샵 일러스트 강좌"],
    "예능": ["예능 하이라이트", "토크 방송 클립", "게임 스트리머 하이라이트", "웃긴 영상 모음"],
    "교양": ["교양 지식 채널", "다큐멘터리", "역사 이야기", "과학 교양"],
    "강연": ["강연", "특강 인문학", "동기부여 강연", "토크 콘서트 강연"],
}
영상수 = 25            # 채널마다 가져올 영상 수
이후일 = 100           # 올린 지 이 일수 이상 된 영상만(조회수가 어느 정도 쌓인 뒤)
채널한도 = 45


def 채널찾기(질문):
    ids = []
    for q in 질문:
        j = F.get("search", part="snippet", type="channel", q=q, maxResults=50, regionCode="KR", relevanceLanguage="ko")
        ids += [it["snippet"]["channelId"] for it in j["items"]]
    return list(dict.fromkeys(ids))


def 채널정보(ids):
    rows = []
    for i in range(0, len(ids), 50):
        j = F.get("channels", part="snippet,statistics,contentDetails", id=",".join(ids[i:i + 50]))
        for it in j["items"]:
            st = it["statistics"]
            if st.get("hiddenSubscriberCount") or "subscriberCount" not in st:
                continue
            rows.append({"채널": it["id"], "채널이름": it["snippet"]["title"], "개설": it["snippet"]["publishedAt"][:10], "구독자": int(st["subscriberCount"]),
                         "채널영상수": int(st.get("videoCount", 0)), "업로드목록": it["contentDetails"]["relatedPlaylists"]["uploads"]})
    return pd.DataFrame(rows)


def 영상받기(채널row, 기준):
    ids, tok = [], None
    while len(ids) < 영상수 * 3:
        j = F.get("playlistItems", part="contentDetails", playlistId=채널row["업로드목록"], maxResults=50, **({"pageToken": tok} if tok else {}))
        ids += [(it["contentDetails"]["videoId"], it["contentDetails"].get("videoPublishedAt", "")) for it in j["items"]]
        tok = j.get("nextPageToken")
        if not tok:
            break
    ids = [v for v, t in ids if t and t < 기준]                     # 올린 지 충분히 지난 영상만
    d = F.details(ids[:영상수 + 1])
    d["채널"] = 채널row["채널"]
    return d


if __name__ == "__main__":
    out = WORK / "youtube"
    out.mkdir(exist_ok=True)
    기준 = (pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=이후일)).strftime("%Y-%m-%dT%H:%M:%SZ")
    for 이름 in (sys.argv[1:] or 분야):
        ch = 채널정보(채널찾기(분야[이름]))
        ch = ch[(ch["구독자"] >= 5000) & (ch["구독자"] <= 3000000) & (ch["채널영상수"] >= 40)].sort_values("구독자", ascending=False)
        if len(ch) > 채널한도:
            ch = ch.sample(채널한도, random_state=1)
        print(이름, "채널", len(ch), flush=True)
        frames = []
        for _, r in ch.iterrows():
            try:
                frames.append(영상받기(r, 기준))
            except Exception as e:
                print("  건너뜀", r["채널이름"], str(e)[:60], flush=True)
        v = pd.concat(frames, ignore_index=True)
        v = v.merge(ch[["채널", "채널이름", "개설", "구독자", "채널영상수"]], on="채널")
        v["게시시각"] = pd.to_datetime(v["게시시각"], utc=True).dt.tz_convert("Asia/Seoul").dt.strftime("%Y-%m-%d %H:%M:%S")
        v.to_csv(out / f"cross_{이름}.csv", index=False, encoding="utf-8-sig")
        print(이름, len(v), "영상", v["채널"].nunique(), "채널", flush=True)
