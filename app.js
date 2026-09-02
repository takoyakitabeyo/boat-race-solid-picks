const API =
  "https://boatraceopenapi.github.io/api/v1/today.json";

const STADIUMS = {
  1:"桐生", 2:"戸田", 3:"江戸川", 4:"平和島",
  5:"多摩川", 6:"浜名湖", 7:"蒲郡", 8:"常滑",
  9:"津", 10:"三国", 11:"びわこ", 12:"住之江",
  13:"尼崎", 14:"鳴門", 15:"丸亀", 16:"児島",
  17:"宮島", 18:"徳山", 19:"下関", 20:"若松",
  21:"芦屋", 22:"福岡", 23:"唐津", 24:"大村"
};

const $ = s => document.querySelector(s);

const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const clamp = (v,a,b) =>
  Math.max(a, Math.min(b,v));

const esc = v =>
  String(v ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");


function rankName(n) {
  return ({
    1:"A1",
    2:"A2",
    3:"B1",
    4:"B2"
  })[num(n)] || "-";
}


function fmtTime(v) {
  if (!v) return "--:--";

  const m =
    String(v).match(/(\d{2}):(\d{2})/);

  return m
    ? `${m[1]}:${m[2]}`
    : "--:--";
}


function gradeName(n) {

  const g = num(n);

  return ({
    1:"SG",
    2:"G1",
    3:"G2",
    4:"G3"
  })[g] || "一般";
}


/* =================================
   データ取得
================================= */

function getRacers(r) {

  return Object.values(r.racers || {})
    .sort(
      (a,b) =>
        num(a.entry_number) -
        num(b.entry_number)
    );
}


function getPreview(r) {
  return r.preview?.racers || {};
}


/* =================================
   キー
================================= */

function predictionKey(r) {

  return [
    r.date,
    r.stadium_number,
    r.race_number
  ].join("-");

}


/* =================================
   LocalStorage
================================= */

function readStore(name, defaultValue) {

  try {

    return JSON.parse(
      localStorage.getItem(name) ||
      JSON.stringify(defaultValue)
    );

  }
  catch (_) {

    return defaultValue;

  }

}


function writeStore(name, value) {

  try {

    localStorage.setItem(
      name,
      JSON.stringify(value)
    );

  }
  catch (_) {}

}


/* =================================
   選手評価
================================= */

function playerScore(x) {

  let score = 0;

  const rank =
    num(x.rank_number);

  const national =
    num(x.national_win_rate);

  const top3 =
    num(x.national_top_3_percent);

  const local =
    num(x.local_win_rate);

  const motor =
    num(x.motor_top_3_percent);

  const st =
    num(x.average_start_timing);


  /*
    級別
  */

  if (rank === 1) {

    score += 27;

  }
  else if (rank === 2) {

    score += 19;

  }
  else if (rank === 3) {

    score += 10;

  }
  else if (rank === 4) {

    score += 3;

  }


  /*
    全国勝率
  */

  if (national !== null) {

    score += clamp(
      (national - 5.0) * 4.8,
      -5,
      14
    );

  }


  /*
    全国3連対率
  */

  if (top3 !== null) {

    score += clamp(
      (top3 - 50) * 0.20,
      -5,
      9
    );

  }


  /*
    当地勝率
  */

  if (local !== null) {

    score += clamp(
      (local - 5.0) * 2.2,
      -4,
      7
    );

  }


  /*
    モーター3連対率
  */

  if (motor !== null) {

    score += clamp(
      (motor - 40) * 0.10,
      -3,
      5
    );

  }


  /*
    平均ST
  */

  if (st !== null) {

    if (st <= 0.12) {

      score += 5;

    }
    else if (st <= 0.15) {

      score += 2;

    }
    else if (st >= 0.20) {

      score -= 4;

    }

  }


  return score;

}


/* =================================
   直前情報
================================= */

function previewScore(
  p,
  exhibitionAverage
) {

  let score = 0;

  const course =
    num(p?.course_number);

  const exhibition =
    num(p?.exhibition_time);

  const st =
    num(p?.start_timing);


  /*
    進入
  */

  if (course === 1) {

    score += 9;

  }
  else if (course === 2) {

    score += 3;

  }
  else if (course === 3) {

    score += 2;

  }


  /*
    展示ST
  */

  if (st !== null) {

    if (st <= 0.10) {

      score += 6;

    }
    else if (st <= 0.13) {

      score += 3;

    }
    else if (st >= 0.20) {

      score -= 4;

    }

  }


  /*
    展示タイム

    レース内平均との差を使う。
    絶対値だけで評価しない。
  */

  if (
    exhibition !== null &&
    exhibitionAverage !== null
  ) {

    score += clamp(
      (exhibitionAverage - exhibition) * 35,
      -5,
      7
    );

  }


  return score;

}


/* =================================
   レース評価
================================= */

function scoreRace(r) {

  const racers =
    getRacers(r);

  if (racers.length !== 6) {
    return null;
  }


  const preview =
    getPreview(r);


  /*
    展示タイム平均
  */

  const exhibitionTimes =
    racers
      .map(x =>
        num(
          preview[
            String(x.entry_number)
          ]?.exhibition_time
        )
      )
      .filter(x => x !== null);


  const exhibitionAverage =
    exhibitionTimes.length >= 4
      ? exhibitionTimes.reduce(
          (a,b) => a + b,
          0
        ) / exhibitionTimes.length
      : null;


  /*
    全艇評価
  */

  const candidates =
    racers.map(x => {

      const no =
        num(x.entry_number);

      const p =
        preview[String(no)] || {};


      let total =
        playerScore(x) +
        previewScore(
          p,
          exhibitionAverage
        );


      /*
        1号艇補正
      */

      if (no === 1) {

        const course =
          num(p.course_number);

        if (course === 1) {

          total += 12;

        }
        else if (course === null) {

          total += 5;

        }
        else {

          total += 2;

        }

      }


      return {
        x,
        p,
        total
      };

    });


  candidates.sort(
    (a,b) =>
      b.total - a.total
  );


  const first =
    candidates[0];

  const second =
    candidates[1];


  if (!first || !second) {
    return null;
  }


  const firstNo =
    num(first.x.entry_number);

  const firstRank =
    num(first.x.rank_number);


  const gap =
    first.total -
    second.total;


  const p1 =
    preview["1"] || {};


  const course1 =
    num(p1.course_number);

  const st1 =
    num(p1.start_timing);

  const exhibition1 =
    num(p1.exhibition_time);


  const national =
    num(first.x.national_win_rate);

  const top3 =
    num(first.x.national_top_3_percent);


  const motor =
    num(first.x.motor_top_3_percent);


  /*
    =================================
    信頼度
    =================================

    以前のように99へ集中しないよう、
    複数要素をバランスさせて45〜96にする。
  */

  let confidence = 45;


  /*
    本命選手そのものの強さ
  */

  confidence +=
    clamp(
      playerScore(first.x) * 0.58,
      0,
      30
    );


  /*
    相手との差
  */

  confidence +=
    clamp(
      gap * 0.65,
      0,
      18
    );


  /*
    直前情報
  */

  confidence +=
    clamp(
      previewScore(
        first.p,
        exhibitionAverage
      ) * 0.55,
      -4,
      10
    );


  /*
    1号艇
  */

  if (
    firstNo === 1 &&
    course1 === 1
  ) {

    confidence += 8;

  }


  /*
    展示ST
  */

  if (
    st1 !== null &&
    st1 <= 0.12
  ) {

    confidence += 4;

  }


  /*
    展示タイム
  */

  if (
    exhibition1 !== null &&
    exhibitionAverage !== null &&
    exhibition1 <=
      exhibitionAverage - 0.05
  ) {

    confidence += 3;

  }


  /*
    1号艇以外は慎重に
  */

  if (firstNo !== 1) {

    confidence -= 7;

  }


  /*
    1号艇がインを取れていない
  */

  if (
    firstNo === 1 &&
    course1 !== null &&
    course1 !== 1
  ) {

    confidence -= 10;

  }


  confidence =
    Math.round(
      clamp(
        confidence,
        45,
        96
      )
    );


  /* =================================
     固いレース判定
  ================================= */

  let hard = false;


  /*
    基本条件
  */

  if (
    firstNo === 1 &&
    (course1 === null || course1 === 1) &&
    (firstRank === 1 || firstRank === 2) &&
    national !== null &&
    national >= 6.00 &&
    top3 !== null &&
    top3 >= 55 &&
    gap >= 10 &&
    confidence >= 68
  ) {

    hard = true;

  }


  /*
    かなり強い1号艇
  */

  if (
    firstNo === 1 &&
    (course1 === null || course1 === 1) &&
    national !== null &&
    national >= 6.50 &&
    top3 !== null &&
    top3 >= 60 &&
    gap >= 16 &&
    confidence >= 76
  ) {

    hard = true;

  }


  /*
    モーターが極端に悪い場合
  */

  if (
    firstNo === 1 &&
    motor !== null &&
    motor < 25 &&
    gap < 18
  ) {

    hard = false;

  }


  /*
    インなのに展示STが悪い
  */

  if (
    firstNo === 1 &&
    course1 === 1 &&
    st1 !== null &&
    st1 >= 0.20 &&
    gap < 18
  ) {

    hard = false;

  }


  /*
    1号艇がインを取れていない
  */

  if (
    firstNo === 1 &&
    course1 !== null &&
    course1 !== 1
  ) {

    hard = false;

  }


  /*
    信頼度が低い場合
  */

  if (confidence < 68) {

    hard = false;

  }


  /*
    レベル
  */

  let level = "";


  /*
    激アツ

    条件をかなり厳しくする。
  */

  if (
    hard &&
    firstNo === 1 &&
    course1 === 1 &&
    firstRank === 1 &&
    national !== null &&
    national >= 6.50 &&
    top3 !== null &&
    top3 >= 60 &&
    confidence >= 86 &&
    gap >= 18
  ) {

    level = "激アツ";

  }
  else if (
    hard &&
    confidence >= 76
  ) {

    level = "本命";

  }
  else if (
    hard &&
    confidence >= 68
  ) {

    level = "有力";

  }


  /*
    推奨なし
  */

  if (!level) {
    return null;
  }


  /* =================================
     2・3着候補
  ================================= */

  const places =
    candidates
      .filter(x => x !== first)
      .slice(0,4);


  const a =
    places[0]
      ? num(places[0].x.entry_number)
      : null;

  const b =
    places[1]
      ? num(places[1].x.entry_number)
      : null;

  const c =
    places[2]
      ? num(places[2].x.entry_number)
      : null;


  /*
    買い目
  */

  const bets = [];


  if (a && b) {

    bets.push(
      `${firstNo}-${a}-${b}`
    );

    bets.push(
      `${firstNo}-${b}-${a}`
    );

  }


  if (a && c) {

    bets.push(
      `${firstNo}-${a}-${c}`
    );

    bets.push(
      `${firstNo}-${c}-${a}`
    );

  }


  /* =================================
     理由
  ================================= */

  const reasons = [];


  if (firstRank !== null) {

    reasons.push(
      rankName(firstRank)
    );

  }


  if (national !== null) {

    reasons.push(
      `全国勝率${national.toFixed(2)}`
    );

  }


  if (top3 !== null) {

    reasons.push(
      `3連対率${top3.toFixed(1)}%`
    );

  }


  const local =
    num(first.x.local_win_rate);

  if (local !== null) {

    reasons.push(
      `当地${local.toFixed(2)}`
    );

  }


  if (motor !== null) {

    reasons.push(
      `モーター3連対率${motor.toFixed(1)}%`
    );

  }


  if (course1 !== null) {

    reasons.push(
      `進入${course1}`
    );

  }


  if (exhibition1 !== null) {

    reasons.push(
      `展示${exhibition1.toFixed(2)}`
    );

  }


  if (st1 !== null) {

    reasons.push(
      `ST${st1.toFixed(2)}`
    );

  }


  const signature = [
    firstNo,
    course1 ?? "",
    exhibition1 ?? "",
    st1 ?? "",
    a ?? "",
    b ?? "",
    c ?? ""
  ].join("|");


  return {

    race: r,
    racers,
    candidates,
    first,
    places,
    confidence,
    level,
    bets,
    reasons,
    signature,
    gap

  };

}


/* =================================
   予想履歴
================================= */

function getPrevious(key) {

  const all =
    readStore(
      "boatPredictions",
      {}
    );

  return all[key] || null;

}


function savePrediction(
  key,
  data
) {

  const all =
    readStore(
      "boatPredictions",
      {}
    );

  all[key] = data;

  writeStore(
    "boatPredictions",
    all
  );

}


/* =================================
   予想変更理由
================================= */

function changeReason(
  previous,
  current
) {

  if (!previous) {
    return "";
  }


  if (
    previous.first !==
    current.first
  ) {

    return "1着本命が変更されました。";

  }


  if (
    previous.course !==
    current.course
  ) {

    return "進入コースが変わりました。";

  }


  if (
    previous.exhibition !==
    current.exhibition
  ) {

    return "展示タイムが更新されました。";

  }


  if (
    previous.st !==
    current.st
  ) {

    return "展示STが更新されました。";

  }


  if (
    previous.signature !==
    current.signature
  ) {

    return "直前情報が更新されました。";

  }


  return "";

}


/* =================================
   締切判定
================================= */

function isPastCutoff(r) {

  if (!r.closed_at) {
    return false;
  }


  const d =
    new Date(r.closed_at);


  if (
    Number.isNaN(
      d.getTime()
    )
  ) {

    return false;

  }


  return d.getTime() <
    Date.now();

}


/* =================================
   結果保存
================================= */

function saveResult(r) {

  try {

    const trifecta =
      r.result?.payouts?.trifecta;


    if (
      !Array.isArray(trifecta) ||
      !trifecta[0]?.combination
    ) {

      return;

    }


    const all =
      readStore(
        "boatResults",
        {}
      );


    const k =
      predictionKey(r);


    all[k] = {

      combination:
        trifecta[0].combination,

      savedAt:
        new Date().toISOString()

    };


    writeStore(
      "boatResults",
      all
    );


    /*
      購入済みデータにも結果を反映
    */

    const purchased =
      readStore(
        "boatPurchased",
        {}
      );


    if (purchased[k]) {

      purchased[k].result =
        trifecta[0].combination;

      writeStore(
        "boatPurchased",
        purchased
      );

    }

  }
  catch (_) {}

}


/* =================================
   購入済み判定
================================= */

function isPurchased(k) {

  const all =
    readStore(
      "boatPurchased",
      {}
    );

  return !!all[k];

}


/* =================================
   購入登録
================================= */

function purchaseRace(item) {

  const r =
    item.race;

  const k =
    predictionKey(r);


  const all =
    readStore(
      "boatPurchased",
      {}
    );


  if (all[k]) {
    return;
  }


  all[k] = {

    key:k,

    date:r.date,

    stadium_number:
      num(r.stadium_number),

    race_number:
      num(r.race_number),

    stadium:
      STADIUMS[
        num(r.stadium_number)
      ] ||
      `場${r.stadium_number}`,

    title:
      r.title || "",

    subtitle:
      r.subtitle || "",

    closed_at:
      r.closed_at || "",

    level:
      item.level,

    confidence:
      item.confidence,

    first:
      num(item.first.x.entry_number),

    firstName:
      item.first.x.name || "",

    bets:
      [...item.bets],

    boughtAt:
      new Date().toISOString(),

    result:null

  };


  writeStore(
    "boatPurchased",
    all
  );


  renderPurchaseState(
    k
  );

}


/* =================================
   購入ボタン状態
================================= */

function renderPurchaseState(k) {

  const buttons =
    document.querySelectorAll(
      `[data-buy-key="${CSS.escape(k)}"]`
    );


  const purchased =
    isPurchased(k);


  buttons.forEach(btn => {

    btn.textContent =
      purchased
        ? "購入済み"
        : "買った";

    btn.classList.toggle(
      "purchased",
      purchased
    );

    btn.disabled =
      purchased;

  });


  updatePurchasedCount();

}


/* =================================
   購入数
================================= */

function updatePurchasedCount() {

  const all =
    readStore(
      "boatPurchased",
      {}
    );


  const count =
    Object.keys(all).length;


  const el =
    $("#purchased-count");


  if (el) {

    el.textContent =
      count
        ? `購入済み ${count}`
        : "購入済み";

  }

}


/* =================================
   買い目表示
================================= */

function renderBet(combo) {

  const p =
    combo.split("-");


  if (p.length !== 3) {
    return "";
  }


  return `
    <div class="bet">
      ${esc(p[0])}
      <i>→</i>
      ${esc(p[1])}
      <i>→</i>
      ${esc(p[2])}
    </div>
  `;

}


/* =================================
   レースカード
================================= */

function renderRace(item) {

  const r =
    item.race;


  const stadium =
    STADIUMS[
      num(r.stadium_number)
    ] ||
    `場${r.stadium_number}`;


  const raceNo =
    num(r.race_number);


  const first =
    item.first.x;


  const firstNo =
    num(first.entry_number);


  const firstName =
    first.name ||
    "選手名不明";


  const second =
    item.places[0];


  const third =
    item.places[1];


  const bets =
    item.bets
      .map(renderBet)
      .join("");


  const racers =
    item.racers
      .map(x => {

        const no =
          num(x.entry_number);


        const p =
          getPreview(r)[String(no)] ||
          {};


        const course =
          num(p.course_number);


        const exhibition =
          num(p.exhibition_time);


        return `
          <div class="racer">

            <div class="racer-no">
              ${no}
            </div>

            <div class="racer-info">

              <b>
                ${esc(x.name)}
              </b>

              <span>
                ${rankName(x.rank_number)}
                ${
                  course !== null
                    ? ` / ${course}コース`
                    : ""
                }
              </span>

            </div>

            <div class="racer-time">
              ${
                exhibition !== null
                  ? exhibition.toFixed(2)
                  : "--"
              }
            </div>

          </div>
        `;

      })
      .join("");


  const k =
    predictionKey(r);


  const previous =
    getPrevious(k);


  const p1 =
    getPreview(r)["1"] ||
    {};


  const current = {

    first:firstNo,

    course:
      num(p1.course_number),

    exhibition:
      num(p1.exhibition_time),

    st:
      num(p1.start_timing),

    signature:
      item.signature,

    bets:
      item.bets

  };


  const reason =
    changeReason(
      previous,
      current
    );


  savePrediction(
    k,
    current
  );


  const purchased =
    isPurchased(k);


  return `
    <article
      class="
        race-card
        ${
          item.level === "激アツ"
            ? "hot"
            : ""
        }
      "
    >

      <div class="race-top">

        <div>

          <div class="race-title">

            ${esc(stadium)}
            ${raceNo}R

            <span class="grade">
              ${esc(
                gradeName(
                  r.grade_number
                )
              )}
            </span>

          </div>


          ${
            r.title
              ? `
                <div class="event-title">
                  ${esc(r.title)}
                </div>
              `
              : ""
          }


          ${
            r.subtitle
              ? `
                <div class="subtitle">
                  ${esc(r.subtitle)}
                </div>
              `
              : ""
          }


          <div class="deadline">
            締切 ${fmtTime(r.closed_at)}
          </div>

        </div>


        <div class="confidence">

          <div
            class="
              level
              ${
                item.level === "激アツ"
                  ? "hot-level"
                  : ""
              }
            "
          >
            ${esc(item.level)}
          </div>

          <strong>
            ${item.confidence}
          </strong>

          <small>
            信頼度
          </small>

        </div>

      </div>


      <div class="main-pick">

        <div class="pick-label">
          1着本命
        </div>

        <div class="pick-name">
          ${firstNo}号艇
          ${esc(firstName)}
        </div>

        <div class="pick-reason">
          ${esc(
            item.reasons.join(" / ")
          )}
        </div>

      </div>


      <div class="place">

        <div>

          <b>
            2着候補
          </b>

          ${
            second
              ? `
                ${num(second.x.entry_number)}
                号艇
                ${esc(second.x.name)}
              `
              : "-"
          }

        </div>


        <div>

          <b>
            3着候補
          </b>

          ${
            third
              ? `
                ${num(third.x.entry_number)}
                号艇
                ${esc(third.x.name)}
              `
              : "-"
          }

        </div>

      </div>


      ${
        bets
          ? `
            <div class="bets">

              <div class="bets-title">
                推奨買い目
              </div>

              <div class="bet-list">
                ${bets}
              </div>

            </div>
          `
          : ""
      }


      ${
        reason
          ? `
            <div class="change">

              <b>
                予想変更
              </b>

              <span>
                ${esc(reason)}
              </span>

            </div>
          `
          : ""
      }


      <button
        type="button"
        class="
          buy-button
          ${purchased ? "purchased" : ""}
        "
        data-buy-key="${esc(k)}"
        ${purchased ? "disabled" : ""}
      >
        ${
          purchased
            ? "購入済み"
            : "買った"
        }
      </button>


      <div class="racers">
        ${racers}
      </div>

    </article>
  `;

}


/* =================================
   開催場タブ
================================= */

function renderTabs(groups) {

  if (!groups.length) {
    return "";
  }


  let html = `
    <div class="stadium-tabs">
  `;


  groups.forEach(
    (group,index) => {

      html += `
        <button
          class="
            stadium-tab
            ${
              index === 0
                ? "active"
                : ""
            }
          "
          data-stadium="${group.number}"
        >

          <span>
            ${esc(group.name)}
          </span>

          <small>
            ${group.races.length}R
          </small>

        </button>
      `;

    }
  );


  html += `
    </div>

    <div
      id="stadium-content"
      class="stadium-content"
    ></div>
  `;


  return html;

}


/* =================================
   タブ設定
================================= */

function setupTabs(groups) {

  const tabs =
    document.querySelectorAll(
      ".stadium-tab"
    );


  const content =
    document.querySelector(
      "#stadium-content"
    );


  if (
    !tabs.length ||
    !content
  ) {

    return;

  }


  function show(number) {

    const group =
      groups.find(
        x =>
          String(x.number) ===
          String(number)
      );


    if (!group) {
      return;
    }


    tabs.forEach(tab => {

      tab.classList.toggle(
        "active",
        String(
          tab.dataset.stadium
        ) === String(number)
      );

    });


    content.innerHTML =
      group.races
        .sort(
          (a,b) =>
            b.confidence -
            a.confidence
        )
        .map(renderRace)
        .join("");


    setupBuyButtons();

  }


  tabs.forEach(tab => {

    tab.addEventListener(
      "click",
      () => {

        show(
          tab.dataset.stadium
        );

      }
    );

  });


  show(
    groups[0].number
  );

}


/* =================================
   買ったボタン
================================= */

function setupBuyButtons() {

  document
    .querySelectorAll(
      ".buy-button"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const k =
            button.dataset.buyKey;


          if (!k) {
            return;
          }


          /*
            現在表示中の予想から
            該当レースを探す
          */

          const item =
            window.__scored?.find(
              x =>
                predictionKey(x.race) === k
            );


          if (!item) {
            return;
          }


          purchaseRace(item);

        }
      );

    });

}


/* =================================
   メイン取得
================================= */

async function fetchData() {

  const controller =
    new AbortController();


  const timer =
    setTimeout(
      () =>
        controller.abort(),
      20000
    );


  try {

    return await fetch(
      API,
      {
        cache:"no-store",
        signal:
          controller.signal
      }
    );

  }
  finally {

    clearTimeout(timer);

  }

}


/* =================================
   メイン
================================= */

async function load() {

  if (
    !$("#status") ||
    !$("#picks")
  ) {

    return;

  }


  $("#status")
    .textContent =
      "データ取得中…";


  $("#picks")
    .innerHTML = `
      <div class="loading">
        出走表・直前情報を確認しています…
      </div>
    `;


  try {

    const response =
      await fetchData();


    if (!response.ok) {

      throw new Error(
        `API ${response.status}`
      );

    }


    const data =
      await response.json();


    const allRaces = [];


    for (
      const stadium of
      Object.values(
        data.programs?.stadiums || {}
      )
    ) {

      for (
        const r of
        Object.values(
          stadium.races || {}
        )
      ) {

        /*
          結果は締切後でも保存
        */

        if (r.result) {

          saveResult(r);

        }


        if (
          getRacers(r).length === 6
        ) {

          allRaces.push(r);

        }

      }

    }


    /*
      156レースを全部分析
    */

    const analyzed =
      allRaces
        .map(scoreRace)
        .filter(Boolean);


    /*
      現在時刻を過ぎたレースは
      通常画面には表示しない
    */

    const upcoming =
      analyzed.filter(
        x =>
          !isPastCutoff(x.race)
      );


    /*
      自信度順
    */

    upcoming.sort(
      (a,b) =>
        b.confidence -
        a.confidence
    );


    /*
      激アツ
    */

    const hot =
      upcoming.filter(
        x =>
          x.level === "激アツ"
      );


    /*
      その他
    */

    const normal =
      upcoming.filter(
        x =>
          x.level !== "激アツ"
      );


    /*
      開催場ごと
    */

    const map = {};


    normal.forEach(item => {

      const n =
        num(
          item.race.stadium_number
        );


      if (!map[n]) {

        map[n] = {

          number:n,

          name:
            STADIUMS[n] ||
            `場${n}`,

          races:[]

        };

      }


      map[n].races.push(item);

    });


    const groups =
      Object.values(map)
        .sort(
          (a,b) =>
            a.number -
            b.number
        );


    /*
      グローバルに保持
      「買った」ボタンから使用
    */

    window.__scored =
      upcoming;


    /*
      日付
    */

    $("#date")
      .textContent =
        allRaces[0]?.date ||
        new Date()
          .toLocaleDateString(
            "ja-JP"
          );


    /*
      更新時刻
    */

    $("#updated")
      .textContent =
        `取得時刻 ${
          new Date()
            .toLocaleTimeString(
              "ja-JP",
              {
                hour:"2-digit",
                minute:"2-digit",
                second:"2-digit"
              }
            )
        }`;


    /*
      ステータス
    */

    $("#status")
      .textContent =
        upcoming.length
          ? `${upcoming.length}レースを推奨`
          : "本日は推奨なし";


    /*
      画面
    */

    let html = "";


    /*
      激アツ
    */

    html += `

      <section class="hot-section">

        <div class="section-title">

          <span>
            激アツ
          </span>

          <small>
            ${hot.length}レース
          </small>

        </div>


        ${
          hot.length
            ? hot
                .map(renderRace)
                .join("")
            : `
              <div class="no-hot">
                現時点で激アツ判定はありません
              </div>
            `
        }

      </section>

    `;


    /*
      その他
    */

    if (groups.length) {

      html += `

        <div class="normal-title">
          その他の推奨レース
        </div>

        ${renderTabs(groups)}

      `;

    }
    else {

      html += `

        <div class="empty">

          <div class="empty-title">
            その他の推奨レースはありません
          </div>

          <div class="empty-text">
            締切前のレースだけを表示しています。
            直前情報の更新によって予想が変わる場合があります。
          </div>

        </div>

      `;

    }


    $("#picks")
      .innerHTML =
        html;


    /*
      タブ
    */

    setupTabs(groups);


    /*
      購入ボタン
    */

    setupBuyButtons();


    /*
      購入数
    */

    updatePurchasedCount();


  }
  catch (error) {

    console.error(
      "予想取得エラー",
      error
    );


    $("#status")
      .textContent =
        "データ取得に失敗しました";


    $("#picks")
      .innerHTML = `

        <div class="empty">

          <div class="empty-title">
            データを取得できませんでした
          </div>

          <div class="empty-text">
            更新ボタンを押して
            もう一度試してください。
          </div>

        </div>

      `;

  }

}


/* =================================
   更新ボタン
================================= */

$("#refresh")
  ?.addEventListener(
    "click",
    load
  );


/* =================================
   初回
================================= */

load();


/*
  3分ごとに更新
*/

setInterval(
  load,
  180000
);
