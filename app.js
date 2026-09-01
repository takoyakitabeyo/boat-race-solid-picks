const API = "https://boatraceopenapi.github.io/api/v1/today.json";

const STADIUMS = {
  1:"桐生", 2:"戸田", 3:"江戸川", 4:"平和島",
  5:"多摩川", 6:"浜名湖", 7:"蒲郡", 8:"常滑",
  9:"津", 10:"三国", 11:"びわこ", 12:"住之江",
  13:"尼崎", 14:"鳴門", 15:"丸亀", 16:"児島",
  17:"宮島", 18:"徳山", 19:"下関", 20:"若松",
  21:"芦屋", 22:"福岡", 23:"唐津", 24:"大村"
};

const GRADES = {
  1:"SG",
  2:"G1",
  3:"G2",
  4:"G3",
  5:"一般"
};

const $ = s => document.querySelector(s);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp(v,min,max) {
  return Math.max(min,Math.min(max,v));
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function rankName(n) {
  return {
    1:"A1",
    2:"A2",
    3:"B1",
    4:"B2"
  }[n] || "-";
}

function fmtTime(v) {
  const s = String(v || "");
  const m = s.match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "--:--";
}

function raceKey(r) {
  return `${r.date}-${r.stadium_number}-${r.race_number}`;
}


/* =========================
   タイトル
========================= */

function setupTitle() {

  const h1 = $("h1");

  if (h1) {
    h1.textContent = "予想屋サイバーはっちゃん";
  }

  const eyebrow = document.querySelector(".eyebrow");

  if (eyebrow) {
    eyebrow.textContent = "BOAT RACE / CYBER HATCHAN";
  }
}


/* =========================
   CSS追加
========================= */

function setupStyle() {

  if (document.getElementById("cyber-style")) return;

  const style = document.createElement("style");

  style.id = "cyber-style";

  style.textContent = `

    .cyber-stats {
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:8px;
      margin:12px 0;
    }

    .cyber-stat {
      background:#111827;
      color:white;
      border-radius:14px;
      padding:12px 5px;
      text-align:center;
    }

    .cyber-stat-label {
      font-size:.7rem;
      opacity:.75;
    }

    .cyber-stat-value {
      font-size:1.25rem;
      font-weight:900;
      margin-top:3px;
    }

    .race-card.hot {
      border:2px solid #f59e0b;
      box-shadow:0 5px 20px rgba(245,158,11,.2);
    }

    .hot-badge {
      display:inline-block;
      background:#f59e0b;
      color:#111827;
      font-weight:900;
      padding:4px 9px;
      border-radius:999px;
      margin-bottom:6px;
      font-size:.75rem;
    }

    .grade-badge {
      display:inline-block;
      background:#e5e7eb;
      border-radius:6px;
      padding:3px 7px;
      font-weight:800;
      font-size:.75rem;
      margin-right:5px;
    }

    .series-title {
      font-weight:800;
      margin-top:7px;
    }

    .race-day {
      font-size:.8rem;
      opacity:.7;
      margin-top:2px;
    }

    .change-box {
      margin-top:10px;
      padding:10px;
      background:#fff7ed;
      border-left:4px solid #f97316;
      border-radius:8px;
      font-size:.8rem;
    }

    .change-box b {
      display:block;
      margin-bottom:4px;
    }

    .no-data-box {
      margin-top:10px;
      padding:12px;
      background:#f1f5f9;
      border-radius:10px;
      font-size:.82rem;
    }

    .confidence-hot {
      color:#dc2626;
      font-weight:900;
    }

    .confidence-normal {
      font-weight:800;
    }

    .debug-info {
      font-size:.75rem;
      color:#64748b;
      margin-top:8px;
    }

  `;

  document.head.appendChild(style);
}


/* =========================
   スコア計算
========================= */

function scoreRace(r) {

  const racers = Object.values(r.racers || {})
    .sort((a,b) =>
      num(a.entry_number) - num(b.entry_number)
    );

  if (racers.length !== 6) {
    return null;
  }

  const preview = r.preview?.racers || {};

  const one = racers.find(
    x => num(x.entry_number) === 1
  );

  if (!one) {
    return null;
  }

  const p1 = preview["1"] || {};

  let score = 0;

  /* A1/A2/B1/B2 */
  score += ({
    1:30,
    2:22,
    3:12,
    4:4
  }[num(one.rank_number)] || 0);

  /* 全国勝率 */
  score += clamp(
    (num(one.national_win_rate) || 0) * 3.0,
    0,
    24
  );

  /* 当地勝率 */
  score += clamp(
    (num(one.local_win_rate) || 0) * 1.8,
    0,
    12
  );

  /* 全国3連対率 */
  score += clamp(
    (num(one.national_top_3_percent) || 0) * .08,
    0,
    8
  );

  /* 当地3連対率 */
  score += clamp(
    (num(one.local_top_3_percent) || 0) * .04,
    0,
    5
  );

  /* モーター */
  score += clamp(
    (num(one.motor_top_3_percent) || 0) * .03,
    0,
    3
  );

  /* 平均ST */
  const avgST = num(one.average_start_timing);

  if (avgST !== null) {

    if (avgST <= .15) score += 5;
    else if (avgST <= .17) score += 3;
    else if (avgST >= .20) score -= 2;

  }

  /* 1コース */
  if (num(p1.course_number) === 1) {
    score += 8;
  }


  /* =========================
     2着3着候補
  ========================= */

  const candidates = racers
    .filter(x => num(x.entry_number) !== 1)
    .map(x => {

      const n = num(x.entry_number);
      const p = preview[String(n)] || {};

      let v = 0;

      v += ({
        1:20,
        2:16,
        3:11,
        4:5
      }[num(x.rank_number)] || 0);

      v += clamp(
        (num(x.national_top_3_percent) || 0) * .07,
        0,
        7
      );

      v += clamp(
        (num(x.local_top_3_percent) || 0) * .03,
        0,
        4
      );

      v += clamp(
        (num(x.motor_top_3_percent) || 0) * .03,
        0,
        3
      );

      const exhibition =
        num(p.exhibition_time);

      if (exhibition !== null) {

        if (exhibition <= 6.75) v += 5;
        else if (exhibition <= 6.80) v += 3;
        else if (exhibition >= 6.90) v -= 2;

      }

      if (
        num(p.course_number) !== null &&
        num(p.course_number) <= 3
      ) {
        v += 2;
      }

      return {
        racer:x,
        score:v
      };

    })
    .sort((a,b)=>b.score-a.score);


  const a = candidates[0]?.racer?.entry_number;
  const b = candidates[1]?.racer?.entry_number;
  const c = candidates[2]?.racer?.entry_number;


  /* =========================
     展示評価
  ========================= */

  const exhibitions = racers
    .map(x => {

      const p =
        preview[String(x.entry_number)] || {};

      return {
        number:x.entry_number,
        time:num(p.exhibition_time)
      };

    })
    .filter(x => x.time !== null);


  let exhibitionRank = null;

  if (exhibitions.length >= 4) {

    const sorted = [...exhibitions]
      .sort((a,b)=>a.time-b.time);

    exhibitionRank =
      sorted.findIndex(
        x => x.number === 1
      ) + 1;

    if (exhibitionRank === 1) {
      score += 7;
    }
    else if (exhibitionRank === 2) {
      score += 3;
    }
    else if (exhibitionRank >= 5) {
      score -= 5;
    }

  }


  /* =========================
     展示ST
  ========================= */

  const exhibitionST =
    num(p1.start_timing);

  if (exhibitionST !== null) {

    if (exhibitionST <= .10) {
      score += 4;
    }
    else if (exhibitionST <= .13) {
      score += 2;
    }
    else if (exhibitionST >= .20) {
      score -= 3;
    }

  }


  score = clamp(
    Math.round(score),
    0,
    100
  );


  /* =========================
     推奨判定
     
     前回より大幅に緩和。
     ただしA級1号艇を中心にする。
  ========================= */

  const rank = num(one.rank_number);

  const goodRank =
    rank === 1 ||
    rank === 2;

  const goodNational =
    (num(one.national_top_3_percent) || 0) >= 45;

  const show =
    score >= 55 &&
    goodRank &&
    goodNational;


  const hot =
    score >= 78 &&
    rank === 1 &&
    exhibitionRank !== 5 &&
    exhibitionRank !== 6;


  return {

    r,

    racers,

    preview,

    one,

    score,

    show,

    hot,

    a,
    b,
    c

  };
}


/* =========================
   買い目
========================= */

function makeCombos(x) {

  if (!x.a || !x.b) {
    return [];
  }

  const out = [
    `1-${x.a}-${x.b}`,
    `1-${x.b}-${x.a}`
  ];

  if (x.c) {

    out.push(
      `1-${x.a}-${x.c}`
    );

    out.push(
      `1-${x.c}-${x.a}`
    );

  }

  return [...new Set(out)];
}


/* =========================
   予想理由
========================= */

function makeReasons(x) {

  const o = x.one;
  const p = x.preview["1"] || {};

  const reasons = [];

  reasons.push(
    `${rankName(o.rank_number)}・全国勝率 ${
      num(o.national_win_rate)?.toFixed(2) ?? "-"
    }`
  );

  if (num(o.local_win_rate) !== null) {

    reasons.push(
      `当地勝率 ${
        num(o.local_win_rate).toFixed(2)
      }`
    );

  }

  if (num(o.national_top_3_percent) !== null) {

    reasons.push(
      `全国3連対率 ${
        num(o.national_top_3_percent).toFixed(1)
      }%`
    );

  }

  if (num(o.motor_top_3_percent) !== null) {

    reasons.push(
      `モーター3連対率 ${
        num(o.motor_top_3_percent).toFixed(1)
      }%`
    );

  }

  if (num(p.exhibition_time) !== null) {

    reasons.push(
      `展示 ${
        num(p.exhibition_time).toFixed(2)
      }秒`
    );

  }

  if (num(p.start_timing) !== null) {

    reasons.push(
      `展示ST ${
        num(p.start_timing).toFixed(2)
      }`
    );

  }

  return reasons;
}


/* =========================
   前回予想との比較
========================= */

function detectChanges(x) {

  const key = raceKey(x.r);

  let history = {};

  try {
    history =
      JSON.parse(
        localStorage.getItem(
          "cyberRaceSnapshots"
        ) || "{}"
      );
  }
  catch (_) {
    history = {};
  }

  const p = x.preview["1"] || {};

  const current = {
    course:num(p.course_number),
    exhibition:num(p.exhibition_time),
    st:num(p.start_timing),
    combos:makeCombos(x)
  };

  const old = history[key];

  history[key] = current;

  localStorage.setItem(
    "cyberRaceSnapshots",
    JSON.stringify(history)
  );

  if (!old) {
    return [];
  }

  const changes = [];

  if (
    old.course !== current.course &&
    current.course !== null
  ) {

    changes.push(
      `進入コースが ${
        old.course ?? "-"
      } → ${
        current.course
      } に変化`
    );

  }

  if (
    old.exhibition !== null &&
    current.exhibition !== null &&
    Math.abs(
      old.exhibition-current.exhibition
    ) >= .03
  ) {

    changes.push(
      `展示タイムが ${
        old.exhibition.toFixed(2)
      } → ${
        current.exhibition.toFixed(2)
      }秒に変化`
    );

  }

  if (
    old.st !== null &&
    current.st !== null &&
    Math.abs(
      old.st-current.st
    ) >= .03
  ) {

    changes.push(
      `展示STが ${
        old.st.toFixed(2)
      } → ${
        current.st.toFixed(2)
      }に変化`
    );

  }

  const oldCombos =
    (old.combos || []).join(",");

  const newCombos =
    current.combos.join(",");

  if (
    oldCombos &&
    oldCombos !== newCombos
  ) {

    changes.push(
      `買い目が ${
        oldCombos
      } → ${
        newCombos
      } に変更`
    );

  }

  return changes;
}


/* =========================
   レース表示
========================= */

function renderRace(x) {

  const r = x.r;

  const combos =
    makeCombos(x);

  const grade =
    GRADES[num(r.grade_number)] ||
    "一般";

  const day =
    r.day_number
      ? `${r.day_number}日目`
      : "";

  const changes =
    detectChanges(x);

  const reasons =
    makeReasons(x);


  const racers =
    x.racers.map(z =>

      `<div class="racer">
        <b>${esc(z.entry_number)}</b>
        ${esc(z.name)}
        <br>
        ${rankName(z.rank_number)}
      </div>`

    ).join("");


  const changeHTML =
    changes.length
      ? `
        <div class="change-box">

          <b>予想変更</b>

          ${changes
            .map(
              c=>`・${esc(c)}`
            )
            .join("<br>")}

        </div>
      `
      : "";


  return `

    <article class="race-card ${x.hot ? "hot" : ""}">

      <div class="race-head">

        <div>

          ${
            x.hot
              ? `<div class="hot-badge">
                  激アツ
                 </div>`
              : ""
          }

          <div class="race-name">

            ${esc(
              STADIUMS[r.stadium_number] ||
              "場"+r.stadium_number
            )}

            ${esc(r.race_number)}R

          </div>


          <div>

            <span class="grade-badge">
              ${esc(grade)}
            </span>

            ${day
              ? `<span class="race-day">
                  ${esc(day)}
                 </span>`
              : ""
            }

          </div>


          ${
            r.title
              ? `<div class="series-title">
                  ${esc(r.title)}
                 </div>`
              : ""
          }


          ${
            r.subtitle
              ? `<div class="muted">
                  ${esc(r.subtitle)}
                 </div>`
              : ""
          }


          <span class="badge">
            締切 ${fmtTime(r.closed_at)}
          </span>

        </div>


        <div class="${
          x.hot
            ? "confidence-hot"
            : "confidence-normal"
        }">

          信頼度 ${x.score}/100

        </div>

      </div>


      <div class="pick">

        <div class="pick-label">
          1着本命
        </div>


        <div class="pick-main">
          ① ${esc(x.one.name)}
        </div>


        <div class="rows">

          <div class="metric">

            <b>本線</b>

            <span>
              ${esc(
                combos
                  .slice(0,2)
                  .join(" / ")
              )}
            </span>

          </div>


          <div class="metric">

            <b>押さえ</b>

            <span>
              ${esc(
                combos
                  .slice(2)
                  .join(" / ") ||
                "なし"
              )}
            </span>

          </div>

        </div>


        <div class="reason">

          ${esc(
            reasons.join(" / ")
          )}

        </div>


        ${changeHTML}

      </div>


      <div class="racers">

        ${racers}

      </div>


    </article>

  `;
}


/* =========================
   JSON取得
========================= */

async function fetchData() {

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      ()=>controller.abort(),
      20000
    );

  try {

    const response =
      await fetch(
        API,
        {
          cache:"no-store",
          signal:controller.signal
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    return await response.json();

  }
  finally {

    clearTimeout(timer);

  }
}


/* =========================
   的中履歴
========================= */

function loadHistory() {

  try {

    return JSON.parse(
      localStorage.getItem(
        "cyberResults"
      ) || "[]"
    );

  }
  catch (_) {

    return [];

  }
}

function saveHistory(history) {

  localStorage.setItem(
    "cyberResults",
    JSON.stringify(history)
  );

}

function saveResult(r) {

  const trifecta =
    r.result?.payouts?.trifecta?.[0];

  if (!trifecta) {
    return;
  }

  const key =
    raceKey(r);

  const predictions =
    JSON.parse(
      localStorage.getItem(
        "cyberPredictions"
      ) || "{}"
    );

  const prediction =
    predictions[key];

  if (!prediction) {
    return;
  }

  const history =
    loadHistory();

  if (
    history.some(
      x=>x.key===key
    )
  ) {
    return;
  }

  history.push({

    key,

    date:r.date,

    month:r.date?.slice(0,7),

    actual:
      trifecta.combination,

    prediction:
      prediction.combos,

    hit:
      prediction.combos.includes(
        trifecta.combination
      )

  });

  saveHistory(history);
}


/* =========================
   予想保存
========================= */

function savePrediction(x) {

  const key =
    raceKey(x.r);

  let predictions = {};

  try {

    predictions =
      JSON.parse(
        localStorage.getItem(
          "cyberPredictions"
        ) || "{}"
      );

  }
  catch (_) {}

  predictions[key] = {

    combos:makeCombos(x),

    score:x.score,

    hot:x.hot

  };

  localStorage.setItem(
    "cyberPredictions",
    JSON.stringify(predictions)
  );
}


/* =========================
   的中率
========================= */

function calcRate(list) {

  if (!list.length) {
    return "--";
  }

  const hits =
    list.filter(x=>x.hit).length;

  return Math.round(
    hits/list.length*100
  ) + "%";
}

function renderStats() {

  const history =
    loadHistory();

  const today =
    new Date()
      .toLocaleDateString(
        "ja-JP",
        {
          timeZone:"Asia/Tokyo"
        }
      )
      .replaceAll("/","-");

  const now =
    new Date();

  const month =
    `${now.getFullYear()}-${
      String(now.getMonth()+1)
        .padStart(2,"0")
    }`;


  const todayList =
    history.filter(
      x=>x.date===today
    );

  const monthList =
    history.filter(
      x=>x.month===month
    );


  let box =
    document.getElementById(
      "cyberStats"
    );


  if (!box) {

    box =
      document.createElement(
        "section"
      );

    box.id =
      "cyberStats";

    box.className =
      "cyber-stats";

    const status =
      document.querySelector(
        ".status-card"
      );

    if (status) {

      status.insertAdjacentElement(
        "afterend",
        box
      );

    }

  }


  box.innerHTML = `

    <div class="cyber-stat">

      <div class="cyber-stat-label">
        当日的中率
      </div>

      <div class="cyber-stat-value">
        ${calcRate(todayList)}
      </div>

    </div>


    <div class="cyber-stat">

      <div class="cyber-stat-label">
        今月の的中率
      </div>

      <div class="cyber-stat-value">
        ${calcRate(monthList)}
      </div>

    </div>


    <div class="cyber-stat">

      <div class="cyber-stat-label">
        全期間
      </div>

      <div class="cyber-stat-value">
        ${calcRate(history)}
      </div>

    </div>

  `;
}


/* =========================
   メイン
========================= */

async function load() {

  if (
    !$("#status") ||
    !$("#picks")
  ) {
    return;
  }


  $("#status").textContent =
    "データ取得中…";


  try {

    const data =
      await fetchData();


    const races = [];


    for (
      const stadium of Object.values(
        data.programs?.stadiums || {}
      )
    ) {

      for (
        const r of Object.values(
          stadium.races || {}
        )
      ) {

        if (
          r.result?.payouts
        ) {

          saveResult(r);

        }
        else {

          races.push(r);

        }

      }

    }


    /* 全レースを採点 */

    const scored =
      races
        .map(scoreRace)
        .filter(Boolean);


    /* 推奨 */

    const picks =
      scored
        .filter(x=>x.show)
        .sort(
          (a,b)=>
            b.score-a.score ||
            new Date(a.r.closed_at) -
            new Date(b.r.closed_at)
        );


    /* 予想保存 */

    picks.forEach(
      savePrediction
    );


    /* 日付 */

    $("#date").textContent =
      races[0]?.date ||
      new Date().toLocaleDateString(
        "ja-JP"
      );


    $("#updated").textContent =
      `更新 ${
        new Date().toLocaleTimeString(
          "ja-JP",
          {
            hour:"2-digit",
            minute:"2-digit"
          }
        )
      }`;


    /* 件数 */

    if (picks.length) {

      $("#status").textContent =
        `${picks.length}レースを推奨`;

      $("#picks").innerHTML =
        picks
          .map(renderRace)
          .join("");

    }
    else {

      $("#status").textContent =
        "本日は現在、推奨レースなし";

      $("#picks").innerHTML = `

        <div class="empty">

          <b>
            現時点では推奨レースなし
          </b>

          <div class="no-data-box">

            出走表データ：
            ${scored.length}レース取得

            <br>

            予想条件を満たすレース：
            0レース

            <br><br>

            データが取得できていないのではなく、
            現在の判定基準で推奨対象がない状態です。

          </div>

          <div class="debug-info">
            約3分ごとに再評価します。
          </div>

        </div>

      `;

    }


    renderStats();


    $("#notice")?.
      classList.add("hidden");


  }
  catch (error) {

    console.error(error);


    $("#status").textContent =
      "データ取得エラー";


    $("#picks").innerHTML = `

      <div class="empty">

        <b>
          データを取得できませんでした
        </b>

        <div class="no-data-box">

          APIとの通信に失敗しています。

          <br><br>

          「更新」を押して再試行してください。

        </div>

      </div>

    `;


    if ($("#notice")) {

      $("#notice").textContent =
        "データ取得に失敗しました。";

      $("#notice")
        .classList
        .remove("hidden");

    }

  }

}


/* =========================
   起動
========================= */

setupTitle();

setupStyle();

$("#refresh")?.
  addEventListener(
    "click",
    load
  );

load();


/*
  Boatrace Open APIは
  約3分間隔で更新されるため、
  アプリ側も3分ごとに再取得。
*/

setInterval(
  load,
  180000
);
