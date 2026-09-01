const API="https://boatraceopenapi.github.io/api/v1/today.json";
const STADIUMS={1:"桐生",2:"戸田",3:"江戸川",4:"平和島",5:"多摩川",6:"浜名湖",7:"蒲郡",8:"常滑",9:"津",10:"三国",11:"びわこ",12:"住之江",13:"尼崎",14:"鳴門",15:"丸亀",16:"児島",17:"宮島",18:"徳山",19:"下関",20:"若松",21:"芦屋",22:"福岡",23:"唐津",24:"大村"};

const $=s=>document.querySelector(s);
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
function rankName(n){return ({1:"A1",2:"A2",3:"B1",4:"B2"}[n]||"-")}
function fmtTime(v){const m=String(v||"").match(/(\d{2}):(\d{2})/);return m?`${m[1]}:${m[2]}`:"--:--"}

function scoreRace(r){
  const rs=Object.values(r.racers||{}).sort((a,b)=>a.entry_number-b.entry_number);
  if(rs.length!==6)return null;

  const one=rs.find(x=>x.entry_number===1);
  if(!one)return null;

  const prs=r.preview?.racers||{},p1=prs["1"]||{},
        rank1=num(one.rank_number),course1=num(p1.course_number)||1;

  let s=0;

  s+=({1:22,2:15,3:8,4:2}[rank1]||0);
  s+=clamp((num(one.national_win_rate)||0)*3.2,0,24);
  s+=clamp((num(one.local_win_rate)||0)*2.2,0,14);
  s+=clamp((num(one.national_top_3_percent)||0)*.10,0,9);
  s+=clamp((num(one.local_top_3_percent)||0)*.06,0,5);
  s+=clamp((num(one.motor_top_3_percent)||0)*.05,0,4);

  const avg=num(one.average_start_timing);
  if(avg!==null)s+=clamp((.25-avg)*25,-3,5);
  if(course1===1)s+=5;

  const rivals=rs.slice(1).map(x=>{
    let v=({1:17,2:13,3:8,4:3}[num(x.rank_number)]||0);
    v+=clamp((num(x.national_win_rate)||0)*1.8,0,12);
    v+=clamp((num(x.motor_top_3_percent)||0)*.04,0,3);
    return{x,v};
  }).sort((a,b)=>b.v-a.v);

  const ex=rs.map(x=>({
    x,
    t:num(prs[String(x.entry_number)]?.exhibition_time)
  })).filter(z=>z.t!==null);

  if(ex.length===6){
    const pos=[...ex]
      .sort((a,b)=>a.t-b.t)
      .findIndex(z=>z.x.entry_number===1);

    if(pos===0)s+=5;
    else if(pos===1)s+=2;
    else if(pos>=4)s-=5;
  }

  const st=num(prs["1"]?.start_timing);
  if(st!==null){
    if(st<=.10)s+=3;
    else if(st>=.20)s-=3;
  }

  const rivalGap=s-(rivals[0]?.v||0);
  const confidence=clamp(Math.round(s),0,100);

  const cs=rs.slice(1).map(x=>{
    const p=prs[String(x.entry_number)]||{};
    let v=({1:17,2:13,3:8,4:3}[num(x.rank_number)]||0)
      +(num(x.national_top_3_percent)||0)*.08
      +(num(x.local_top_3_percent)||0)*.04
      +(num(x.motor_top_3_percent)||0)*.04;

    if(p.course_number&&p.course_number<=3)v+=2;

    const et=num(p.exhibition_time);
    if(et!==null)v+=Math.max(0,1-et)*8;

    return{x,v};
  }).sort((a,b)=>b.v-a.v);

  return{
    r,
    s:confidence,
    show:confidence>=68&&rivalGap>=45&&rank1<=2&&(num(one.national_top_3_percent)||0)>=50,
    a:cs[0]?.x.entry_number,
    b:cs[1]?.x.entry_number,
    c:cs[2]?.x.entry_number,
    one,
    racers:rs,
    preview:prs
  };
}

function combos(x){
  if(!x.a||!x.b)return[];

  const out=[
    `1-${x.a}-${x.b}`,
    `1-${x.b}-${x.a}`
  ];

  if(x.c){
    out.push(`1-${x.a}-${x.c}`);
    out.push(`1-${x.c}-${x.a}`);
  }

  return[...new Set(out)];
}

function reasons(x){
  const o=x.one,
        p=x.preview["1"]||{},
        a=[];

  a.push(`${rankName(o.rank_number)}・全国勝率 ${num(o.national_win_rate)?.toFixed(2)??"-"}`);

  if(num(o.local_win_rate)!==null)
    a.push(`当地勝率 ${num(o.local_win_rate).toFixed(2)}`);

  if(num(o.national_top_3_percent)!==null)
    a.push(`全国3連対率 ${num(o.national_top_3_percent).toFixed(1)}%`);

  if(num(p.exhibition_time)!==null)
    a.push(`展示 ${num(p.exhibition_time).toFixed(2)}秒`);

  if(num(p.start_timing)!==null)
    a.push(`展示ST ${num(p.start_timing).toFixed(2)}`);

  return a.join(" / ");
}

function renderPick(x){
  const r=x.r,
        cs=combos(x);

  const racers=x.racers.map(z=>
    `<div class="racer"><b>${esc(z.entry_number)}</b>${esc(z.name)}<br>${rankName(z.rank_number)}</div>`
  ).join("");

  return `<article class="race-card">
    <div class="race-head"><div>
      <div class="race-name">${esc(STADIUMS[r.stadium_number]||"場"+r.stadium_number)} ${esc(r.race_number)}R</div>
      <div class="muted">${esc(r.title||"")}</div>
      <span class="badge">締切 ${fmtTime(r.closed_at)}</span>
    </div><div class="score">信頼度 ${x.s}/100</div></div>

    <div class="pick">
      <div class="pick-label">1着本命</div>
      <div class="pick-main">① ${esc(x.one.name)}</div>

      <div class="rows">
        <div class="metric">
          <b>本線</b>
          <span>${esc(cs.slice(0,2).join(" / "))}</span>
        </div>

        <div class="metric">
          <b>押さえ</b>
          <span>${esc(cs.slice(2).join(" / ")||"なし")}</span>
        </div>
      </div>

      <div class="reason">${esc(reasons(x))}</div>
    </div>

    <div class="racers">${racers}</div>
  </article>`;
}

function saveResult(r){
  try{
    const h=JSON.parse(localStorage.getItem("boatResults")||"{}");
    const t=r.result?.payouts?.trifecta?.[0]?.combination;

    if(t)
      h[`${r.date}-${r.stadium_number}-${r.race_number}`]={
        combination:t,
        at:new Date().toISOString()
      };

    localStorage.setItem("boatResults",JSON.stringify(h));
  }catch(_){}
}

async function fetchTimeout(url,ms=15000){
  const c=new AbortController(),
        timer=setTimeout(()=>c.abort(),ms);

  try{
    return await fetch(url,{cache:"no-store",signal:c.signal});
  }finally{
    clearTimeout(timer);
  }
}

async function load(){
  if(!$("#status")||!$("#picks"))return;

  $("#status").textContent="データ取得中…";
  $("#notice")?.classList.add("hidden");

  try{
    const res=await fetchTimeout(API);

    if(!res.ok)
      throw new Error(`API ${res.status}`);

    const data=await res.json(),
          races=[];

    for(const stadium of Object.values(data.programs?.stadiums||{})){
      for(const r of Object.values(stadium.races||{})){
        if(!r.result?.racers)
          races.push(r);
        else
          saveResult(r);
      }
    }

    const scored=races
      .map(scoreRace)
      .filter(Boolean)
      .filter(x=>x.show)
      .sort((a,b)=>
        b.s-a.s ||
        new Date(a.r.closed_at)-new Date(b.r.closed_at)
      );

    $("#date").textContent=
      races[0]?.date ||
      new Date().toLocaleDateString("ja-JP");

    $("#updated").textContent=
      `更新 ${new Date().toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})}`;

    $("#status").textContent=
      scored.length
        ? `${scored.length}レースを推奨`
        : "本日は推奨なし";

    $("#picks").innerHTML=
      scored.length
        ? scored.map(renderPick).join("")
        : `<div class="empty">
            <b>本日は、現時点で推奨できる「固いレース」はありません。</b>
            <br>
            <span class="muted">基準を満たさないレースは無理に表示しません。</span>
          </div>`;

    localStorage.setItem(
      "lastLoaded",
      new Date().toISOString()
    );

  }catch(e){
    console.error(e);

    $("#status").textContent="取得できませんでした";
    $("#picks").innerHTML="";

    if($("#notice")){
      $("#notice").textContent=
        "データ取得に失敗しました。時間を置いて「更新」を押してください。";
      $("#notice").classList.remove("hidden");
    }
  }
}

$("#refresh")?.addEventListener("click",load);

load();

setInterval(load,180000);
