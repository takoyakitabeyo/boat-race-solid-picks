const API="https://boatraceopenapi.github.io/api/v1/today.json";

const STADIUMS={
  1:"桐生",2:"戸田",3:"江戸川",4:"平和島",
  5:"多摩川",6:"浜名湖",7:"蒲郡",8:"常滑",
  9:"津",10:"三国",11:"びわこ",12:"住之江",
  13:"尼崎",14:"鳴門",15:"丸亀",16:"児島",
  17:"宮島",18:"徳山",19:"下関",20:"若松",
  21:"芦屋",22:"福岡",23:"唐津",24:"大村"
};

const GRADES={
  1:"SG",
  2:"G1",
  3:"G2",
  4:"G3",
  5:"一般"
};

const $=s=>document.querySelector(s);

const num=v=>{
  const n=Number(v);
  return Number.isFinite(n)?n:null;
};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const esc=v=>String(v??"")
  .replaceAll("&","&amp;")
  .replaceAll("<","&lt;")
  .replaceAll(">","&gt;")
  .replaceAll('"',"&quot;")
  .replaceAll("'","&#039;");

function rankName(n){
  return ({
    1:"A1",
    2:"A2",
    3:"B1",
    4:"B2"
  }[n]||"-");
}

function fmtTime(v){
  const m=String(v||"").match(/(\d{2}):(\d{2})/);
  return m?`${m[1]}:${m[2]}`:"--:--";
}

function raceKey(r){
  return `${r.date}-${r.stadium_number}-${r.race_number}`;
}

function loadJSON(key,fallback){
  try{
    return JSON.parse(localStorage.getItem(key)||"");
  }catch(_){
    return fallback;
  }
}

function saveJSON(key,value){
  try{
    localStorage.setItem(key,JSON.stringify(value));
  }catch(_){}
}


/* =========================
   UI
========================= */

function injectStyle(){

  if(document.getElementById("cyber-style"))return;

  const style=document.createElement("style");
  style.id="cyber-style";

  style.textContent=`

    .cyber-title{
      font-size:2rem;
      font-weight:900;
      letter-spacing:.02em;
      margin:0;
    }

    .cyber-subtitle{
      margin-top:4px;
      font-size:.85rem;
      color:#64748b;
    }

    .stats-card{
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:8px;
      margin:14px 0;
    }

    .stat-box{
      background:#111827;
      color:white;
      border-radius:14px;
      padding:12px 8px;
      text-align:center;
    }

    .stat-label{
      font-size:.7rem;
      color:#cbd5e1;
    }

    .stat-value{
      font-size:1.3rem;
      font-weight:800;
      margin-top:3px;
    }

    .race-card.hot{
      border:2px solid #f59e0b;
      box-shadow:0 8px 25px rgba(245,158,11,.18);
    }

    .hot-badge{
      display:inline-block;
      background:#f59e0b;
      color:#111827;
      font-weight:900;
      padding:4px 9px;
      border-radius:999px;
      font-size:.75rem;
      margin-bottom:6px;
    }

    .grade{
      display:inline-block;
      font-weight:800;
      padding:3px 8px;
      border-radius:7px;
      background:#e2e8f0;
      margin-right:6px;
      font-size:.75rem;
    }

    .series-name{
      font-size:1rem;
      font-weight:800;
      margin-top:7px;
    }

    .day-name{
      font-size:.8rem;
      color:#64748b;
      margin-top:3px;
    }

    .prediction-change{
      margin-top:10px;
      padding:10px;
      border-radius:10px;
      background:#fff7ed;
      border-left:4px solid #f97316;
      color:#9a3412;
      font-size:.82rem;
    }

    .prediction-change b{
      display:block;
      margin-bottom:3px;
    }

    .reason-list{
      margin:0;
      padding-left:18px;
    }

    .confidence-high{
      color:#dc2626;
      font-weight:900;
    }

    .confidence-normal{
      font-weight:800;
    }

    .empty{
      padding:24px 14px;
      text-align:center;
    }

    .update-note{
      font-size:.78rem;
      color:#64748b;
      margin-top:8px;
    }

  `;

  document.head.appendChild(style);
}


/* =========================
   スコアリング
========================= */

function scoreRace(r){

  const rs=Object.values(r.racers||{})
    .sort((a,b)=>a.entry_number-b.entry_number);

  if(rs.length!==6)return null;

  const one=rs.find(x=>x.entry_number===1);

  if(!one)return null;

  const prs=r.preview?.racers||{};
  const p1=prs["1"]||{};

  const rank1=num(one.rank_number);
  const course1=num(p1.course_number)||1;

  let s=0;

  /* 1号艇の基本能力 */

  s+=({
    1:22,
    2:15,
    3:8,
    4:2
  }[rank1]||0);

  s+=clamp(
    (num(one.national_win_rate)||0)*3.2,
    0,
    24
  );

  s+=clamp(
    (num(one.local_win_rate)||0)*2.2,
    0,
    14
  );

  s+=clamp(
    (num(one.national_top_3_percent)||0)*.10,
    0,
    9
  );

  s+=clamp(
    (num(one.local_top_3_percent)||0)*.06,
    0,
    5
  );

  s+=clamp(
    (num(one.motor_top_3_percent)||0)*.05,
    0,
    4
  );

  const avg=num(one.average_start_timing);

  if(avg!==null){
    s+=clamp(
      (.25-avg)*25,
      -3,
      5
    );
  }

  if(course1===1)s+=5;


  /* 相手評価 */

  const rivals=rs.slice(1)
    .map(x=>{

      let v=({
        1:17,
        2:13,
        3:8,
        4:3
      }[num(x.rank_number)]||0);

      v+=clamp(
        (num(x.national_win_rate)||0)*1.8,
        0,
        12
      );

      v+=clamp(
        (num(x.motor_top_3_percent)||0)*.04,
        0,
        3
      );

      return{x,v};

    })
    .sort((a,b)=>b.v-a.v);


  /* 展示 */

  const ex=rs.map(x=>({
    x,
    t:num(
      prs[String(x.entry_number)]?.exhibition_time
    )
  }))
  .filter(z=>z.t!==null);

  if(ex.length===6){

    const pos=[...ex]
      .sort((a,b)=>a.t-b.t)
      .findIndex(
        z=>z.x.entry_number===1
      );

    if(pos===0)s+=5;
    else if(pos===1)s+=2;
    else if(pos>=4)s-=5;
  }


  /* 展示ST */

  const st=num(p1.start_timing);

  if(st!==null){

    if(st<=.10)s+=3;
    else if(st>=.20)s-=3;

  }


  const rivalGap=
    s-(rivals[0]?.v||0);

  const confidence=
    clamp(Math.round(s),0,100);


  /* 2・3着候補 */

  const cs=rs.slice(1)
    .map(x=>{

      const p=prs[String(x.entry_number)]||{};

      let v=({
        1:17,
        2:13,
        3:8,
        4:3
      }[num(x.rank_number)]||0);

      v+=
        (num(x.national_top_3_percent)||0)*.08;

      v+=
        (num(x.local_top_3_percent)||0)*.04;

      v+=
        (num(x.motor_top_3_percent)||0)*.04;

      if(
        p.course_number &&
        p.course_number<=3
      ){
        v+=2;
      }

      const et=num(p.exhibition_time);

      if(et!==null){
        v+=Math.max(0,1-et)*8;
      }

      return{x,v};

    })
    .sort((a,b)=>b.v-a.v);


  const show=
    confidence>=68 &&
    rivalGap>=45 &&
    rank1<=2 &&
    (num(one.national_top_3_percent)||0)>=50;


  const hot=
    confidence>=82 &&
    rivalGap>=55 &&
    rank1===1;


  return{

    r,

    s:confidence,

    rivalGap,

    show,

    hot,

    a:cs[0]?.x.entry_number,
    b:cs[1]?.x.entry_number,
    c:cs[2]?.x.entry_number,

    one,

    racers:rs,

    preview:prs

  };
}


/* =========================
   買い目
========================= */

function combos(x){

  if(!x.a||!x.b)return[];

  const out=[
    `1-${x.a}-${x.b}`,
    `1-${x.b}-${x.a}`
  ];

  if(x.c){

    out.push(
      `1-${x.a}-${x.c}`
    );

    out.push(
      `1-${x.c}-${x.a}`
    );

  }

  return[...new Set(out)];
}


/* =========================
   予想理由
========================= */

function reasons(x){

  const o=x.one;
  const p=x.preview["1"]||{};

  const a=[];

  a.push(
    `${rankName(o.rank_number)}・全国勝率 ${
      num(o.national_win_rate)?.toFixed(2)??"-"
    }`
  );

  if(num(o.local_win_rate)!==null){

    a.push(
      `当地勝率 ${num(o.local_win_rate).toFixed(2)}`
    );

  }

  if(num(o.national_top_3_percent)!==null){

    a.push(
      `全国3連対率 ${
        num(o.national_top_3_percent).toFixed(1)
      }%`
    );

  }

  if(num(p.exhibition_time)!==null){

    a.push(
      `展示 ${num(p.exhibition_time).toFixed(2)}秒`
    );

  }

  if(num(p.start_timing)!==null){

    a.push(
      `展示ST ${num(p.start_timing).toFixed(2)}`
    );

  }

  return a;
}


/* =========================
   変更理由
========================= */

function detectChanges(x){

  const r=x.r;
  const key=raceKey(r);

  const oldData=
    loadJSON("cyberRaceSnapshots",{});

  const old=oldData[key];

  const changes=[];

  const p=x.preview["1"]||{};

  if(!old){

    oldData[key]={
      prediction:combos(x),
      course:p.course_number??null,
      exhibition:p.exhibition_time??null,
      st:p.start_timing??null,
      score:x.s,
      updated:Date.now()
    };

    saveJSON(
      "cyberRaceSnapshots",
      oldData
    );

    return[];
  }


  if(
    old.course!==p.course_number &&
    p.course_number!=null
  ){

    changes.push(
      `1号艇の進入コースが ${old.course??"-"} → ${p.course_number} に変更`
    );

  }


  if(
    old.exhibition!=null &&
    p.exhibition_time!=null &&
    Math.abs(
      old.exhibition-p.exhibition_time
    )>=0.03
  ){

    changes.push(
      `1号艇の展示タイムが ${
        old.exhibition.toFixed(2)
      } → ${
        p.exhibition_time.toFixed(2)
      }秒に変化`
    );

  }


  if(
    old.st!=null &&
    p.start_timing!=null &&
    Math.abs(
      old.st-p.start_timing
    )>=0.03
  ){

    changes.push(
      `1号艇の展示STが ${
        old.st.toFixed(2)
      } → ${
        p.start_timing.toFixed(2)
      } に変化`
    );

  }


  const oldPrediction=
    (old.prediction||[]).join(",");

  const newPrediction=
    combos(x).join(",");

  if(
    oldPrediction &&
    oldPrediction!==newPrediction
  ){

    changes.push(
      `買い目が ${oldPrediction} → ${newPrediction} に変更`
    );

  }


  oldData[key]={
    prediction:combos(x),
    course:p.course_number??old.course,
    exhibition:p.exhibition_time??old.exhibition,
    st:p.start_timing??old.st,
    score:x.s,
    updated:Date.now()
  };

  saveJSON(
    "cyberRaceSnapshots",
    oldData
  );

  return changes;
}


/* =========================
   的中履歴
========================= */

function saveResult(r){

  const trifecta=
    r.result?.payouts?.trifecta?.[0];

  if(!trifecta)return;

  const key=raceKey(r);

  const history=
    loadJSON("cyberHistory",[]);

  if(
    history.some(x=>x.key===key)
  ){
    return;
  }

  const predictions=
    loadJSON("cyberPredictions",{});

  const prediction=
    predictions[key];

  if(!prediction)return;

  const actual=
    trifecta.combination;

  const hit=
    prediction.combos.includes(actual);

  history.push({

    key,

    date:r.date,

    month:r.date?.slice(0,7),

    stadium:r.stadium_number,

    race:r.race_number,

    actual,

    predictions:prediction.combos,

    confidence:prediction.confidence,

    hot:prediction.hot,

    hit,

    at:Date.now()

  });

  saveJSON(
    "cyberHistory",
    history
  );
}


/* =========================
   予想を保存
========================= */

function savePrediction(x){

  const key=raceKey(x.r);

  const predictions=
    loadJSON("cyberPredictions",{});

  const current=combos(x);

  predictions[key]={

    combos:current,

    confidence:x.s,

    hot:x.hot,

    updated:Date.now()

  };

  saveJSON(
    "cyberPredictions",
    predictions
  );
}


/* =========================
   的中率
========================= */

function rate(items){

  if(!items.length)return "--";

  const hits=
    items.filter(x=>x.hit).length;

  return `${Math.round(
    hits/items.length*100
  )}%`;
}

function renderStats(){

  const history=
    loadJSON("cyberHistory",[]);

  const today=
    new Date().toISOString().slice(0,10);

  const month=
    today.slice(0,7);

  const dayItems=
    history.filter(x=>x.date===today);

  const monthItems=
    history.filter(x=>x.month===month);

  const allItems=
    history;

  let box=document.getElementById(
    "cyberStats"
  );

  if(!box){

    box=document.createElement("section");

    box.id="cyberStats";
    box.className="stats-card";

    const status=
      document.querySelector(".status-card");

    if(status){
      status.insertAdjacentElement(
        "afterend",
        box
      );
    }

  }

  box.innerHTML=`

    <div class="stat-box">
      <div class="stat-label">
        当日的中率
      </div>
      <div class="stat-value">
        ${rate(dayItems)}
      </div>
    </div>

    <div class="stat-box">
      <div class="stat-label">
        今月の的中率
      </div>
      <div class="stat-value">
        ${rate(monthItems)}
      </div>
    </div>

    <div class="stat-box">
      <div class="stat-label">
        全期間的中率
      </div>
      <div class="stat-value">
        ${rate(allItems)}
      </div>
    </div>

  `;
}


/* =========================
   レース表示
========================= */

function renderPick(x){

  const r=x.r;
  const cs=combos(x);

  const grade=
    GRADES[num(r.grade_number)]||"一般";

  const day=
    r.day_number
      ? `${r.day_number}日目`
      : "";

  const title=
    r.title||"";

  const subtitle=
    r.subtitle||"";

  const changeReasons=
    detectChanges(x);

  const reasonText=
    reasons(x);


  const racers=
    x.racers.map(z=>
      `<div class="racer">
        <b>${esc(z.entry_number)}</b>
        ${esc(z.name)}
        <br>
        ${rankName(z.rank_number)}
      </div>`
    ).join("");


  const changeHTML=
    changeReasons.length
      ? `
        <div class="prediction-change">
          <b>予想変更</b>
          <ul class="reason-list">
            ${changeReasons.map(
              x=>`<li>${esc(x)}</li>`
            ).join("")}
          </ul>
        </div>
      `
      : "";


  const hotHTML=
    x.hot
      ? `<div class="hot-badge">
          激アツ
         </div>`
      : "";


  const confidenceClass=
    x.hot
      ? "confidence-high"
      : "confidence-normal";


  return `

    <article class="race-card ${x.hot?"hot":""}">

      <div class="race-head">

        <div>

          ${hotHTML}

          <div class="race-name">
            ${esc(
              STADIUMS[r.stadium_number]||
              "場"+r.stadium_number
            )}
            ${esc(r.race_number)}R
          </div>

          <div class="race-meta">

            <span class="grade">
              ${esc(grade)}
            </span>

            ${
              day
                ? `<span>${esc(day)}</span>`
                : ""
            }

          </div>

          <div class="series-name">
            ${esc(title)}
          </div>

          ${
            subtitle
              ? `<div class="muted">
                  ${esc(subtitle)}
                </div>`
              : ""
          }

          <span class="badge">
            締切 ${fmtTime(r.closed_at)}
          </span>

        </div>


        <div class="${confidenceClass}">
          信頼度 ${x.s}/100
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
                cs.slice(0,2).join(" / ")
              )}
            </span>
          </div>


          <div class="metric">
            <b>押さえ</b>
            <span>
              ${esc(
                cs.slice(2).join(" / ")||
                "なし"
              )}
            </span>
          </div>

        </div>


        <div class="reason">

          ${esc(
            reasonText.join(" / ")
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
   データ取得
========================= */

async function fetchTimeout(
  url,
  ms=15000
){

  const c=new AbortController();

  const timer=
    setTimeout(
      ()=>c.abort(),
      ms
    );

  try{

    return await fetch(
      url,
      {
        cache:"no-store",
        signal:c.signal
      }
    );

  }finally{

    clearTimeout(timer);

  }
}


/* =========================
   メイン
========================= */

async function load(){

  if(
    !$("#status")||
    !$("#picks")
  ){
    return;
  }


  $("#status").textContent=
    "データ取得中…";


  $("#notice")?.
    classList.add("hidden");


  try{

    const res=
      await fetchTimeout(API);


    if(!res.ok){
      throw new Error(
        `API ${res.status}`
      );
    }


    const data=
      await res.json();


    const races=[];


    for(
      const stadium of Object.values(
        data.programs?.stadiums||{}
      )
    ){

      for(
        const r of Object.values(
          stadium.races||{}
        )
      ){

        if(
          r.result?.payouts
        ){

          saveResult(r);

        }else{

          races.push(r);

        }

      }

    }


    const scored=
      races
        .map(scoreRace)
        .filter(Boolean);


    const shown=
      scored
        .filter(x=>x.show)
        .sort(
          (a,b)=>
            b.s-a.s||
            new Date(a.r.closed_at)-
            new Date(b.r.closed_at)
        );


    shown.forEach(
      savePrediction
    );


    $("#date").textContent=
      races[0]?.date||
      new Date().toLocaleDateString(
        "ja-JP"
      );


    $("#updated").textContent=
      `更新 ${
        new Date().toLocaleTimeString(
          "ja-JP",
          {
            hour:"2-digit",
            minute:"2-digit"
          }
        )
      }`;


    $("#status").textContent=
      shown.length
        ? `${shown.length}レースを推奨`
        : "本日は推奨なし";


    if(shown.length){

      $("#picks").innerHTML=
        shown
          .map(renderPick)
          .join("");

    }else{

      $("#picks").innerHTML=`

        <div class="empty">

          <b>
            本日は、現時点で推奨できる
            「固いレース」はありません。
          </b>

          <br>

          <span class="muted">
            基準を満たさないレースは
            無理に表示しません。
          </span>

          <div class="update-note">
            約3分ごとに自動更新します。
          </div>

        </div>

      `;

    }


    renderStats();


    localStorage.setItem(
      "lastLoaded",
      new Date().toISOString()
    );


  }catch(e){

    console.error(e);


    $("#status").textContent=
      "取得できませんでした";


    $("#picks").innerHTML="";


    if($("#notice")){

      $("#notice").textContent=
        "データ取得に失敗しました。時間を置いて「更新」を押してください。";

      $("#notice")
        .classList
        .remove("hidden");

    }

  }

}


/* =========================
   タイトル変更
========================= */

function setupTitle(){

  const h1=
    document.querySelector("h1");

  if(h1){

    h1.textContent=
      "予想屋サイバーはっちゃん";

    h1.classList.add(
      "cyber-title"
    );

  }

  const desc=
    document.querySelector(
      ".eyebrow"
    );

  if(desc){

    desc.textContent=
      "BOAT RACE / CYBER HATCHAN";

  }

}


/* =========================
   起動
========================= */

injectStyle();

setupTitle();

$("#refresh")?.
  addEventListener(
    "click",
    load
  );

load();


/*
  約3分ごとに更新。

  API側も約3分間隔で更新されるため、
  何も推奨レースがない場合も
  次回更新時に再判定する。
*/

setInterval(
  load,
  180000
);
