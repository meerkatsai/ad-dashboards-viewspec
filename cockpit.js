/* Dashboard demo (design-file layout) + drill bridge into the on-demand explorer (explore.html) — a faithful vanilla port of the design handoff's own
   dashboard (ui_kits/dashboard/): top bar = wordmark + platform dropdown ONLY;
   below it the design file's exact card sets, every chart its own full-width
   card. Per-card controls (metric / campaign / D-W-M / compare) work; pin =
   the lucide pin (unpin hides the card into a dashed restore row, like the
   design's App.jsx). Data = seeded demo executor over each card's baked-query
   vocabulary. No LLM, no build step. */
"use strict";

const GRAINS=["date","week","month"];
const NON_ADDITIVE=new Set(["roas","roi","direct_roi","indirect_roi","acos","ctr","cvr","cpc","avg_cpc","cpm","cpi","aov","reach","frequency","conv_rate","cost_per_conv","cost_per_purchase","conv_value_per_cost","mer","spend_share","ntb_share","budget_utilization_pct"]);
const SERIES=["var(--series-1)","var(--series-2)","var(--series-3)","var(--series-4)","var(--series-5)","var(--series-6)","var(--series-7)","var(--series-8)"];
const HEAT=["var(--heat-1)","var(--heat-2)","var(--heat-3)","var(--heat-4)","var(--heat-5)"];
const ICON_PIN='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg>';
const ICON_PIN_OFF='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M15 9.34V6h1a2 2 0 0 0 0-4H7.89"/><path d="m2 2 20 20"/><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"/></svg>';

const FACTS={
  spend:{label:"Spend",unit:"inr"}, sales:{label:"Sales",unit:"inr"}, revenue:{label:"Revenue",unit:"inr"},
  conv_value:{label:"Conv. value",unit:"inr"}, orders:{label:"Orders",unit:"num"}, units:{label:"Units",unit:"num"},
  clicks:{label:"Clicks",unit:"num"}, views:{label:"Views",unit:"num"}, impressions:{label:"Impressions",unit:"num"},
  purchases:{label:"Purchases",unit:"num"}, conversions:{label:"Conversions",unit:"num"},
  roas:{label:"ROAS",unit:"x"}, roi:{label:"ROI",unit:"x"}, conv_value_per_cost:{label:"Conv. value / cost",unit:"x"},
  acos:{label:"ACOS",unit:"pct",invert:true}, ctr:{label:"CTR",unit:"pct"}, cvr:{label:"CVR",unit:"pct"},
  conv_rate:{label:"Conv. rate",unit:"pct"}, cpc:{label:"CPC",unit:"inr",invert:true},
  avg_cpc:{label:"Avg CPC",unit:"inr",invert:true}, cpm:{label:"CPM",unit:"inr",invert:true},
  cpi:{label:"CPI",unit:"inr",invert:true}, cost_per_conv:{label:"Cost / conversion",unit:"inr",invert:true},
  mer:{label:"MER",unit:"x"}
};
const MEMBERS={
  campaign:["Always-On | Exact","Festive Push","NTB Broad","Retarget Cart","Category Defense","Hero SKU Boost","Generic Terms","Competitor Conquest"],
  placement:["Top of Search","Rest of Search","Product Pages"],
  device:["Mobile","Desktop","Tablet"],
  os:["Android","iOS"],
  platform:["Amazon","Flipkart","Google","Meta"]
};
/* the design file's per-platform vocabulary (native labels, never renamed for parity) */
const CFG={
  amazon:{ rev:"sales", eff:"roas", effAlt:"acos", grid:"placement",
    metrics:["spend","sales","roas","acos","ctr","cpc","orders"],
    kpis:["spend","sales","roas","acos","ctr","cpc"] },
  flipkart:{ rev:"revenue", eff:"roi", effAlt:"roi", grid:"placement",
    metrics:["spend","revenue","roi","ctr","cpc","orders","views"],
    kpis:["spend","revenue","roi","views","ctr","cpc"] },
  google:{ rev:"conv_value", eff:"conv_value_per_cost", effAlt:"cost_per_conv", grid:"device",
    metrics:["spend","conv_value","conv_value_per_cost","conversions","conv_rate","cost_per_conv","avg_cpc"],
    kpis:["spend","conversions","conv_value","conv_value_per_cost","conv_rate","cost_per_conv"] },
  meta:{ rev:"purchases", eff:"roas", effAlt:"cpi", grid:"os",
    metrics:["spend","purchases","roas","cpi","cpm","cpc","ctr","cvr"],
    kpis:["spend","purchases","roas","cpi","ctr","cvr"] }
};
const SPEND_LABEL={google:"Cost"};

/* ── seeded executor ────────────────────────────────────────────────────── */
function hash(str){let h=2166136261;for(const c of String(str)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0)/4294967295;}
function baseVal(metric,member,pk){
  const r=hash(pk+"|"+metric+"|"+member);
  const bases={spend:9e5,sales:32e5,revenue:28e5,conv_value:26e5,orders:2400,units:3100,purchases:1900,conversions:2100,clicks:52000,views:8.6e5,impressions:2.1e6};
  if(metric in bases)return bases[metric]*(0.25+r);
  if(metric==="roas")return 2.2+3.4*r; if(metric==="roi")return 1.8+3.8*r;
  if(metric==="conv_value_per_cost")return 2+3.5*r;
  if(metric==="acos")return 14+26*r; if(metric==="ctr")return .3+.9*r;
  if(metric==="cvr"||metric==="conv_rate")return 4+9*r;
  if(metric==="cpc"||metric==="avg_cpc")return 6+22*r;
  if(metric==="cpm")return 40+180*r; if(metric==="cpi")return 18+60*r;
  if(metric==="cost_per_conv")return 120+500*r; if(metric==="mer")return 1.6+2.6*r;
  return 100*r;
}
function seriesFor(metric,member,pk,n,compare){
  const b=baseVal(metric,member,pk)/(NON_ADDITIVE.has(metric)?1:n);
  const cur=[],prev=[];
  for(let t=0;t<n;t++){
    const wave=1+0.18*Math.sin((t/7)*Math.PI*2)+0.25*(hash(pk+member+metric+t)-0.5)+(0.25*t/n);
    cur.push(b*wave); if(compare)prev.push(b*wave*(0.82+0.14*hash(metric+t)));
  }
  return {cur,prev:compare?prev:null};
}
function totalFor(metric,member,pk){
  const s=seriesFor(metric,member,pk,30,true);
  const red=a=>NON_ADDITIVE.has(metric)?a.reduce((x,y)=>x+y,0)/a.length:a.reduce((x,y)=>x+y,0);
  return {cur:red(s.cur),prev:red(s.prev)};
}
function labels(gr,n){ const out=[]; for(let t=0;t<n;t++){ const d=new Date("2026-09-10");
  if(gr==="D"){d.setDate(d.getDate()-(n-1-t));out.push(`${d.getDate()}/${d.getMonth()+1}`);}
  else if(gr==="W"){d.setDate(d.getDate()-7*(n-1-t));out.push(`wk ${d.getDate()}/${d.getMonth()+1}`);}
  else {d.setMonth(d.getMonth()-(n-1-t));out.push(d.toLocaleString("en",{month:"short"}));}} return out;}
const NPER={D:30,W:12,M:6};

/* ── formatting ─────────────────────────────────────────────────────────── */
function fmt(v,unit){ if(v==null||isNaN(v))return "—";
  if(unit==="pct")return v.toFixed(1)+"%"; if(unit==="x")return v.toFixed(1)+"×";
  const inr=unit==="inr"; const a=Math.abs(v);
  const s=a>=1e7?(v/1e7).toFixed(1)+" Cr":a>=1e5?(v/1e5).toFixed(1)+" L":a>=1e3?(v/1e3).toFixed(1)+"K":Math.round(v).toLocaleString("en-IN");
  return inr?"₹"+s:s; }
const esc=t=>String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;");
const U=k=>(FACTS[k]||{}).unit||"num";
const L=(k,pk)=>k==="spend"&&SPEND_LABEL[pk]?SPEND_LABEL[pk]:(FACTS[k]||{}).label||k;
const dHtml=(d,inv)=>{ if(d==null)return ""; const good=(d>=0)!==!!inv;
  return `<span class="${good?"up":"down"}">${d>=0?"+":"−"}${Math.abs(d).toFixed(1)}%</span>`; };
const pct=(c,p)=>p?((c-p)/Math.abs(p))*100:null;

/* ── chart primitives (design-system chrome) ────────────────────────────── */
const W=1160;
function spark(data,w=88,h=26,color="var(--series-1)"){
  const mx=Math.max(...data),mn=Math.min(...data);
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-2-((v-mn)/((mx-mn)||1))*(h-4)}`).join(" ");
  return `<svg width="${w}" height="${h}" style="display:block"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
}
function lineChart(defs,xs,unit){
  const H=240,pad=52; let maxV=0; defs.forEach(s=>s.data.forEach(d=>{if(d!=null)maxV=Math.max(maxV,d);}));
  const px=i=>pad+i*(W-pad-16)/Math.max(xs.length-1,1), py=v=>H-28-(v/maxV)*(H-52);
  let out=`<svg viewBox="0 0 ${W} ${H}" width="100%">`;
  for(let g=0;g<=3;g++){const y=py(maxV*g/3);out+=`<line x1="${pad}" x2="${W-16}" y1="${y}" y2="${y}" stroke="var(--rule-grid)"/><text x="${pad-8}" y="${y+3}" text-anchor="end">${fmt(maxV*g/3,unit)}</text>`;}
  defs.forEach(s=>{out+=`<path fill="none" stroke="${s.color}" stroke-width="${s.dashed?1.5:2}" ${s.dashed?'stroke-dasharray="4 4"':""} stroke-linejoin="round" d="${s.data.map((d,i)=>d==null?"":(i&&s.data[i-1]!=null?"L":"M")+px(i).toFixed(1)+","+py(d).toFixed(1)).join("")}"/>`;});
  xs.forEach((x,i)=>{const st=Math.ceil(xs.length/10); if(xs.length<=10||i===xs.length-1||i%st===0) out+=`<text x="${px(i)}" y="${H-6}" text-anchor="${i===0?"start":i===xs.length-1?"end":"middle"}">${esc(x)}</text>`;});
  out+="</svg>";
  out+=`<div class="legend">${defs.map(s=>`<span><span style="width:14px;border-top:${s.dashed?"1.5px dashed":"2px solid"} ${s.color};display:inline-block"></span>${esc(s.label)}</span>`).join("")}</div>`;
  return out;
}
function vBars(groups,unit){ // groups: [{label, bars:[{label?,value,color,dim?}]}]
  const H=250,pad=52; let maxV=0; groups.forEach(g=>g.bars.forEach(b=>maxV=Math.max(maxV,b.value)));
  const gw=(W-pad-30)/groups.length;
  let out=`<svg class="barsv" viewBox="0 0 ${W} ${H}" width="100%">`;
  for(let g=0;g<=3;g++){const y=H-44-(g/3)*(H-84);out+=`<line x1="${pad}" x2="${W-16}" y1="${y}" y2="${y}" stroke="var(--rule-grid)"/><text x="${pad-8}" y="${y+3}" text-anchor="end">${fmt(maxV*g/3,unit)}</text>`;}
  groups.forEach((g,gi)=>{ const n=g.bars.length, bw=Math.min(64,(gw-24)/n);
    g.bars.forEach((b,bi)=>{ const x=pad+16+gi*gw+bi*(bw+6), h=(b.value/maxV)*(H-84), y=H-44-h;
      out+=`<rect class="bridge" data-m="${esc(g.label)}" x="${x}" y="${y}" width="${bw}" height="${h}" rx="1" fill="${b.dim?"var(--series-dim)":b.color||"var(--series-1)"}" style="cursor:pointer"><title>${esc(g.label)}${b.label?" · "+esc(b.label):""}: ${fmt(b.value,unit)} — click to drill in place</title></rect>`;
      out+=`<text class="val" x="${x+bw/2}" y="${y-6}" text-anchor="middle">${fmt(b.value,unit)}</text>`;});
    out+=`<text x="${pad+16+gi*gw+(Math.min(64,(gw-24)/n)*n+6*(n-1))/2}" y="${H-28}" text-anchor="middle" class="val">${esc(g.label)}</text>`;});
  return out+"</svg>";
}
function hBars(rows,nameKey,mk,pk,extraKey){
  const rh=30,H=rows.length*rh+12,lw=260; const maxV=Math.max(...rows.map(r=>r[mk]||0));
  let out=`<svg viewBox="0 0 ${W} ${H}" width="100%">`;
  rows.forEach((r,i)=>{ const y=6+i*rh,w=((r[mk]||0)/maxV)*(W-lw-150);
    out+=`<text x="${lw-8}" y="${y+13}" text-anchor="end" class="val">${esc(String(r[nameKey]).slice(0,36))}</text>`;
    out+=`<rect x="${lw}" y="${y}" width="${W-lw-150}" height="${rh-11}" rx="1" fill="var(--bar-track)"/>`;
    out+=`<rect class="bridge" data-m="${esc(r[nameKey])}" data-m2="${esc(r[nameKey])}" x="${lw}" y="${y}" width="${w}" height="${rh-11}" rx="1" fill="var(--series-1)" style="cursor:pointer"><title>${esc(r[nameKey])} — click to drill in place</title></rect>`;
    out+=`<text x="${lw+(W-lw-150)+8}" y="${y+13}">${fmt(r[mk],U(mk))}${extraKey?` · ${esc(L(extraKey,pk))} ${fmt(r[extraKey],U(extraKey))}`:""}</text>`;});
  return out+"</svg>";
}
function heat(cols,rowsY,val,unit,inv){
  const flat=[]; rowsY.forEach(yv=>cols.forEach(x=>flat.push(val(x,yv))));
  const mn=Math.min(...flat),mx=Math.max(...flat);
  const cw=Math.min(150,(W-250)/cols.length),ch=36,H=rowsY.length*ch+44;
  let out=`<svg viewBox="0 0 ${W} ${H}" width="100%">`;
  cols.forEach((x,i)=>out+=`<text x="${240+i*cw+cw/2}" y="14" text-anchor="middle">${esc(x)}</text>`);
  rowsY.forEach((yv,j)=>{ out+=`<text x="232" y="${26+j*ch+ch/2+4}" text-anchor="end" class="val">${esc(String(yv).slice(0,30))}</text>`;
    cols.forEach((x,i)=>{ const v=val(x,yv); let t=(v-mn)/((mx-mn)||1); if(inv)t=1-t;
      const step=Math.min(4,Math.floor(t*5));
      out+=`<rect class="bridge" data-hx="${esc(x)}" data-hy="${esc(String(yv))}" x="${240+i*cw}" y="${26+j*ch}" width="${cw-4}" height="${ch-4}" rx="1" fill="${HEAT[step]}" style="cursor:pointer"><title>click to drill in place — ${esc(String(yv))} × ${esc(x)}</title></rect><text pointer-events="none" x="${240+i*cw+cw/2-2}" y="${26+j*ch+ch/2+2}" text-anchor="middle" fill="${step>=3?"var(--surface-card)":"var(--ink-900)"}">${fmt(v,unit)}</text>`;});});
  return out+`</svg><div class="note">5-step scale, ${inv?"darker = better (lower)":"darker = higher"}</div>`;
}

/* ── per-card controls ──────────────────────────────────────────────────── */
let STATE={};
const key=(pk,id)=>pk+":"+id;
function st(pk,id,defaults){ const k=key(pk,id); if(!STATE[k])STATE[k]={...defaults}; return STATE[k]; }
function selCtl(pk,id,name,value,options){
  return `<select data-card="${id}" data-ctl="${name}">${options.map(o=>`<option value="${o.value}" ${o.value===value?"selected":""}>${esc(o.label)}</option>`).join("")}</select>`;
}
function segCtl(pk,id,name,value,options){
  return `<span class="seg">${options.map(o=>`<button data-card="${id}" data-ctl="${name}" data-val="${o}" class="${o===value?"on":""}">${o}</button>`).join("")}</span>`;
}
function cmpCtl(pk,id,on){ return `<button data-card="${id}" data-ctl="compare" data-val="${on?"":"1"}" class="${on?"on":""}">Compare</button>`; }
function rangeChip(){ return `<span class="chip">1 – 30d</span>`; }
function metricOpts(pk,keys){ return keys.map(k=>({value:k,label:L(k,pk)})); }

/* ── the design file's cards (PlatformCards.jsx, ported) ────────────────── */
const CARDS={
  kpi:{ title:()=>"Account KPIs", q:()=>"How is the account performing this period versus last period and plan?",
    ctl:(pk)=>segCtl(pk,"kpi","gr",st(pk,"kpi",{gr:"D"}).gr,["D","W","M"])+rangeChip(),
    body:(pk)=>{ const c=CFG[pk];
      return `<div class="kpis">`+c.kpis.map((k,i)=>{ const t=totalFor(k,"account",pk);
        const d=pct(t.cur,t.prev), target=(hash(pk+k+"t")-0.5)*24, inv=(FACTS[k]||{}).invert;
        const s=seriesFor(k,"account",pk,14,false).cur;
        return `<div class="kpi"><div class="lab">${esc(L(k,pk))}</div><div class="v num">${fmt(t.cur,U(k))}</div><div class="d">${dHtml(d,inv)} vs prev · ${dHtml(target,inv)} vs target</div><div style="margin-top:6px">${spark(s)}</div></div>`;}).join("")+`</div>`; } },
  trend:{ title:(pk)=>L(st(pk,"trend",{mk:"spend",gr:"D",cmp:true}).mk,pk)+" over time",
    q:(pk)=>{const s=st(pk,"trend",{});return "How is "+L(s.mk,pk).toLowerCase()+" changing "+(s.gr==="D"?"day on day":s.gr==="W"?"week on week":"month on month")+"?";},
    ctl:(pk)=>{const s=st(pk,"trend",{});return selCtl(pk,"trend","mk",s.mk,metricOpts(pk,CFG[pk].metrics))+segCtl(pk,"trend","gr",s.gr,["D","W","M"])+cmpCtl(pk,"trend",s.cmp)+rangeChip();},
    body:(pk)=>{const s=st(pk,"trend",{}); const n=NPER[s.gr]; const sr=seriesFor(s.mk,"account",pk,n,s.cmp);
      const defs=[{label:L(s.mk,pk),color:SERIES[0],data:sr.cur}];
      if(sr.prev)defs.push({label:"previous period",color:"var(--series-compare)",dashed:true,data:sr.prev});
      return lineChart(defs,labels(s.gr,n),U(s.mk)); } },
  rank:{ title:(pk)=>"Top campaigns by "+L(st(pk,"rank",{mk:CFG[pk].eff}).mk,pk),
    q:(pk)=>{const m=st(pk,"rank",{}).mk;return "Which campaigns "+((FACTS[m]||{}).invert?"are most efficient on ":"lead on ")+L(m,pk)+"?";},
    ctl:(pk)=>{const s=st(pk,"rank",{});return selCtl(pk,"rank","mk",s.mk,metricOpts(pk,CFG[pk].metrics))+rangeChip();},
    body:(pk)=>{const s=st(pk,"rank",{}); const inv=(FACTS[s.mk]||{}).invert;
      const rows=MEMBERS.campaign.map(c=>({name:c,[s.mk]:totalFor(s.mk,c,pk).cur,spend:totalFor("spend",c,pk).cur}))
        .sort((a,b)=>inv?a[s.mk]-b[s.mk]:b[s.mk]-a[s.mk]);
      return hBars(rows,"name",s.mk,pk,s.mk!=="spend"?"spend":null); } },
  ctrend:{ title:(pk)=>"Campaign "+L(st(pk,"ctrend",{mk:"spend",c:MEMBERS.campaign[0],gr:"D"}).mk,pk)+" over time",
    q:(pk)=>{const s=st(pk,"ctrend",{});return "How is "+esc(s.c)+" trending on "+L(s.mk,pk)+"?";},
    ctl:(pk)=>{const s=st(pk,"ctrend",{});return selCtl(pk,"ctrend","c",s.c,MEMBERS.campaign.map(c=>({value:c,label:c})))+selCtl(pk,"ctrend","mk",s.mk,metricOpts(pk,CFG[pk].metrics))+segCtl(pk,"ctrend","gr",s.gr,["D","W","M"])+rangeChip();},
    body:(pk)=>{const s=st(pk,"ctrend",{}); const n=NPER[s.gr]; const sr=seriesFor(s.mk,s.c,pk,n,true);
      return lineChart([{label:esc(s.c),color:SERIES[0],data:sr.cur},{label:"previous period",color:"var(--series-compare)",dashed:true,data:sr.prev}],labels(s.gr,n),U(s.mk)); } },
  table:{ title:()=>"Campaign performance table", q:()=>"What are the exact numbers for every campaign?",
    ctl:(pk)=>rangeChip(),
    body:(pk)=>{ const cols=["campaign"].concat(CFG[pk].metrics);
      const rows=MEMBERS.campaign.map(c=>{const r={campaign:c};CFG[pk].metrics.forEach(k=>r[k]=totalFor(k,c,pk).cur);return r;})
        .sort((a,b)=>b.spend-a.spend);
      let out="<table><tr>"+cols.map(c=>`<th>${c==="campaign"?"Campaign":esc(L(c,pk))}${c==="spend"?' <span style="color:var(--ink-400)">↓</span>':""}</th>`).join("")+"</tr>";
      rows.forEach(r=>{out+=`<tr class="num bridge" data-m="${esc(r.campaign)}" style="cursor:pointer" title="click to drill in place">`+cols.map(c=>`<td>${c==="campaign"?esc(r[c]):fmt(r[c],U(c))}</td>`).join("")+"</tr>";});
      return out+"</table>"; } },
  dod:{granularity:"D"}, wow:{granularity:"W"}, mom:{granularity:"M"},
  grid:{ title:(pk)=>"Campaign × "+({placement:"placement",device:"device",os:"OS"})[CFG[pk].grid]+" · "+L(CFG[pk].effAlt,pk),
    q:(pk)=>({amazon:"Where on Amazon are ads performing best?",flipkart:"Which retail-media placements are most effective?",google:"Are mobile, desktop and tablet users behaving differently?",meta:"Is there a meaningful gap between Android and iOS?"})[pk],
    ctl:(pk)=>rangeChip(),
    body:(pk)=>{ const dim=CFG[pk].grid, mk=CFG[pk].effAlt, inv=(FACTS[mk]||{}).invert;
      return heat(MEMBERS[dim],MEMBERS.campaign.slice(0,6),(x,y)=>baseVal(mk,y+"|"+x,pk),U(mk),inv); } },
  pbars:{ title:(pk)=>L(CFG[pk].eff,pk)+" by "+CFG[pk].grid,
    q:(pk)=>"Which "+CFG[pk].grid+" delivers the best return?",
    ctl:(pk)=>rangeChip(),
    body:(pk)=>{ const dim=CFG[pk].grid, mk=CFG[pk].eff;
      return vBars(MEMBERS[dim].map(m=>({label:m,bars:[{value:baseVal(mk,m,pk),color:"var(--series-1)"}]})),U(mk)); } },
  os:{ title:(pk)=>"Android vs iOS · "+L(st(pk,"os",{mk:"cpi"}).mk,pk).toUpperCase(),
    q:()=>"Is there a meaningful CPI/CVR gap between operating systems?",
    ctl:(pk)=>{const s=st(pk,"os",{});return segCtl(pk,"os","mk",s.mk==="cpi"?"CPI":"CVR",["CPI","CVR"])+rangeChip();},
    body:(pk)=>{const s=st(pk,"os",{}); const mk=s.mk;
      return vBars(MEMBERS.os.map(o=>({label:o,bars:[{value:baseVal(mk,o,pk),color:"var(--series-1)"}]})),U(mk)); } },
  /* all-platforms cards */
  bkpi:{ title:()=>"Blended KPIs · all platforms", q:()=>"How is total ad investment translating into sales across Amazon, Flipkart, Google and Meta?",
    ctl:()=>rangeChip(),
    body:()=>{ const items=[["spend","Total ad spend","inr",false],["sales","Attributed revenue","inr",false],["mer","MER (with formula)","x",false],["clicks","Clicks","num",false]];
      return `<div class="kpis">`+items.map(([k,lab,u])=>{ let cur=0,prev=0;
        MEMBERS.platform.forEach(p=>{const t=totalFor(k,"account",p.toLowerCase());cur+=t.cur;prev+=t.prev;});
        if(NON_ADDITIVE.has(k)){cur/=4;prev/=4;}
        return `<div class="kpi"><div class="lab">${esc(lab)}</div><div class="v num">${fmt(cur,u)}</div><div class="d">${dHtml(pct(cur,prev),false)} vs prev</div></div>`;}).join("")+
        `</div><div class="note">additive facts only across platforms; mer = revenue ÷ ad spend, always printed with its formula</div>`; } },
  ptrend:{ title:()=>"Spend over time by platform", q:()=>"How does spend move day on day on each platform?",
    ctl:(pk)=>{const s=st(pk,"ptrend",{gr:"D"});return segCtl(pk,"ptrend","gr",s.gr,["D","W","M"])+rangeChip();},
    body:(pk)=>{const s=st(pk,"ptrend",{}); const n=NPER[s.gr];
      const defs=MEMBERS.platform.map((p,i)=>({label:p,color:SERIES[i%8],data:seriesFor("spend","account",p.toLowerCase(),n,false).cur}));
      return lineChart(defs,labels(s.gr,n),"inr"); } },
  pspend:{ title:()=>"Spend by platform vs previous period", q:()=>"Where did the budget go this period compared with last?",
    ctl:()=>rangeChip(),
    body:()=>vBars(MEMBERS.platform.map(p=>{const t=totalFor("spend","account",p.toLowerCase());
      return {label:p,bars:[{label:"previous",value:t.prev,dim:true},{label:"current",value:t.cur,color:"var(--series-1)"}]};}),"inr") },
  proas:{ title:()=>"ROAS by platform", q:()=>"Which platform returns the most per rupee?",
    ctl:()=>rangeChip(),
    body:()=>vBars(MEMBERS.platform.map(p=>({label:p,bars:[{value:baseVal(p==="Google"?"conv_value_per_cost":p==="Flipkart"?"roi":"roas","account",p.toLowerCase()),color:"var(--series-1)"}]})),"x")+
      `<div class="note">each platform reports on its own basis (roi includes halo on flipkart; conv. value / cost on google) — never a blended roas</div>` },
  ptable:{ title:()=>"Platform comparison table", q:()=>"What are the exact totals per platform?",
    ctl:()=>rangeChip(),
    body:()=>{ const cols=["platform","spend","clicks","orders","eff"];
      let out=`<table><tr><th>Platform</th><th>Spend</th><th>Clicks</th><th>Orders</th><th>Return (native basis)</th></tr>`;
      MEMBERS.platform.forEach(p=>{const pk=p.toLowerCase();
        const effK=p==="Google"?"conv_value_per_cost":p==="Flipkart"?"roi":"roas";
        out+=`<tr class="num"><td>${p}</td><td>${fmt(totalFor("spend","account",pk).cur,"inr")}</td><td>${fmt(totalFor("clicks","account",pk).cur,"num")}</td><td>${fmt(totalFor("orders","account",pk).cur,"num")}</td><td>${fmt(baseVal(effK,"account",pk),"x")} <span style="color:var(--ink-400)">${esc(L(effK,pk))}</span></td></tr>`;});
      return out+"</table>"; } }
};
/* period tables (DoD / WoW / MoM): entity × date grid, value + Δ per cell */
function periodCard(gr){
  const name=gr==="D"?"Day on day":gr==="W"?"Week on week":"Month on month";
  const id=gr==="D"?"dod":gr==="W"?"wow":"mom";
  return {
    title:(pk)=>name+" · campaign "+L(st(pk,id,{mk:"spend"}).mk,pk),
    q:(pk)=>"How did each campaign's "+L(st(pk,id,{}).mk,pk).toLowerCase()+" move "+name.toLowerCase()+"?",
    ctl:(pk)=>selCtl(pk,id,"mk",st(pk,id,{}).mk,metricOpts(pk,CFG[pk].metrics))+rangeChip(),
    body:(pk)=>{ const s=st(pk,id,{}); const n=Math.min(gr==="D"?7:6,NPER[gr]); const xs=labels(gr,n);
      const inv=(FACTS[s.mk]||{}).invert;
      let out=`<table><tr><th>Campaign</th>${xs.map(x=>`<th>${esc(x)}</th>`).join("")}</tr>`;
      MEMBERS.campaign.slice(0,6).forEach(c=>{ const sr=seriesFor(s.mk,c,pk,n,false).cur;
        out+=`<tr class="num"><td>${esc(c)}</td>`+sr.map((v,i)=>{ const d=i?pct(v,sr[i-1]):null;
          return `<td>${fmt(v,U(s.mk))}<div style="font-family:var(--font-mono);font-size:var(--fs-micro)">${d==null?"—":dHtml(d,inv)}</div></td>`;}).join("")+"</tr>";});
      return out+"</table>"; } };
}
CARDS.dod=periodCard("D"); CARDS.wow=periodCard("W"); CARDS.mom=periodCard("M");

/* the design file's exact card sets and order (App.jsx) */
const PLATFORM_CARDS=["kpi","trend","rank","ctrend","table","dod","wow","mom","grid","pbars"];
const META_CARDS=["kpi","trend","rank","ctrend","table","dod","wow","mom","os","grid"];
const ALL_CARDS=["bkpi","ptrend","pspend","proas","ptable"];

/* ── shell ──────────────────────────────────────────────────────────────── */
const $=s=>document.querySelector(s);
const store={get:(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}},
             set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
let UNPINNED=store.get("mk-dash-unpinned",{});

function cardHtml(pk,id){
  const c=CARDS[id];
  const d=(["rank","table","pbars","grid"].includes(id))?drillOf(pk,id):null;
  // evaluation order matters: title() initializes the card's default state, q/ctl/body read it
  const titleHtml=c.title(pk), qHtml=c.q(pk), ctlHtml=c.ctl(pk);
  let body;
  if(d){ const mk=(st(pk,id,{}).mk)||(id==="grid"?CFG[pk].effAlt:CFG[pk].eff); body=drilledBody(pk,id,mk); }
  else body=c.body(pk);
  return `<div class="card" data-cid="${id}">
    <div class="card-h">
      <div class="tw"><div class="t">${titleHtml}${d?" — drilled":""}</div><div class="q">${qHtml}</div></div>
      <span class="meta">synced 2m ago</span>
      <button class="pinbtn pinned" data-unpin="${id}" title="unpin — moves to Reports">${ICON_PIN_OFF}</button>
    </div>
    <div class="controls">${ctlHtml}</div>
    ${crumbsHtml(pk,id)}
    <div class="body">${body}</div>
    <div class="foot"><span>data as of 2026-09-10 06:30 ist · last 2 days provisional</span><span>one visualization per card</span></div>
  </div>`;
}
function render(){
  const pk=store.get("mk-dash-platform","amazon");
  $("#platform").value=pk;
  const list=pk==="all"?ALL_CARDS:pk==="meta"?META_CARDS:PLATFORM_CARDS;
  const hidden=list.filter(id=>UNPINNED[key(pk,id)]);
  const shown=list.filter(id=>!UNPINNED[key(pk,id)]);
  let html=shown.map(id=>cardHtml(pk,id)).join("");
  if(hidden.length) html+=`<div class="restore"><span>${hidden.length} card${hidden.length>1?"s":""} unpinned — available in Reports.</span><button id="restoreAll">Restore all</button></div>`;
  html+=`<div class="mono" style="padding:8px 0 24px">sample data · figures in inr · one visualization per card · pin order: newest last · click any bar, row or cell to drill IN PLACE (breadcrumb undoes) · <a class="xlink" href="explore.html">on-demand explorer →</a></div>`;
  $("#stack").innerHTML=html;
  // wiring
  document.querySelectorAll("[data-unpin]").forEach(b=>b.addEventListener("click",()=>{
    UNPINNED[key(pk,b.dataset.unpin)]=true; store.set("mk-dash-unpinned",UNPINNED); render();}));
  const ra=$("#restoreAll"); if(ra) ra.addEventListener("click",()=>{ list.forEach(id=>delete UNPINNED[key(pk,id)]); store.set("mk-dash-unpinned",UNPINNED); render();});
  document.querySelectorAll("select[data-ctl]").forEach(s=>s.addEventListener("change",()=>{
    st(pk,s.dataset.card,{})[s.dataset.ctl]=s.value; render();}));
  document.querySelectorAll("button[data-ctl]").forEach(b=>b.addEventListener("click",()=>{
    const s=st(pk,b.dataset.card,{});
    if(b.dataset.ctl==="compare") s.cmp=!s.cmp;
    else if(b.dataset.card==="os") s.mk=b.dataset.val==="CPI"?"cpi":"cvr";
    else s[b.dataset.ctl]=b.dataset.val;
    render();}));
}
/* ── in-card drill: the card itself transforms; no navigation ───────────── */
const PRODUCT_DIM={amazon:"advertised_asin",flipkart:"fsn",google:"keyword",meta:"creative"};
const PRODUCT_MEMBERS={amazon:["AreoVeda Baby Lotion","AreoVeda Stretch Marks Cream","AreoVeda Baby Wash","AreoVeda Massage Oil","AreoVeda Rash Cream","AreoVeda Bathing Bar","AreoVeda Belly Oil","AreoVeda Nipple Butter"],
  flipkart:["Baby Lotion 200ml","Stretch Cream 100g","Baby Wash 250ml","Massage Oil 150ml","Rash Cream 50g","Bathing Bar 75g"],
  google:["baby diaper cream","stretch marks cream","baby wash","natural baby lotion","baby massage oil","diaper rash"],
  meta:["UGC Testimonial","Product Demo","Before/After","Founder Story"]};
const DIM_LABEL={advertised_asin:"Advertised ASIN",fsn:"FSN (product)",keyword:"Keyword",creative:"Creative",campaign:"Campaign",placement:"Placement",device:"Device",os:"OS"};
function nextDim(pk,dim){ // what a member of `dim` drills into
  if(dim==="campaign") return PRODUCT_DIM[pk];
  if(dim==="placement"||dim==="device"||dim==="os") return "campaign";
  return null; }
function membersOf(pk,dim){ return dim===PRODUCT_DIM[pk]?PRODUCT_MEMBERS[pk]:(MEMBERS[dim]||[]); }
function drillOf(pk,id){ const s=STATE[key(pk,id)]; return (s&&s.drill)||null; }
function setDrill(pk,id,drill){ const k=key(pk,id); if(!STATE[k])STATE[k]={}; STATE[k].drill=drill; render(); }
function pushDrill(pk,id,dim,value){
  const cur=drillOf(pk,id)||{filters:[]};
  const to=nextDim(pk,dim);
  if(!to){ return; } // edge of the hierarchy
  setDrill(pk,id,{filters:cur.filters.concat([{dim,value}]),toDim:to});
}
function drilledBody(pk,id,mk){
  const d=drillOf(pk,id); const seed=d.filters.map(f=>f.dim+"="+f.value).join("&");
  const scale=Math.pow(0.42,d.filters.length);
  const rows=membersOf(pk,d.toDim).map(m=>({name:m,
      [mk]:NON_ADDITIVE.has(mk)?baseVal(mk,m+"|"+seed,pk):baseVal(mk,m+"|"+seed,pk)*scale,
      spend:baseVal("spend",m+"|"+seed,pk)*scale}))
    .sort((a,b)=>((FACTS[mk]||{}).invert?a[mk]-b[mk]:b[mk]-a[mk])).slice(0,10);
  const deeper=nextDim(pk,d.toDim);
  return hBars(rows,"name",mk,pk,mk!=="spend"?"spend":null)
    +`<div class="note">${DIM_LABEL[d.toDim].toLowerCase()} within the selection · ${deeper?"click a bar to drill further":"edge of the hierarchy"}</div>`;
}
function crumbsHtml(pk,id){
  const d=drillOf(pk,id); if(!d) return "";
  return `<div class="crumbs">drilled: ${d.filters.map((f,i)=>`<span class="crumb" data-crumb="${i}" title="remove">${esc(DIM_LABEL[f.dim]||f.dim)} = ${esc(f.value)} ✕</span>`).join("")}</div>`;
}
document.addEventListener("click",e=>{
  const pk=store.get("mk-dash-platform","amazon");
  const card=e.target.closest?e.target.closest(".card"):null; if(!card)return;
  const cid=card.dataset.cid; if(!cid)return;
  const crumb=e.target.closest(".crumb");
  if(crumb){ const i=parseInt(crumb.dataset.crumb); const d=drillOf(pk,cid);
    const filters=d.filters.slice(0,i);
    if(!filters.length) setDrill(pk,cid,null);
    else setDrill(pk,cid,{filters,toDim:nextDim(pk,filters[filters.length-1].dim)});
    return; }
  const t=e.target.closest(".bridge"); if(!t)return;
  if(pk==="all")return;
  const d=drillOf(pk,cid);
  if(d&&t.dataset.m2!==undefined){ pushDrill(pk,cid,d.toDim,t.dataset.m2); return; } // deeper
  if(cid==="rank"&&t.dataset.m) pushDrill(pk,cid,"campaign",t.dataset.m);
  else if(cid==="table"&&t.dataset.m) pushDrill(pk,cid,"campaign",t.dataset.m);
  else if(cid==="pbars"&&t.dataset.m) pushDrill(pk,cid,CFG[pk].grid,t.dataset.m);
  else if(cid==="grid"&&t.dataset.hx){ const dim=CFG[pk].grid;
    setDrill(pk,cid,{filters:[{dim:"campaign",value:t.dataset.hy},{dim,value:t.dataset.hx}],toDim:PRODUCT_DIM[pk]}); }
});
const sel=$("#platform");
[{v:"all",l:"All platforms"},{v:"amazon",l:"Amazon Ads"},{v:"flipkart",l:"Flipkart Ads"},{v:"google",l:"Google Ads"},{v:"meta",l:"Meta Ads"}]
  .forEach(o=>{const el=document.createElement("option");el.value=o.v;el.textContent=o.l;sel.appendChild(el);});
sel.addEventListener("change",()=>{store.set("mk-dash-platform",sel.value);render();});
render();
