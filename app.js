const API_BASE = "https://boatraceopenapi.github.io/api/v1";

const STADIUMS = {
  1:"桐生",2:"戸田",3:"江戸川",4:"平和島",5:"多摩川",6:"浜名湖",
  7:"蒲郡",8:"常滑",9:"津",10:"三国",11:"びわこ",12:"住之江",
  13:"尼崎",14:"鳴門",15:"丸亀",16:"児島",17:"宮島",18:"徳山",
  19:"下関",20:"若松",21:"芦屋",22:"福岡",23:"唐津",24:"大村"
};

const GRADE = {
  1:"一般",
  2:"G3",
  3:"G2",
  4:"G1",
  5:"SG"
};

const PURCHASED_KEY = "cyber-hacchan-purchased-v2";
const RESULTS_KEY = "boatResults";
const PREDICTION_KEY = "cyber-hacchan-last-predictions-v4";

const $ = s => document.querySelector(s);
const num = v => Number.isFinite(Number(v)) ? Number(v) : null;

function esc(v){
  return String(v ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function clamp(v,min,max){
  return Math.max(min,Math.min(max,v));
}

function rankName(n){
  return ({1:"A1",2:"A2",3:"B1",4:"B2"}[Number(n)] || "-");
}

function raceKey(r){
  return `${r.date}-${r.stadium_number}-${r.race_number}`;
}

function fmtTime(v){
  const m = String(v || "").match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "--:--";
}

function getJSTDateString(){
  const parts = new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Tokyo",
    year:"numeric",
    month:"2-digit",
    day:"2-digit"
  }).formatToParts(new Date());

  const y = parts.find(x => x.type === "year")?.value;
  const m = parts.find(x => x.type === "month")?.value;
  const d = parts.find(x => x.type === "day")?.value;

  return `${y}-${m}-${d}`;
}

function parseJST(v){
  if(!v) return null;

  const s = String(v).replace(" ","T");
  const d = new Date(`${s}+09:00`);

  return Number.isNaN(d.getTime()) ? null : d;
}

function isOpenRace(r){
  const closed = parseJST(r.closed_at);

  if(!closed){
    return true;
  }

  return closed.getTime() > Date.now();
}

function getRacers(r){
  return Object.values(r.racers || {})
    .sort((a,b) =>
      Number(a.entry_number) - Number(b.entry_number)
    );
}

function getPreview(r){
  return r.preview?.racers || {};
}


/* =========================================================
   予想エンジン
========================================================= */

function scoreBoat(racer,preview){

  const e = Number(racer.entry_number);
  const rank = Number(racer.rank_number);

  let score = 0;

  /*
    級別
  */

  score += ({
    1:32,
    2:26,
    3:18,
    4:10
  }[rank] || 0);

  /*
    全国勝率
  */

  score += clamp(
    (num(racer.national_win_rate) || 0) * 4.0,
    0,
    28
  );

  /*
    全国3連対率
  */

  score += clamp(
    (num(racer.national_top_3_percent) || 0) * 0.12,
    0,
    10
  );

  /*
    当地勝率
  */

  score += clamp(
    (num(racer.local_win_rate) || 0) * 2.0,
    0,
    12
  );

  /*
    当地3連対率
  */

  score += clamp(
    (num(racer.local_top_3_percent) || 0) * 0.06,
    0,
    5
  );

  /*
    モーター3連対率
  */

  score += clamp(
    (num(racer.motor_top_3_percent) || 0) * 0.055,
    0,
    5
  );

  /*
    ボート3連対率
  */

  score += clamp(
    (num(racer.boat_top_3_percent) || 0) * 0.025,
    0,
    2
  );

  /*
    進入コース
  */

  const p = preview[String(e)] || {};
  const course = num(p.course_number);

  if(course !== null){

    if(course === 1){
      score += 8;
    }else if(course === 2){
      score += 6;
    }else if(course === 3){
      score += 5;
    }else if(course === 4){
      score += 3;
    }else if(course === 5){
      score += 1;
    }

  }else{

    if(e === 1){
      score += 6;
    }else if(e === 2){
      score += 4;
    }else if(e === 3){
      score += 3;
    }

  }

  /*
    平均ST
  */

  const avgST =
    num(racer.average_start_timing);

  if(avgST !== null){

    score += clamp(
      (0.22 - avgST) * 30,
      -4,
      5
    );

  }

  /*
    展示タイム
  */

  const exhibition =
    num(p.exhibition_time);

  if(exhibition !== null){

    score += clamp(
      (6.90 - exhibition) * 12,
      -5,
      8
    );

  }

  /*
    展示ST
  */

  const start =
    num(p.start_timing);

  if(start !== null){

    if(start <= 0.08){

      score += 4;

    }else if(start <= 0.12){

      score += 2;

    }else if(start >= 0.20){

      score -= 4;

    }

  }

  return score;
}


/* =========================================================
   激アツ買い目点数判定
========================================================= */

function decideHotPoints(
  confidence,
  scored,
  first,
  preview,
  exhibitionRanks
){

  const main =
    Number(first.racer.entry_number);

  const secondGap =
    scored[0].score - scored[1].score;

  const thirdGap =
    scored[1].score - scored[2].score;

  const firstPreview =
    preview[String(main)] || {};

  const course =
    num(firstPreview.course_number);

  const exhibitionRank =
    exhibitionRanks.findIndex(
      x => x.entry === main
    );

  /*
    =====================================================
    2点
    超鉄板

    ・信頼度が非常に高い
    ・2番手との差が大きい
    ・2、3着候補も比較的はっきり
    ・進入、展示も大きな不安なし
    =====================================================
  */

  if(
    confidence >= 94 &&
    secondGap >= 12 &&
    thirdGap >= 5 &&
    (course === null || course <= 2) &&
    (exhibitionRank === -1 || exhibitionRank <= 1)
  ){

    return 2;

  }

  /*
    =====================================================
    4点
    1着本命はかなり強いが、
    2・3着に少し不確定要素あり
    =====================================================
  */

  if(
    confidence >= 91 &&
    secondGap >= 9 &&
    thirdGap >= 3
  ){

    return 4;

  }

  /*
    =====================================================
    6点
    1着はかなり有力だが、
    2・3着争いが混戦
    =====================================================
  */

  if(
    secondGap >= 7 &&
    thirdGap >= 2
  ){

    return 6;

  }

  /*
    =====================================================
    8点
    激アツ判定ではあるものの、
    展示・進入・相手関係などに不確定要素あり

    激アツだから無理に2点に絞らない
    =====================================================
  */

  return 8;
}


/* =========================================================
   レース分析
========================================================= */

function analyzeRace(r){

  const racers =
    getRacers(r);

  if(racers.length !== 6){
    return null;
  }

  const preview =
    getPreview(r);

  const scored =
    racers
      .map(racer => ({
        racer,
        score:scoreBoat(
          racer,
          preview
        )
      }))
      .sort(
        (a,b) =>
          b.score - a.score
      );

  const first =
    scored[0];

  const second =
    scored[1];

  const third =
    scored[2];

  const fourth =
    scored[3];

  const fifth =
    scored[4];

  if(!first || !second){
    return null;
  }

  /*
    1着と2番手の差
  */

  const margin =
    first.score - second.score;

  /*
    信頼度
  */

  let confidence =
    55 + margin * 1.25;

  /*
    1号艇補正
  */

  if(
    Number(first.racer.entry_number) === 1
  ){

    confidence += 8;

  }

  /*
    A1補正
  */

  if(
    Number(first.racer.rank_number) === 1
  ){

    confidence += 5;

  }

  /*
    全国勝率
  */

  if(
    (num(first.racer.national_win_rate) || 0)
    >= 6.50
  ){

    confidence += 4;

  }

  /*
    全国3連対率
  */

  if(
    (num(first.racer.national_top_3_percent) || 0)
    >= 65
  ){

    confidence += 3;

  }

  /*
    展示タイム順位
  */

  const exhibitionRanks =
    racers
      .map(x => ({
        entry:Number(x.entry_number),
        time:num(
          preview[
            String(x.entry_number)
          ]?.exhibition_time
        )
      }))
      .filter(
        x => x.time !== null
      )
      .sort(
        (a,b) =>
          a.time - b.time
      );

  if(exhibitionRanks.length === 6){

    const pos =
      exhibitionRanks.findIndex(
        x =>
          x.entry ===
          Number(first.racer.entry_number)
      );

    if(pos === 0){

      confidence += 5;

    }else if(pos === 1){

      confidence += 2;

    }else if(pos >= 4){

      confidence -= 5;

    }

  }

  /*
    展示ST
  */

  const firstPreview =
    preview[
      String(first.racer.entry_number)
    ] || {};

  if(
    num(firstPreview.start_timing) !== null
  ){

    if(
      num(firstPreview.start_timing) <= 0.08
    ){

      confidence += 3;

    }else if(
      num(firstPreview.start_timing) >= 0.20
    ){

      confidence -= 3;

    }

  }

  confidence =
    Math.round(
      clamp(
        confidence,
        0,
        99
      )
    );

  /*
    レベル
  */

  let level = "候補";
  let points = 8;

  if(confidence >= 88){

    level = "激アツ";

    /*
      ここは最初に2点を仮設定。
      後ほどレース内容を見て
      2/4/6/8点へ自動調整する。
    */

    points = 2;

  }else if(confidence >= 78){

    level = "本命";
    points = 4;

  }else if(confidence >= 69){

    level = "有力";
    points = 6;

  }

  /*
    「固いレース」として表示する条件

    A1/A2を優先。
    1号艇固定にはしない。
  */

  const show =
    confidence >= 68 &&
    margin >= 7 &&
    Number(first.racer.rank_number) <= 2;

  /*
    相手候補

    上位5艇から
    本命艇以外を抽出。
  */

  const rivals =
    scored
      .slice(1,5)
      .map(
        x => x.racer.entry_number
      );

  /*
    激アツの場合だけ、
    レース状況を見て買い目点数を調整。
  */

  if(level === "激アツ"){

    points =
      decideHotPoints(
        confidence,
        scored,
        first,
        preview,
        exhibitionRanks
      );

  }

  /*
    買い目生成
  */

  const bets =
    makeBets(
      first.racer.entry_number,
      rivals,
      points
    );

  return {

    race:r,

    racers,

    scored,

    first,

    second,

    third,

    fourth,

    fifth,

    confidence,

    level,

    points,

    bets,

    reason:
      buildReason(
        first,
        second,
        third,
        preview
      ),

    show

  };
}


/* =========================================================
   買い目生成
========================================================= */

function makeBets(
  main,
  rivals,
  points
){

  const a =
    Number(main);

  const r =
    [
      ...new Set(
        rivals.map(Number)
      )
    ]
    .filter(
      x => x !== a
    );

  if(r.length < 2){
    return [];
  }

  const out = [];

  /*
    基本2点

    A-B-C
    A-C-B
  */

  out.push(
    `${a}-${r[0]}-${r[1]}`
  );

  out.push(
    `${a}-${r[1]}-${r[0]}`
  );

  /*
    4点

    3番手を追加
  */

  if(
    points >= 4 &&
    r[2]
  ){

    out.push(
      `${a}-${r[0]}-${r[2]}`
    );

    out.push(
      `${a}-${r[2]}-${r[0]}`
    );

  }

  /*
    6点

    2番手と3番手の組み合わせを追加
  */

  if(
    points >= 6 &&
    r[2]
  ){

    out.push(
      `${a}-${r[1]}-${r[2]}`
    );

    out.push(
      `${a}-${r[2]}-${r[1]}`
    );

  }

  /*
    8点

    4番手候補も追加
  */

  if(
    points >= 8 &&
    r[3]
  ){

    out.push(
      `${a}-${r[0]}-${r[3]}`
    );

    out.push(
      `${a}-${r[3]}-${r[0]}`
    );

  }

  return [
    ...new Set(out)
  ].slice(
    0,
    points
  );
}


/* =========================================================
   予想理由
========================================================= */

function buildReason(
  first,
  second,
  third,
  preview
){

  const r =
    first.racer;

  const p =
    preview[
      String(r.entry_number)
    ] || {};

  const reasons = [];

  reasons.push(
    `${rankName(r.rank_number)}・全国勝率 ${
      num(r.national_win_rate)?.toFixed(2) ?? "-"
    }`
  );

  if(
    num(r.local_win_rate) !== null
  ){

    reasons.push(
      `当地勝率 ${
        num(r.local_win_rate).toFixed(2)
      }`
    );

  }

  if(
    num(r.national_top_3_percent) !== null
  ){

    reasons.push(
      `全国3連対率 ${
        num(r.national_top_3_percent).toFixed(1)
      }%`
    );

  }

  if(
    num(r.motor_top_3_percent) !== null
  ){

    reasons.push(
      `モーター3連対率 ${
        num(r.motor_top_3_percent).toFixed(1)
      }%`
    );

  }

  if(
    num(p.exhibition_time) !== null
  ){

    reasons.push(
      `展示 ${
        num(p.exhibition_time).toFixed(2)
      }秒`
    );

  }

  if(
    num(p.start_timing) !== null
  ){

    reasons.push(
      `展示ST ${
        num(p.start_timing).toFixed(2)
      }`
    );

  }

  if(
    num(p.course_number) !== null
  ){

    reasons.push(
      `${num(p.course_number)}コース想定`
    );

  }

  return reasons.join(" / ");
}


/* =========================================================
   購入履歴
========================================================= */

function loadPurchased(){

  try{

    return JSON.parse(
      localStorage.getItem(
        PURCHASED_KEY
      ) || "[]"
    );

  }catch{

    return [];

  }
}

function savePurchased(list){

  try{

    localStorage.setItem(
      PURCHASED_KEY,
      JSON.stringify(list)
    );

  }catch{}

}

function isPurchased(key){

  return loadPurchased()
    .some(
      x => x.key === key
    );
}

function purchaseRace(analysis){

  const key =
    raceKey(
      analysis.race
    );

  const list =
    loadPurchased();

  if(
    list.some(
      x => x.key === key
    )
  ){

    return;

  }

  list.push({

    key,

    date:
      analysis.race.date,

    stadium_number:
      analysis.race.stadium_number,

    race_number:
      analysis.race.race_number,

    stadium_name:
      STADIUMS[
        analysis.race.stadium_number
      ] || "",

    title:
      analysis.race.title || "",

    subtitle:
      analysis.race.subtitle || "",

    main:
      Number(
        analysis.first.racer.entry_number
      ),

    mainName:
      analysis.first.racer.name || "",

    confidence:
      analysis.confidence,

    level:
      analysis.level,

    bets:
      analysis.bets,

    purchasedAt:
      new Date().toISOString()

  });

  savePurchased(list);
}


/* =========================================================
   結果
========================================================= */

function saveResult(r){

  const trifecta =
    r.result
      ?.payouts
      ?.trifecta
      ?.[0]
      ?.combination;

  if(!trifecta){
    return;
  }

  try{

    const history =
      JSON.parse(
        localStorage.getItem(
          RESULTS_KEY
        ) || "{}"
      );

    history[
      raceKey(r)
    ] = {

      combination:
        trifecta,

      amount:
        r.result
          ?.payouts
          ?.trifecta
          ?.[0]
          ?.amount ?? null,

      at:
        new Date().toISOString()

    };

    localStorage.setItem(
      RESULTS_KEY,
      JSON.stringify(history)
    );

  }catch{}

}

function getResult(r){

  try{

    const history =
      JSON.parse(
        localStorage.getItem(
          RESULTS_KEY
        ) || "{}"
      );

    return (
      history[
        raceKey(r)
      ] || null
    );

  }catch{

    return null;

  }

}


/* =========================================================
   予想変更
========================================================= */

function loadPreviousPredictions(){

  try{

    return JSON.parse(
      localStorage.getItem(
        PREDICTION_KEY
      ) || "{}"
    );

  }catch{

    return {};

  }

}

function savePredictions(data){

  try{

    localStorage.setItem(
      PREDICTION_KEY,
      JSON.stringify(data)
    );

  }catch{}

}

function getChangeReason(
  oldPrediction,
  analysis
){

  if(!oldPrediction){
    return "";
  }

  if(
    Number(oldPrediction.main) !==
    Number(
      analysis.first.racer.entry_number
    )
  ){

    return "直前情報の更新により1着本命が変更されました。";

  }

  if(
    JSON.stringify(
      oldPrediction.bets
    ) !==
    JSON.stringify(
      analysis.bets
    )
  ){

    return "展示・進入・STなどの更新により買い目を再評価しました。";

  }

  return "";
}


/* =========================================================
   カード表示
========================================================= */

function renderRaceCard(
  analysis,
  hot = false,
  previousPredictions = {}
){

  const r =
    analysis.race;

  const key =
    raceKey(r);

  const purchased =
    isPurchased(key);

  const result =
    getResult(r);

  const mainEntry =
    Number(
      analysis.first.racer.entry_number
    );

  const mainName =
    analysis.first.racer.name || "-";

  const betsHTML =
    analysis.bets
      .map(
        b =>
          `<span class="bet">${esc(b)}</span>`
      )
      .join("");

  const preview =
    getPreview(r);

  const racersHTML =
    analysis.racers
      .map(x => {

        const p =
          preview[
            String(x.entry_number)
          ] || {};

        return `
          <div class="racer">

            <div class="racer-no">
              ${esc(x.entry_number)}
            </div>

            <div class="racer-info">

              <b>
                ${esc(x.name)}
              </b>

              <span>
                ${rankName(x.rank_number)}
              </span>

            </div>

            <div class="racer-time">

              ${
                num(p.exhibition_time) !== null
                  ? num(
                      p.exhibition_time
                    ).toFixed(2)
                  : "--"
              }

            </div>

          </div>
        `;

      })
      .join("");

  const changeReason =
    getChangeReason(
      previousPredictions[key],
      analysis
    );

  return `
    <article
      class="race-card ${hot ? "hot" : ""}"
      data-race-key="${esc(key)}"
    >

      <div class="race-top">

        <div>

          <div class="race-title">

            ${esc(
              STADIUMS[
                r.stadium_number
              ] || ""
            )}

            ${esc(
              r.race_number
            )}R

            <span class="grade">

              ${esc(
                GRADE[
                  r.grade_number
                ] || ""
              )}

            </span>

          </div>

          <div class="event-title">

            ${esc(
              r.title || ""
            )}

          </div>

          <div class="subtitle">

            ${esc(
              r.subtitle || ""
            )}

          </div>

          <div class="deadline">

            締切 ${
              esc(
                fmtTime(
                  r.closed_at
                )
              )
            }

          </div>

        </div>

        <div class="confidence">

          <strong>
            ${analysis.confidence}
          </strong>

          <span>
            /100
          </span>

          <div
            class="level ${
              hot
                ? "hot-level"
                : ""
            }"
          >

            ${esc(
              analysis.level
            )}

          </div>

        </div>

      </div>


      <div class="main-pick">

        <div class="pick-label">
          1着本命
        </div>

        <div class="pick-name">

          ${mainEntry}号艇
          ${esc(mainName)}

        </div>

        <div class="pick-reason">

          ${esc(
            analysis.reason
          )}

        </div>

        ${
          changeReason
            ? `
              <div class="change">

                予想変更：
                ${esc(changeReason)}

              </div>
            `
            : ""
        }

      </div>


      <div class="bets">

        <div class="bets-title">

          推奨買い目
          ${analysis.bets.length}点

        </div>

        <div class="bet-list">

          ${betsHTML}

        </div>

      </div>


      <div class="buy-area">

        <div class="buy-note">

          ${
            result
              ? `結果：
                  ${esc(
                    result.combination
                  )}`
              : "購入したら「買った」を押してください"
          }

        </div>

        <button
          class="buy-button ${
            purchased
              ? "purchased"
              : ""
          }"
          data-buy="${esc(key)}"
        >

          ${
            purchased
              ? "購入済み"
              : "買った"
          }

        </button>

      </div>


      <div class="racers">

        ${racersHTML}

      </div>

    </article>
  `;
}


/* =========================================================
   激アツ表示
========================================================= */

function renderHot(
  list,
  previousPredictions
){

  const el =
    $("#hotRaces");

  if(!el){
    return;
  }

  if(!list.length){

    el.innerHTML = `
      <div class="empty">

        現時点で「激アツ」と判断できる
        レースはありません。

      </div>
    `;

    return;
  }

  el.innerHTML =
    list
      .map(
        x =>
          renderRaceCard(
            x,
            true,
            previousPredictions
          )
      )
      .join("");

}


/* =========================================================
   競艇場別表示
========================================================= */

function renderStadiums(
  list,
  previousPredictions
){

  const tabs =
    $("#stadiumTabs");

  const picks =
    $("#picks");

  if(!tabs || !picks){
    return;
  }

  const groups = {};

  list.forEach(x => {

    const n =
      Number(
        x.race.stadium_number
      );

    if(!groups[n]){
      groups[n] = [];
    }

    groups[n].push(x);

  });

  const stadiumNumbers =
    Object.keys(groups)
      .map(Number)
      .sort(
        (a,b) => a-b
      );

  /*
    初期状態は「全て」
  */

  let active =
    Number(
      tabs.dataset.active ?? 0
    );

  if(
    active !== 0 &&
    !groups[active]
  ){

    active = 0;

  }

  tabs.dataset.active =
    String(active);

  tabs.innerHTML = `

    <button
      class="stadium-tab ${
        active === 0
          ? "active"
          : ""
      }"
      data-stadium="0"
    >
      全て
    </button>

    ${
      stadiumNumbers
        .map(
          n => `

            <button
              class="stadium-tab ${
                n === active
                  ? "active"
                  : ""
              }"
              data-stadium="${n}"
            >

              ${esc(
                STADIUMS[n]
              )}

            </button>

          `
        )
        .join("")
    }

  `;

  const target =
    active === 0
      ? list
      : groups[active] || [];

  picks.innerHTML =
    target.length
      ? target
          .map(
            x =>
              renderRaceCard(
                x,
                false,
                previousPredictions
              )
          )
          .join("")
      : `
        <div class="empty">

          この競艇場には現在
          おすすめレースがありません。

        </div>
      `;

  tabs
    .querySelectorAll(
      "[data-stadium]"
    )
    .forEach(btn => {

      btn.addEventListener(
        "click",
        () => {

          tabs.dataset.active =
            btn.dataset.stadium;

          renderStadiums(
            list,
            previousPredictions
          );

        }
      );

    });

}


/* =========================================================
   購入ボタン
========================================================= */

document.addEventListener(
  "click",
  e => {

    const btn =
      e.target.closest(
        "[data-buy]"
      );

    if(!btn){
      return;
    }

    const key =
      btn.dataset.buy;

    const analysis =
      window.__analysisMap?.[key];

    if(!analysis){
      return;
    }

    purchaseRace(
      analysis
    );

    btn.textContent =
      "購入済み";

    btn.classList.add(
      "purchased"
    );

  }
);


/* =========================================================
   API取得
========================================================= */

async function fetchTimeout(
  url,
  ms = 20000
){

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      ms
    );

  try{

    const res =
      await fetch(
        url,
        {
          cache:"no-store",
          signal:controller.signal
        }
      );

    return res;

  }finally{

    clearTimeout(timer);

  }

}

async function fetchJSON(url){

  const res =
    await fetchTimeout(url);

  if(!res.ok){

    throw new Error(
      `API ${res.status}: ${url}`
    );

  }

  return await res.json();

}

async function loadData(){

  const date =
    getJSTDateString();

  const year =
    date.slice(0,4);

  const compactDate =
    date.replaceAll(
      "-",
      ""
    );

  /*
    日付指定APIを優先
  */

  const dateURL =
    `${API_BASE}/${year}/${compactDate}.json`;

  try{

    return await fetchJSON(
      dateURL
    );

  }catch(error){

    console.warn(
      "日付指定API取得失敗。today.jsonへフォールバック",
      error
    );

  }

  /*
    フォールバック
  */

  return await fetchJSON(
    `${API_BASE}/today.json`
  );

}


/* =========================================================
   メイン処理
========================================================= */

async function load(){

  const status =
    $("#status");

  if(!status){
    return;
  }

  status.textContent =
    "156Rを分析中…";

  try{

    const data =
      await loadData();

    const allRaces = [];

    const stadiums =
      data.programs
        ?.stadiums || {};

    /*
      全競艇場・全レース取得
    */

    for(
      const stadium of
      Object.values(stadiums)
    ){

      for(
        const r of
        Object.values(
          stadium.races || {}
        )
      ){

        allRaces.push(r);

        /*
          結果が出ていれば保存
        */

        if(r.result?.racers){

          saveResult(r);

        }

      }

    }

    /*
      APIから0件ならエラー
    */

    if(
      allRaces.length === 0
    ){

      throw new Error(
        "APIからレースデータが0件でした"
      );

    }

    /*
      全レース分析
    */

    const analyses =
      allRaces
        .map(
          analyzeRace
        )
        .filter(Boolean);

    /*
      締切前だけ通常推奨対象
    */

    const openAnalyses =
      analyses.filter(
        x =>
          isOpenRace(
            x.race
          )
      );

    /*
      推奨レース
    */

    const recommended =
      openAnalyses
        .filter(
          x => x.show
        )
        .sort(
          (a,b) =>

            b.confidence -
            a.confidence

            ||

            Number(
              a.race.stadium_number
            ) -
            Number(
              b.race.stadium_number
            )

            ||

            Number(
              a.race.race_number
            ) -
            Number(
              b.race.race_number
            )

        )
        .slice(
          0,
          16
        );

    /*
      激アツ
    */

    const hot =
      recommended
        .filter(
          x =>
            x.level === "激アツ"
        )
        .slice(
          0,
          3
        );

    /*
      通常レース
    */

    const normal =
      recommended.filter(
        x =>
          !hot.includes(x)
      );

    /*
      変更検知用の
      前回予想を保存前に取得
    */

    const previousPredictions =
      loadPreviousPredictions();

    const newPredictions = {};

    analyses.forEach(x => {

      const key =
        raceKey(
          x.race
        );

      newPredictions[key] = {

        main:
          Number(
            x.first.racer.entry_number
          ),

        bets:
          x.bets,

        confidence:
          x.confidence,

        updatedAt:
          new Date().toISOString()

      };

    });

    /*
      購入ボタン用
    */

    window.__analysisMap = {};

    recommended.forEach(x => {

      window.__analysisMap[
        raceKey(
          x.race
        )
      ] = x;

    });

    /*
      分析件数
    */

    if($("#analysisCount")){

      $("#analysisCount").textContent =
        `${allRaces.length}R`;

    }

    /*
      推奨件数
    */

    if($("#recommendCount")){

      $("#recommendCount").textContent =
        `${recommended.length}R`;

    }

    /*
      激アツ件数
    */

    if($("#hotCount")){

      $("#hotCount").textContent =
        `${hot.length}R`;

    }

    /*
      更新時刻
    */

    if($("#updatedAt")){

      $("#updatedAt").textContent =
        `更新 ${
          new Date()
            .toLocaleTimeString(
              "ja-JP",
              {
                hour:"2-digit",
                minute:"2-digit"
              }
            )
        }`;

    }

    /*
      ステータス
    */

    status.textContent =
      recommended.length
        ? `${recommended.length}レースを厳選`
        : "現時点で推奨できるレースはありません";

    /*
      激アツ表示
    */

    renderHot(
      hot,
      previousPredictions
    );

    /*
      通常表示
    */

    renderStadiums(
      normal,
      previousPredictions
    );

    /*
      表示後に保存
    */

    savePredictions(
      newPredictions
    );

    localStorage.setItem(
      "lastLoaded",
      new Date().toISOString()
    );

    console.log(
      `サイバーはっちゃん：${allRaces.length}R取得 / ${recommended.length}R推奨 / 激アツ${hot.length}R`
    );

  }catch(error){

    console.error(
      error
    );

    status.textContent =
      "データを取得できませんでした";

    if($("#analysisCount")){

      $("#analysisCount").textContent =
        "0R";

    }

    if($("#recommendCount")){

      $("#recommendCount").textContent =
        "0R";

    }

    if($("#hotCount")){

      $("#hotCount").textContent =
        "0R";

    }

    if($("#updatedAt")){

      $("#updatedAt").textContent =
        `更新 ${
          new Date()
            .toLocaleTimeString(
              "ja-JP",
              {
                hour:"2-digit",
                minute:"2-digit"
              }
            )
        }`;

    }

    if($("#hotRaces")){

      $("#hotRaces").innerHTML = `
        <div class="empty">

          レースデータを取得できませんでした。
          「更新」を押して再取得してください。

        </div>
      `;

    }

    if($("#picks")){

      $("#picks").innerHTML = `
        <div class="empty">

          APIからレースデータを
          取得できませんでした。

        </div>
      `;

    }

  }

}


/* =========================================================
   起動
========================================================= */

$("#refreshBtn")?.addEventListener(
  "click",
  load
);

$("#refresh")?.addEventListener(
  "click",
  load
);

load();

/*
  3分ごとに自動更新
*/

setInterval(
  load,
  180000
);
