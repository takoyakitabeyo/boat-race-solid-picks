const API = "https://boatraceopenapi.github.io/api/v1/today.json";

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

const clamp = (v, min, max) =>
  Math.max(min, Math.min(max, v));

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

function gradeName(n) {
  const g = num(n);

  if (g === null) return "一般";

  /*
    APIのgrade_numberが取得できる場合に表示。
    値が不明な場合は無理にSG/G1等へ決め打ちしない。
  */
  return ({
    1:"SG",
    2:"G1",
    3:"G2",
    4:"G3"
  })[g] || "一般";
}

function fmtTime(v) {
  if (!v) return "--:--";

  const m = String(v).match(/(\d{2}):(\d{2})/);

  return m
    ? `${m[1]}:${m[2]}`
    : "--:--";
}

function getRacers(r) {
  return Object.values(r.racers || {})
    .sort((a,b) =>
      num(a.entry_number) - num(b.entry_number)
    );
}

function getPreview(r) {
  return r.preview?.racers || {};
}


/* =========================
   選手評価
========================= */

function playerBaseScore(x) {

  const rank = num(x.rank_number);

  let s = 0;

  // 級別
  if (rank === 1) s += 30;
  else if (rank === 2) s += 22;
  else if (rank === 3) s += 13;
  else if (rank === 4) s += 6;

  // 全国勝率
  const national = num(x.national_win_rate);

  if (national !== null) {
    s += clamp((national - 5) * 4, -8, 14);
  }

  // 全国3連対率
  const top3 = num(x.national_top_3_percent);

  if (top3 !== null) {
    s += clamp((top3 - 45) * 0.20, -5, 10);
  }

  // 当地勝率
  const local = num(x.local_win_rate);

  if (local !== null) {
    s += clamp((local - 4.5) * 2, -4, 8);
  }

  // モーター
  const motor = num(x.motor_top_3_percent);

  if (motor !== null) {
    s += clamp((motor - 45) * 0.10, -3, 6);
  }

  // 平均ST
  const st = num(x.average_start_timing);

  if (st !== null) {
    if (st <= 0.13) s += 5;
    else if (st <= 0.16) s += 3;
    else if (st >= 0.20) s -= 3;
  }

  return s;
}


/* =========================
   展示・進入評価
========================= */

function previewScore(x, p) {

  let s = 0;

  const course = num(p?.course_number);
  const exhibition = num(p?.exhibition_time);
  const st = num(p?.start_timing);

  // 進入
  if (course === 1) s += 10;
  else if (course === 2) s += 5;
  else if (course === 3) s += 3;

  // 展示ST
  if (st !== null) {
    if (st <= 0.10) s += 8;
    else if (st <= 0.13) s += 5;
    else if (st <= 0.16) s += 2;
    else if (st >= 0.20) s -= 5;
  }

  // 展示タイム
  if (exhibition !== null) {
    s += clamp((6.90 - exhibition) * 12, -5, 8);
  }

  return s;
}


/* =========================
   レース評価
========================= */

function scoreRace(r) {

  const racers = getRacers(r);

  if (racers.length !== 6) {
    return null;
  }

  const preview = getPreview(r);

  const candidates = racers.map(x => {

    const no = num(x.entry_number);

    const p = preview[String(no)] || {};

    const base = playerBaseScore(x);

    const pv = previewScore(x,p);

    let total = base + pv;

    /*
      1号艇はイン有利を加点。
      ただし「1号艇だから絶対」とはしない。
    */
    if (no === 1) {
      total += 12;
    }

    return {
      x,
      p,
      base,
      pv,
      total
    };

  }).sort((a,b) => b.total - a.total);


  const first = candidates[0];

  if (!first) return null;


  /*
    1着候補を評価
  */

  const firstNo = num(first.x.entry_number);

  const second = candidates
    .filter(x => x !== first)
    .slice(0,3);

  if (!second.length) return null;


  /*
    「1号艇が最有力」の場合はさらに加点
  */

  let confidence = first.total + 35;

  if (firstNo === 1) {
    confidence += 8;
  }

  /*
    1位と2位の差
  */

  const gap =
    first.total - second[0].total;

  if (gap >= 15) confidence += 10;
  else if (gap >= 8) confidence += 5;
  else if (gap <= 2) confidence -= 6;


  /*
    1号艇の展示状態
  */

  const p1 = preview["1"] || {};

  const course1 = num(p1.course_number);
  const st1 = num(p1.start_timing);

  if (course1 === 1) {
    confidence += 5;
  }

  if (st1 !== null && st1 <= 0.12) {
    confidence += 5;
  }


  confidence = Math.round(
    clamp(confidence, 40, 95)
  );


  /*
    ランク判定
  */

  let level;

  if (confidence >= 78) {
    level = "激アツ";
  }
  else if (confidence >= 66) {
    level = "本命";
  }
  else if (confidence >= 55) {
    level = "有力";
  }
  else {
    level = "見送り";
  }


  /*
    あまりにも接戦なら激アツを禁止
  */

  if (gap < 5 && level === "激アツ") {
    level = "本命";
  }

  /*
    1号艇がA1/A2で、他艇との差が大きければ加点
  */

  const rank1 = num(first.x.rank_number);

  if (
    firstNo === 1 &&
    (rank1 === 1 || rank1 === 2) &&
    gap >= 8
  ) {
    confidence += 4;

    if (confidence >= 78) {
      level = "激アツ";
    }
  }

  confidence = Math.round(
    clamp(confidence, 40, 95)
  );


  /*
    2・3着候補
  */

  const placeCandidates = candidates
    .filter(x => x !== first)
    .slice(0,4);


  /*
    買い目生成
  */

  const bets = [];

  for (const a of placeCandidates.slice(0,3)) {
    for (const b of placeCandidates.slice(0,3)) {

      if (a === b) continue;

      const combo =
        `${firstNo}-${num(a.x.entry_number)}-${num(b.x.entry_number)}`;

      if (!bets.includes(combo)) {
        bets.push(combo);
      }
    }
  }


  /*
    理由
  */

  const reasons = [];

  const rankText =
    rankName(first.x.rank_number);

  const national =
    num(first.x.national_win_rate);

  const top3 =
    num(first.x.national_top_3_percent);

  const local =
    num(first.x.local_win_rate);

  const exhibition =
    num(first.p.exhibition_time);

  const st =
    num(first.p.start_timing);

  const course =
    num(first.p.course_number);


  reasons.push(
    `${rankText}・全国勝率 ${
      national !== null
        ? national.toFixed(2)
        : "-"
    }`
  );

  if (top3 !== null) {
    reasons.push(
      `全国3連対率 ${top3.toFixed(1)}%`
    );
  }

  if (local !== null) {
    reasons.push(
      `当地勝率 ${local.toFixed(2)}`
    );
  }

  if (course !== null) {
    reasons.push(
      `進入 ${course}コース`
    );
  }

  if (exhibition !== null) {
    reasons.push(
      `展示 ${exhibition.toFixed(2)}`
    );
  }

  if (st !== null) {
    reasons.push(
      `展示ST ${st.toFixed(2)}`
    );
  }


  /*
    変更理由を作るための情報
  */

  const signature = [
    firstNo,
    course1 ?? "",
    exhibition ?? "",
    st1 ?? "",
    placeCandidates[0]
      ? num(placeCandidates[0].x.entry_number)
      : "",
    placeCandidates[1]
      ? num(placeCandidates[1].x.entry_number)
      : ""
  ].join("|");


  return {
    race: r,
    racers,
    candidates,
    first,
    placeCandidates,
    confidence,
    level,
    bets: bets.slice(0,6),
    reasons,
    signature,
    gap
  };
}


/* =========================
   前回予想との比較
========================= */

function getPreviousPrediction(key) {

  try {

    const data =
      JSON.parse(
        localStorage.getItem("boatPredictions") || "{}"
      );

    return data[key] || null;

  } catch (_) {

    return null;

  }
}


function savePrediction(key, data) {

  try {

    const all =
      JSON.parse(
        localStorage.getItem("boatPredictions") || "{}"
      );

    all[key] = data;

    localStorage.setItem(
      "boatPredictions",
      JSON.stringify(all)
    );

  } catch (_) {}
}


function getChangeReason(previous, current) {

  if (!previous) {
    return "";
  }

  if (
    previous.first !== current.first
  ) {
    return "1着本命が変更されています。進入・展示・選手評価の変化を反映しました。";
  }

  if (
    previous.course !== current.course
  ) {
    return "進入コースが変わったため、予想を再評価しました。";
  }

  if (
    previous.exhibition !== current.exhibition
  ) {
    return "展示タイムが更新されたため、予想を再評価しました。";
  }

  if (
    previous.st !== current.st
  ) {
    return "展示STが更新されたため、予想を再評価しました。";
  }

  if (
    previous.signature !== current.signature
  ) {
    return "直前情報が更新されたため、予想を再評価しました。";
  }

  return "";
}


/* =========================
   レース表示
========================= */

function renderRace(item) {

  const r = item.race;

  const stadium =
    STADIUMS[num(r.stadium_number)]
    || `場${r.stadium_number}`;

  const raceNo =
    num(r.race_number);

  const grade =
    gradeName(r.grade_number);

  const title =
    r.title || "";

  const subtitle =
    r.subtitle || "";

  const first =
    item.first.x;

  const firstNo =
    num(first.entry_number);

  const firstName =
    first.name || "選手名不明";


  const second =
    item.placeCandidates[0];

  const third =
    item.placeCandidates[1];


  const mainBets =
    item.bets
      .slice(0,3)
      .map(x =>
        `<span class="bet">${esc(x)}</span>`
      )
      .join("");


  const racers =
    item.racers
      .map(x => {

        const no =
          num(x.entry_number);

        const p =
          getPreview(r)[String(no)] || {};

        const course =
          num(p.course_number);

        const exhibition =
          num(p.exhibition_time);

        return `
          <div class="racer">
            <div class="racer-no">${no}</div>
            <div class="racer-info">
              <b>${esc(x.name)}</b>
              <span>
                ${rankName(x.rank_number)}
                ${course !== null
                  ? ` / ${course}コース`
                  : ""}
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


  const change =
    item.changeReason
      ? `
        <div class="change">
          <b>予想変更</b>
          <span>${esc(item.changeReason)}</span>
        </div>
      `
      : "";


  return `
    <article class="race-card ${item.level === "激アツ" ? "hot" : ""}">

      <div class="race-top">

        <div>

          <div class="race-title">
            ${esc(stadium)}
            ${raceNo}R

            <span class="grade">
              ${esc(grade)}
            </span>
          </div>

          <div class="event-title">
            ${esc(title)}
          </div>

          ${
            subtitle
              ? `<div class="subtitle">${esc(subtitle)}</div>`
              : ""
          }

          <div class="deadline">
            締切 ${fmtTime(r.closed_at)}
          </div>

        </div>


        <div class="confidence">

          <div class="level ${item.level === "激アツ" ? "hot-level" : ""}">
            ${esc(item.level)}
          </div>

          <strong>
            ${item.confidence}
          </strong>

          <small>信頼度</small>

        </div>

      </div>


      <div class="main-pick">

        <div class="pick-label">
          1着本命
        </div>

        <div class="pick-name">
          ${firstNo}号艇 ${esc(firstName)}
        </div>

        <div class="pick-reason">
          ${esc(item.reasons.join(" / "))}
        </div>

      </div>


      <div class="bets">

        <div class="bets-title">
          推奨買い目
        </div>

        <div class="bet-list">
          ${mainBets}
        </div>

      </div>


      <div class="place">

        <div>
          <b>2着候補</b>
          ${
            second
              ? `${num(second.x.entry_number)}号艇 ${esc(second.x.name)}`
              : "-"
          }
        </div>

        <div>
          <b>3着候補</b>
          ${
            third
              ? `${num(third.x.entry_number)}号艇 ${esc(third.x.name)}`
              : "-"
          }
        </div>

      </div>


      ${change}


      <div class="racers">
        ${racers}
      </div>

    </article>
  `;
}


/* =========================
   結果保存
========================= */

function saveResult(r) {

  try {

    const results =
      JSON.parse(
        localStorage.getItem("boatResults") || "{}"
      );

    const payouts =
      r.result?.payouts?.trifecta;

    if (!Array.isArray(payouts)) {
      return;
    }

    const first =
      payouts[0];

    if (!first?.combination) {
      return;
    }

    const key =
      `${r.date}-${r.stadium_number}-${r.race_number}`;

    results[key] = {
      combination: first.combination,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(
      "boatResults",
      JSON.stringify(results)
    );

  } catch (_) {}

}


/* =========================
   的中率集計
========================= */

function getStats() {

  try {

    const predictions =
      JSON.parse(
        localStorage.getItem("boatPredictions") || "{}"
      );

    const results =
      JSON.parse(
        localStorage.getItem("boatResults") || "{}"
      );

    let total = 0;
    let hit = 0;

    const now =
      new Date();

    const month =
      now.toISOString().slice(0,7);

    let monthTotal = 0;
    let monthHit = 0;


    for (const key of Object.keys(predictions)) {

      const p =
        predictions[key];

      if (!p?.bets?.length) continue;

      if (!results[key]) continue;

      total++;

      if (
        p.bets.includes(
          results[key].combination
        )
      ) {
        hit++;
      }

      if (
        key.startsWith(month)
      ) {

        monthTotal++;

        if (
          p.bets.includes(
            results[key].combination
          )
        ) {
          monthHit++;
        }

      }

    }

    return {
      total,
      hit,
      monthTotal,
      monthHit
    };

  } catch (_) {

    return {
      total:0,
      hit:0,
      monthTotal:0,
      monthHit:0
    };

  }
}


function percent(hit,total) {

  if (!total) return "--";

  return Math.round(
    hit / total * 100
  ) + "%";
}


/* =========================
   API取得
========================= */

async function fetchTimeout(
  url,
  ms = 20000
) {

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      ms
    );

  try {

    return await fetch(
      url,
      {
        cache:"no-store",
        signal:controller.signal
      }
    );

  } finally {

    clearTimeout(timer);

  }

}


/* =========================
   メイン処理
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


  $("#picks").innerHTML =
    `<div class="loading">
      出走表・直前情報を確認しています…
    </div>`;


  try {

    const response =
      await fetchTimeout(API);


    if (!response.ok) {
      throw new Error(
        `API ${response.status}`
      );
    }


    const data =
      await response.json();


    const races = [];


    const stadiums =
      data.programs?.stadiums || {};


    for (
      const stadium of Object.values(stadiums)
    ) {

      const raceList =
        stadium.races || {};


      for (
        const r of Object.values(raceList)
      ) {

        /*
          結果があるレースは集計用に保存
        */

        if (r.result) {
          saveResult(r);
        }


        /*
          出走表が6艇そろっているものだけ評価
        */

        const racers =
          getRacers(r);


        if (racers.length === 6) {
          races.push(r);
        }

      }

    }


    /*
      レース評価
    */

    const scored =
      races
        .map(scoreRace)
        .filter(Boolean)
        .filter(x => x.level !== "見送り");


    /*
      自信度順
    */

    scored.sort(
      (a,b) =>
        b.confidence - a.confidence
        ||
        num(a.race.race_number) -
        num(b.race.race_number)
    );


    /*
      前回予想との差分
    */

    const finalList =
      scored.map(item => {

        const r =
          item.race;

        const key =
          `${r.date}-${r.stadium_number}-${r.race_number}`;


        const previous =
          getPreviousPrediction(key);


        const p1 =
          getPreview(r)["1"] || {};


        const current = {

          first:
            num(item.first.x.entry_number),

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


        item.changeReason =
          getChangeReason(
            previous,
            current
          );


        savePrediction(
          key,
          current
        );


        return item;

      });


    /*
      日付表示
    */

    $("#date").textContent =
      races[0]?.date ||
      new Date().toLocaleDateString(
        "ja-JP"
      );


    $("#updated").textContent =
      `取得時刻 ${new Date().toLocaleTimeString(
        "ja-JP",
        {
          hour:"2-digit",
          minute:"2-digit",
          second:"2-digit"
        }
      )}`;


    /*
      統計
    */

    const stats =
      getStats();


    /*
      推奨あり
    */

    if (finalList.length) {

      $("#status").innerHTML =
        `本日は <b>${finalList.length}レース</b>を推奨`;


      $("#picks").innerHTML =
        `
        <div class="stats">

          <div>
            <span>当日</span>
            <b>--</b>
          </div>

          <div>
            <span>今月</span>
            <b>
              ${percent(
                stats.monthHit,
                stats.monthTotal
              )}
            </b>
          </div>

          <div>
            <span>累計</span>
            <b>
              ${percent(
                stats.hit,
                stats.total
              )}
            </b>
          </div>

        </div>

        ${finalList
          .map(renderRace)
          .join("")}
        `;

    }


    /*
      推奨なし
    */

    else {

      $("#status").textContent =
        "本日は現時点で推奨なし";


      $("#picks").innerHTML =
        `
        <div class="empty">

          <div class="empty-title">
            現時点で推奨できる固いレースはありません
          </div>

          <div class="empty-text">
            出走表は取得できています。
            直前情報が更新されると、
            推奨レースが出てくる可能性があります。
          </div>

          <button
            class="empty-refresh"
            onclick="load()">
            もう一度判定する
          </button>

        </div>
        `;

    }


  } catch (error) {

    console.error(
      "予想取得エラー:",
      error
    );


    $("#status").textContent =
      "データ取得に失敗しました";


    $("#picks").innerHTML =
      `
      <div class="empty">

        <div class="empty-title">
          データを取得できませんでした
        </div>

        <div class="empty-text">
          通信またはAPIの一時的なエラーです。
          「更新」を押して再試行してください。
        </div>

      </div>
      `;

  }

}


/* =========================
   更新ボタン
========================= */

$("#refresh")?.addEventListener(
  "click",
  load
);


/* =========================
   初回実行
========================= */

load();


/*
  3分ごとに自動更新
*/

setInterval(
  load,
  180000
);
