/* View-spec living chart demo.
   JS port of generator/derive.py (derive + apply) over seeded demo data.
   Visuals follow the design handoff verbatim (tokens/, guidelines/): Geist type,
   RGBY series palette, 5-step heat scale, crosshair trend hover, hover-reveal
   bar labels, sunken table headers. The chart is a pivot surface CONTAINED to
   its envelope; every gesture rewrites the query deterministically. No LLM. */
"use strict";

const GRAINS = ["date", "week", "month"];
const ICON_PIN='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg>';
const NON_ADDITIVE = new Set(["roas","roi","direct_roi","indirect_roi","acos","ctr","cvr","cpc","avg_cpc","cpm","cpi","aov","reach","frequency","conv_rate","cost_per_conv","conv_value_per_cost","mer","spend_share"]);
const SERIES = ["var(--series-1)","var(--series-2)","var(--series-3)","var(--series-4)","var(--series-5)","var(--series-6)","var(--series-7)","var(--series-8)"];
const HEAT = ["var(--heat-1)","var(--heat-2)","var(--heat-3)","var(--heat-4)","var(--heat-5)"];
const FACTS = {
  spend:{label:"Spend",unit:"inr"}, sales:{label:"Sales",unit:"inr"}, revenue:{label:"Revenue",unit:"inr"},
  orders:{label:"Orders",unit:"num"}, clicks:{label:"Clicks",unit:"num"}, views:{label:"Views",unit:"num"},
  impressions:{label:"Impressions",unit:"num"}, roas:{label:"ROAS",unit:"x"}, roi:{label:"ROI",unit:"x"},
  acos:{label:"ACOS",unit:"pct",invert:true}, ctr:{label:"CTR",unit:"pct"}, cvr:{label:"CVR",unit:"pct"},
  cpc:{label:"CPC",unit:"inr",invert:true}, purchases:{label:"Purchases",unit:"num"},
  total_sales:{label:"Total sales",unit:"inr"}, spend_share:{label:"Spend share",unit:"pct"},
  sessions:{label:"Sessions",unit:"num"}, atc:{label:"ATC",unit:"num"}, checkouts:{label:"Checkouts",unit:"num"}
};
const MEMBERS = {
  placement:["Top of Search","Rest of Search","Product Pages"],
  advertised_asin:["AreoVeda Baby Lotion","AreoVeda Stretch Marks Cream","AreoVeda Baby Wash","AreoVeda Massage Oil","AreoVeda Diaper Rash Cream","AreoVeda Bathing Bar","AreoVeda Belly Oil","AreoVeda Nipple Butter","AreoVeda Face Serum","AreoVeda Under Eye Gel","AreoVeda Intimate Wash","AreoVeda Baby Powder"],
  fsn:["Kurta Set A","Saree Classic","Lehenga Festive","Kurta Set B","Dupatta Silk","Palazzo Pair","Anarkali Blue","Co-ord Set"],
  campaign:["Always-On | Exact","Festive Push","NTB Broad","Retarget Cart","Category Defense","Hero SKU Boost","Generic Terms","Competitor Conquest"],
  ad_group:["Diapering","Bath & Body","Mom Care","Gifting"],
  keyword:["baby diaper cream","stretch marks cream","baby wash","natural baby lotion","baby massage oil","diaper rash","baby bathing bar","new mom gift"],
  search_term:["baby rash cream","diaper cream for baby","baby lotion natural","baby oil massage","rash free cream","baby soap","momcare cream","baby wash organic"],
  match_type:["Exact","Phrase","Broad"],
  ad_set:["Prospecting IN","Retarget 7d","Lookalike 2%","Broad 25-44"],
  creative:["UGC Testimonial","Product Demo","Before/After","Founder Story"],
  age:["18-24","25-34","35-44","45-54"],
  publisher_platform:["Facebook","Instagram","Audience Network"],
  device:["Mobile","Desktop","Tablet"],
  channel:["Online Store","Instagram Shop","WhatsApp","Marketplace"],
  product:["Baby Lotion","Stretch Cream","Baby Wash","Massage Oil","Rash Cream","Bathing Bar"],
  first_order_month:["Mar 2026","Apr 2026","May 2026","Jun 2026","Jul 2026","Aug 2026"],
  funnel_stage:["Sessions","Product views","ATC","Checkout","Purchase"]
};
const DIMS = {
  placement:{label:"Placement",kind:"categorical",cardinality:"low",drill_to:["campaign","advertised_asin"]},
  advertised_asin:{label:"Advertised ASIN",kind:"entity",cardinality:"high",drill_to:[]},
  fsn:{label:"FSN (product)",kind:"entity",cardinality:"high",drill_to:[]},
  campaign:{label:"Campaign",kind:"entity",cardinality:"high",drill_to:["ad_group","placement","keyword","search_term","advertised_asin"]},
  ad_group:{label:"Ad group",kind:"entity",cardinality:"high",drill_to:["keyword","search_term","advertised_asin"]},
  keyword:{label:"Keyword",kind:"entity",cardinality:"high",drill_to:["search_term"]},
  search_term:{label:"Search term",kind:"categorical",cardinality:"high",drill_to:[]},
  match_type:{label:"Match type",kind:"categorical",cardinality:"low",drill_to:["keyword"]},
  ad_set:{label:"Ad set",kind:"entity",cardinality:"high",drill_to:["creative"]},
  creative:{label:"Creative",kind:"entity",cardinality:"high",drill_to:[]},
  age:{label:"Age bracket",kind:"categorical",cardinality:"low",drill_to:["campaign"]},
  publisher_platform:{label:"Platform",kind:"categorical",cardinality:"low",drill_to:["campaign"]},
  device:{label:"Device",kind:"categorical",cardinality:"low",drill_to:["campaign"]},
  channel:{label:"Sales channel",kind:"categorical",cardinality:"low",drill_to:["product"]},
  product:{label:"Product",kind:"entity",cardinality:"high",drill_to:[]},
  first_order_month:{label:"First-order month",kind:"cohort",cardinality:"high",drill_to:[]},
  funnel_stage:{label:"Funnel stage",kind:"stage",cardinality:"low",drill_to:[]}
};

/* ── canned prompts (labels name the representation so nothing is missable) ── */
const PROMPTS = [
  {label:'KPI strip — "Account KPIs" (Amazon)', platform:"amazon", intent:"kpi",
   title:"Account KPIs",
   task:{entity:"account",metrics:["spend","sales","roas","acos"],time_range:{type:"relative",value:30,unit:"day"},comparison:{metric:"spend",baseline:"previous_period"}}},
  {label:'Trend — "How is spend trending?" (Amazon)', platform:"amazon", intent:"trend",
   title:"Spend — daily trend",
   task:{entity:"account",metrics:["spend","sales"],dimensions:["date"],time_range:{type:"relative",value:30,unit:"day"},comparison:{metric:"spend",baseline:"previous_period"}}},
  {label:'Vertical bars — "Spend allocation across placements" (Amazon)', platform:"amazon", intent:"composition",
   title:"Spend allocation across placements",
   task:{entity:"campaign",metrics:["spend","roas"],dimensions:["placement"],time_range:{type:"relative",value:30,unit:"day"}}},
  {label:'Ranked bars — "Which products are eating spend?" (Amazon)', platform:"amazon", intent:"comparison",
   title:"Products by spend",
   task:{entity:"campaign",metrics:["spend","roas","acos"],dimensions:["advertised_asin"],time_range:{type:"relative",value:30,unit:"day"},sort:{metric:"spend",direction:"desc"},limit:10}},
  {label:'Table — "Campaign performance, exact values" (Amazon)', platform:"amazon", intent:"detail",
   title:"Campaign performance",
   task:{entity:"campaign",metrics:["spend","sales","roas","acos","ctr","cpc"],dimensions:["campaign"],time_range:{type:"relative",value:30,unit:"day"},sort:{metric:"spend",direction:"desc"},limit:10}},
  {label:'Table — "Keyword detail" (Flipkart)', platform:"flipkart", intent:"detail",
   title:"Keyword detail",
   task:{entity:"campaign",metrics:["spend","revenue","roi","clicks","ctr"],dimensions:["keyword"],time_range:{type:"relative",value:30,unit:"day"},sort:{metric:"spend",direction:"desc"},limit:10}},
  {label:'Heatmap — "Placement × match type efficiency" (Flipkart)', platform:"flipkart", intent:"comparison",
   title:"ROI — placement × match type",
   task:{entity:"campaign",metrics:["roi","spend"],dimensions:["placement","match_type"],time_range:{type:"relative",value:30,unit:"day"}}},
  {label:'Marimekko — "Spend share, placement × match type" (Flipkart)', platform:"flipkart", intent:"composition",
   title:"Spend share — placement × match type",
   task:{entity:"campaign",metrics:["spend"],dimensions:["placement","match_type"],time_range:{type:"relative",value:30,unit:"day"}}},
  {label:'Cohort matrix — "Repeat orders by first-order cohort" (Shopify)', platform:"shopify", intent:"cohort",
   title:"Repeat orders by first-order cohort",
   task:{entity:"store",metrics:["orders"],dimensions:["first_order_month","month"],time_range:{type:"relative",value:6,unit:"month"}}},
  {label:'Sankey — "Where does the funnel leak?" (Shopify)', platform:"shopify", intent:"flow",
   title:"Funnel flow — sessions to purchase",
   task:{entity:"store",metrics:["sessions"],dimensions:["funnel_stage"],time_range:{type:"relative",value:30,unit:"day"}}}
];

/* ── derive (port of derive.py) ─────────────────────────────────────────── */
function envelopeFor(query, platform){
  const task = query.task;
  let qdims = (task.dimensions||[]).filter(d=>!GRAINS.includes(d));
  const seed = qdims.length?qdims:({account:["campaign"],campaign:["campaign"],store:["channel"]}[task.entity]||[]);
  const keys=[], frontier=[...seed];
  while(frontier.length){
    const k = frontier.shift();
    if(keys.includes(k)||!DIMS[k]) continue;
    keys.push(k); frontier.push(...DIMS[k].drill_to);
  }
  return {platform, entity:task.entity,
    facts: task.metrics.map(k=>({key:k,...FACTS[k],additive:!NON_ADDITIVE.has(k)})),
    dims: keys.map(k=>({key:k,label:DIMS[k].label,kind:DIMS[k].kind,cardinality:DIMS[k].cardinality,drill_to:DIMS[k].drill_to})),
    grains: GRAINS, source: qdims.some(d=>["keyword","search_term","placement","advertised_asin","fsn","match_type","creative"].includes(d)) ? "bronze":"gold"};
}
function chooseView(query, env, intent){
  const task=query.task, primary=(task.sort&&task.sort.metric)||env.facts[0].key;
  const grain=(task.dimensions||[]).find(d=>GRAINS.includes(d))||null;
  const cats=env.dims.filter(d=>(task.dimensions||[]).includes(d.key));
  const v={intent};
  const fact=k=>env.facts.find(f=>f.key===k)||{};
  if(intent==="detail") Object.assign(v,{representation:"table",y:env.facts.map(f=>f.key),sort:task.sort?{by:task.sort.metric,direction:task.sort.direction}:{by:primary,direction:"desc"},limit:task.limit||10});
  else if(intent==="cohort") Object.assign(v,{representation:"cohort_matrix",x:cats[0]?cats[0].key:"first_order_month",series:"month",y:[primary]});
  else if(intent==="flow"&&cats.some(c=>c.kind==="stage")) Object.assign(v,{representation:"sankey",x:cats[0].key,series:cats[0].key,y:[primary]});
  else if(intent==="composition"&&cats.length===2&&fact(primary).additive) Object.assign(v,{representation:"marimekko",x:cats[0].key,series:cats[1].key,y:[primary]});
  else if(intent==="kpi"||(!cats.length&&!grain)) Object.assign(v,{representation:"kpi",y:env.facts.map(f=>f.key).slice(0,4),compare:true});
  else if(grain&&!cats.length) Object.assign(v,{representation:"line",x:grain,y:task.metrics.slice(0,2),compare:!!task.comparison});
  else if(grain&&cats.length===1&&cats[0].cardinality==="low") Object.assign(v,{representation:"line",x:grain,series:cats[0].key,y:[primary]});
  else if(cats.length===1&&cats[0].cardinality==="low"){Object.assign(v,{representation:"bars_v",x:cats[0].key,y:[primary]}); if(intent==="composition"&&fact(primary).additive) v.share=true;}
  else if(cats.length===1){const inv=fact(primary).invert; Object.assign(v,{representation:"bars_h",x:cats[0].key,y:[primary],sort:{by:primary,direction:inv?"asc":"desc"},limit:10});}
  else if(cats.length===2) Object.assign(v,{representation:"heatmap",x:cats[0].key,series:cats[1].key,y:[primary]});
  else Object.assign(v,{representation:"table",y:env.facts.map(f=>f.key),sort:{by:primary,direction:"desc"},limit:10});
  return v;
}
function derive(p){ const query={version:"1.0",task_type:"query",task:JSON.parse(JSON.stringify(p.task))};
  const env=envelopeFor(query,p.platform);
  return {version:"1.0",title:p.title,query,envelope:env,view:chooseView(query,env,p.intent),pin:{pinnable:true}};
}
function applyI(spec, i){
  const s=JSON.parse(JSON.stringify(spec)), task=s.query.task, env=s.envelope;
  const dimKeys=new Set(env.dims.map(d=>d.key)), factKeys=new Set(env.facts.map(f=>f.key));
  if(i.type==="drill"){
    const filters=i.filters||[{dim:i.on_dim,value:i.value}];
    for(const f of filters) if(!env.dims.find(d=>d.key===f.dim)) throw Error(`dim ${f.dim} outside envelope`);
    const ok=filters.some(f=>{const d=env.dims.find(x=>x.key===f.dim);return d&&d.drill_to.includes(i.to);});
    if(!ok) throw Error(`drill →${i.to} outside envelope`);
    for(const f of filters)(task.where=task.where||[]).push({dimension:f.dim,operator:"eq",value:f.value});
    task.dimensions=(task.dimensions||[]).filter(d=>GRAINS.includes(d)).concat([i.to]);
    delete task.sort; delete task.limit;
  } else if(i.type==="pivot_dim"){
    if(!dimKeys.has(i.to)) throw Error("outside envelope");
    task.dimensions=(task.dimensions||[]).filter(d=>GRAINS.includes(d)).concat([i.to]);
  } else if(i.type==="pivot_fact"){
    if(!factKeys.has(i.to)) throw Error("outside envelope");
    if(!task.metrics.includes(i.to)) task.metrics.push(i.to);
    if(task.sort) task.sort.metric=i.to;
    s._primary=i.to;
  } else if(i.type==="regrain"){
    task.dimensions=(task.dimensions||[]).map(d=>GRAINS.includes(d)?i.to:d);
    if(!(task.dimensions||[]).includes(i.to)&&s.view.representation==="line") task.dimensions.unshift(i.to);
  } else if(i.type==="rerange"){ task.time_range=i.date_range; }
  else if(i.type==="toggle_compare"){ task.comparison?delete task.comparison:(task.comparison={metric:task.metrics[0],baseline:"previous_period"}); }
  const primary=s._primary; delete s._primary;
  if(primary&&!task.sort&&s.view.representation!=="line") task.sort={metric:primary,direction:(FACTS[primary]&&FACTS[primary].invert)?"asc":"desc"};
  s.view=chooseView(s.query,env,s.view.intent);
  if(primary&&s.view.y&&s.view.representation!=="table") s.view.y=[primary];
  return s;
}

/* ── seeded demo executor ───────────────────────────────────────────────── */
function hash(str){let h=2166136261;for(const c of str){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0)/4294967295;}
function baseVal(metric, member, scale){
  const r=hash(metric+"|"+member);
  const bases={spend:9e5,sales:32e5,revenue:28e5,total_sales:42e5,orders:2400,purchases:1900,clicks:52000,views:8.6e5,impressions:2.1e6,sessions:96000,atc:9000,checkouts:4200};
  if(metric in bases) return bases[metric]*(0.25+r)*scale;
  if(metric==="roas") return 2.2+3.4*r; if(metric==="roi") return 1.8+3.8*r;
  if(metric==="acos") return 14+26*r; if(metric==="ctr") return .3+.9*r;
  if(metric==="cvr") return 4+9*r; if(metric==="cpc") return 6+22*r;
  return 100*r;
}
function execQuery(query){
  const task=query.task, whereKey=(task.where||[]).map(w=>w.dimension+"="+w.value).join("&");
  const scale=(task.where||[]).length?0.42:1;
  const grain=(task.dimensions||[]).find(d=>GRAINS.includes(d));
  const cats=(task.dimensions||[]).filter(d=>!GRAINS.includes(d));
  const days=task.time_range&&task.time_range.unit==="month"?task.time_range.value*30:(task.time_range&&task.time_range.value)||30;
  const rows=[];
  const catMembers=cats.length?MEMBERS[cats[0]]||["A","B","C"]:[null];
  const cat2=cats[1]?MEMBERS[cats[1]]||["X","Y"]:null;
  for(const m of catMembers){
    const seedM=(m||"all")+"|"+whereKey;
    if(cat2){ for(const m2 of cat2){ const row={[cats[0]]:m,[cats[1]]:m2};
        for(const k of task.metrics) row[k]=baseVal(k,seedM+"|"+m2,scale);
        rows.push(row);} continue; }
    if(grain){ const n=grain==="date"?Math.min(days,60):grain==="week"?Math.ceil(days/7):Math.ceil(days/30);
      for(let t=0;t<n;t++){ const row={[grain]:label(grain,t,n)}; if(m) row[cats[0]]=m;
        for(const k of task.metrics){ const b=baseVal(k,seedM,scale)/(NON_ADDITIVE.has(k)?1:n);
          const wave=1+0.18*Math.sin((t/(grain==="date"?7:4))*Math.PI*2)+0.25*(hash(seedM+k+t)-0.5)+(0.25*t/n);
          row[k]=b*wave; if(task.comparison) row[k+"__prev"]=b*wave*(0.84+0.1*hash(k+t));}
        rows.push(row);} continue; }
    const row=m?{[cats[0]]:m}:{};
    for(const k of task.metrics){ row[k]=baseVal(k,seedM,scale); if(task.comparison) row[k+"__prev"]=row[k]*(0.85+0.22*hash(k+seedM)); }
    rows.push(row);
  }
  if(task.sort){ const {metric,direction}=task.sort; rows.sort((a,b)=>direction==="asc"?a[metric]-b[metric]:b[metric]-a[metric]); }
  return task.limit?rows.slice(0,task.limit):rows;
}
function label(grain,t,n){ const now=new Date("2026-09-10"); const d=new Date(now);
  if(grain==="date"){d.setDate(d.getDate()-(n-1-t));return `${d.getDate()}/${d.getMonth()+1}`;}
  if(grain==="week"){d.setDate(d.getDate()-7*(n-1-t));return `wk ${d.getDate()}/${d.getMonth()+1}`;}
  d.setMonth(d.getMonth()-(n-1-t));return d.toLocaleString("en",{month:"short"});}

/* ── formatting (guidelines/numbers.html: ₹ K/L/Cr, one decimal, tnum) ───── */
function fmt(v,unit){ if(v==null||isNaN(v))return "—";
  if(unit==="pct")return v.toFixed(1)+"%"; if(unit==="x")return v.toFixed(1)+"×";
  const inr=unit==="inr"; const a=Math.abs(v);
  const s=a>=1e7?(v/1e7).toFixed(1)+" Cr":a>=1e5?(v/1e5).toFixed(1)+" L":a>=1e3?(v/1e3).toFixed(1)+"K":Math.round(v).toLocaleString("en-IN");
  return inr?"₹"+s:s; }
const esc=t=>String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;");

/* ── renderers ──────────────────────────────────────────────────────────── */
const W=760;
let TREND=null; // geometry for the crosshair hover, set by the line renderer
function renderChart(spec,rows){
  const v=spec.view, unit=k=>(FACTS[k]||{}).unit||"num";
  TREND=null;
  if(v.representation==="kpi"){
    return `<div class="kpis">`+v.y.map(k=>{ const r=rows[0]||{}; const cur=r[k],prev=r[k+"__prev"];
      const d=prev?((cur-prev)/prev)*100:null; const inv=(FACTS[k]||{}).invert;
      const good=d!=null&&((d>=0)!==!!inv);
      return `<div class="kpi markkpi" data-k="${k}" title="click for the trend"><div class="lab">${esc((FACTS[k]||{}).label||k)}</div><div class="v num">${fmt(cur,unit(k))}</div>${d!=null?`<div class="d ${good?"up":"down"}">${d>=0?"+":"−"}${Math.abs(d).toFixed(1)}% vs prev</div>`:""}</div>`;}).join("")+`</div>`;
  }
  if(v.representation==="line"){
    const H=260, pad=52;
    const xs=[...new Set(rows.map(r=>r[v.x]))];
    const seriesDefs=[];
    if(v.series){ const sers=[...new Set(rows.map(r=>r[v.series]))];
      sers.forEach((m,i)=>seriesDefs.push({id:String(m),label:String(m),color:SERIES[i%8],member:m,
        data:xs.map(x=>{const r=rows.find(rr=>rr[v.x]===x&&rr[v.series]===m);return r?r[v.y[0]]:null;})}));}
    else { v.y.forEach((k,i)=>seriesDefs.push({id:k,label:(FACTS[k]||{}).label||k,color:SERIES[i%8],unit:unit(k),
        data:xs.map(x=>{const r=rows.find(rr=>rr[v.x]===x);return r?r[k]:null;})}));
      if(rows[0]&&rows[0][v.y[0]+"__prev"]!=null) seriesDefs.push({id:"__prev",label:"previous period",color:"var(--series-compare)",dashed:true,unit:unit(v.y[0]),
        data:xs.map(x=>{const r=rows.find(rr=>rr[v.x]===x);return r?r[v.y[0]+"__prev"]:null;})}); }
    let maxV=0; seriesDefs.forEach(s=>s.data.forEach(d=>{if(d!=null)maxV=Math.max(maxV,d);}));
    const px=i=>pad+i*(W-pad-16)/Math.max(xs.length-1,1), py=val=>H-30-(val/maxV)*(H-60);
    TREND={xs,seriesDefs,px,py,pad,H,defaultUnit:unit(v.y[0])};
    let out=`<svg class="trend" viewBox="0 0 ${W} ${H}" width="100%">`;
    for(let g=0;g<=3;g++){const y=py(maxV*g/3);out+=`<line x1="${pad}" x2="${W-16}" y1="${y}" y2="${y}" stroke="var(--rule-grid)"/><text x="${pad-8}" y="${y+3}" text-anchor="end">${fmt(maxV*g/3,unit(v.y[0]))}</text>`;}
    seriesDefs.forEach(s=>{
      out+=`<path class="tline${s.member!==undefined?" markline":""}" data-sid="${esc(s.id)}" data-s="${s.member!==undefined?esc(s.member):""}" data-color="${s.color}" fill="none" stroke="${s.color}" stroke-width="${s.dashed?1.5:2}" ${s.dashed?'stroke-dasharray="4 4"':""} stroke-linejoin="round" stroke-linecap="round" style="${s.member!==undefined?"cursor:pointer;":""}transition:stroke 120ms" d="${s.data.map((d,i)=>d==null?"":(i&&s.data[i-1]!=null?"L":"M")+px(i).toFixed(1)+","+py(d).toFixed(1)).join("")}"/>`;});
    if(!v.series){ const s0=seriesDefs[0];
      s0.data.forEach((d,i)=>{ if(d==null)return; out+=`<circle class="markpt" cx="${px(i)}" cy="${py(d)}" r="7" fill="transparent" style="cursor:pointer"/>`; }); }
    xs.forEach((x,i)=>{ const st=Math.ceil(xs.length/8); if(xs.length<=8||i===xs.length-1||(i%st===0&&xs.length-1-i>=st/2)) out+=`<text x="${px(i)}" y="${H-8}" text-anchor="${i===0?"start":i===xs.length-1?"end":"middle"}">${esc(x)}</text>`;});
    out+=`<line id="xhair" x1="0" x2="0" y1="12" y2="${H-30}" stroke="var(--chart-crosshair)" stroke-width="1" stroke-dasharray="2 3" style="display:none"/>`;
    out+=`<circle id="xpt" r="4.5" fill="var(--surface-card)" stroke-width="2" style="display:none;pointer-events:none"/>`;
    out+="</svg>";
    out+=`<div class="tooltip" id="tip"><div class="tl" id="tipDate"></div><div style="display:flex;gap:8px;align-items:baseline"><span id="tipLabel" style="color:var(--ink-300)"></span><strong class="num" id="tipVal" style="font-weight:600;font-size:13px"></strong></div></div>`;
    out+=`<div class="legend">${seriesDefs.map(s=>`<span><span style="width:14px;border-top:${s.dashed?"1.5px dashed":"2px solid"} ${s.color};display:inline-block"></span>${esc(s.label)}</span>`).join("")}</div>`;
    out+=`<div class="note">${v.series?"hover for values · click a line to drill into that "+esc((DIMS[v.series]||{}).label||v.series).toLowerCase():"hover for values · click a point to break the trend out by "+esc((DIMS[breakoutDim(spec)]||{}).label||"dimension").toLowerCase()}</div>`;
    return out;
  }
  if(v.representation==="bars_v"){
    const k=v.y[0],H=280,pad=52,total=rows.reduce((a,r)=>a+(r[k]||0),0);
    const bw=Math.min(90,(W-pad-20)/rows.length-24); let maxV=Math.max(...rows.map(r=>r[k]||0));
    let out=`<svg class="barsv" viewBox="0 0 ${W} ${H}" width="100%">`;
    for(let g=0;g<=3;g++){const y=H-50-(g/3)*(H-100);out+=`<line x1="${pad}" x2="${W-16}" y1="${y}" y2="${y}" stroke="var(--rule-grid)"/><text x="${pad-8}" y="${y+3}" text-anchor="end">${fmt(maxV*g/3,unit(k))}</text>`;}
    rows.forEach((r,i)=>{ const x=pad+20+i*((W-pad-30)/rows.length), h=((r[k]||0)/maxV)*(H-100), y=H-50-h;
      out+=`<rect class="mark" data-i="${i}" x="${x}" y="${y}" width="${bw}" height="${h}" rx="1" fill="var(--series-1)" style="cursor:pointer"><title>${esc(r[v.x])}: ${fmt(r[k],unit(k))} — click to drill</title></rect>`;
      out+=`<text class="hoverval val" x="${x+bw/2}" y="${y-6}" text-anchor="middle">${fmt(r[k],unit(k))}</text>`;
      if(v.share) out+=`<text x="${x+bw/2}" y="${H-20}" text-anchor="middle">${(100*(r[k]||0)/total).toFixed(0)}% of total</text>`;
      out+=`<text x="${x+bw/2}" y="${H-34}" text-anchor="middle" class="val">${esc(r[v.x])}</text>`;});
    return out+`</svg><div class="note">hover for values · click a bar to drill ${drillHint(spec)}</div>`;
  }
  if(v.representation==="bars_h"){
    const k=v.y[0],rh=30,H=rows.length*rh+16,lw=230;
    const maxV=Math.max(...rows.map(r=>r[k]||0));
    let out=`<svg class="barsh" viewBox="0 0 ${W} ${H}" width="100%">`;
    rows.forEach((r,i)=>{ const y=8+i*rh,w=((r[k]||0)/maxV)*(W-lw-120);
      out+=`<text x="${lw-8}" y="${y+13}" text-anchor="end" class="val">${esc(String(r[v.x]).slice(0,32))}</text>`;
      out+=`<rect x="${lw}" y="${y}" width="${W-lw-120}" height="${rh-11}" rx="1" fill="var(--bar-track)"/>`;
      out+=`<rect class="mark" data-i="${i}" x="${lw}" y="${y}" width="${w}" height="${rh-11}" rx="1" fill="var(--series-1)" style="cursor:pointer"><title>${esc(r[v.x])} — click to drill</title></rect>`;
      out+=`<text x="${lw+(W-lw-120)+8}" y="${y+13}">${fmt(r[k],unit(k))}${spec.query.task.metrics[1]?` · ${esc((FACTS[spec.query.task.metrics[1]]||{}).label||"")} ${fmt(r[spec.query.task.metrics[1]],unit(spec.query.task.metrics[1]))}`:""}</text>`;});
    return out+`</svg><div class="note">ranked by ${esc(((FACTS[k]||{}).label||k)).toLowerCase()}, top ${rows.length}${drillHint(spec)?" · click a bar to drill "+drillHint(spec):""}</div>`;
  }
  if(v.representation==="heatmap"){
    const k=v.y[0], xs=[...new Set(rows.map(r=>r[v.x]))], ys=[...new Set(rows.map(r=>r[v.series]))];
    const vals=rows.map(r=>r[k]); const mn=Math.min(...vals),mx=Math.max(...vals);
    const cw=Math.min(130,(W-190)/xs.length), ch=36, H=ys.length*ch+50;
    const inv=(FACTS[k]||{}).invert;
    let out=`<svg viewBox="0 0 ${W} ${H}" width="100%">`;
    xs.forEach((x,i)=>out+=`<text x="${180+i*cw+cw/2}" y="14" text-anchor="middle">${esc(x)}</text>`);
    ys.forEach((yv,j)=>{ out+=`<text x="${172}" y="${28+j*ch+ch/2+4}" text-anchor="end" class="val">${esc(yv)}</text>`;
      xs.forEach((x,i)=>{ const r=rows.find(rr=>rr[v.x]===x&&rr[v.series]===yv); if(!r)return;
        let t=(r[k]-mn)/((mx-mn)||1); if(inv) t=1-t;
        const step=Math.min(4,Math.floor(t*5)); const light=step>=3;
        out+=`<rect class="markcell" data-x="${esc(x)}" data-y="${esc(yv)}" x="${180+i*cw}" y="${28+j*ch}" width="${cw-4}" height="${ch-4}" rx="1" fill="${HEAT[step]}" style="cursor:pointer"><title>click to drill into ${esc(x)} × ${esc(yv)}</title></rect><text pointer-events="none" x="${180+i*cw+cw/2-2}" y="${28+j*ch+ch/2+2}" text-anchor="middle" fill="${light?"var(--surface-card)":"var(--ink-900)"}">${fmt(r[k],unit(k))}</text>`;});});
    return out+`</svg><div class="note">5-step scale, ${inv?"darker = better (lower)":"darker = higher"} · click a cell to drill into that slice</div>`;
  }
  if(v.representation==="marimekko"){
    const k=v.y[0], xs=[...new Set(rows.map(r=>r[v.x]))], H=340;
    const colTotal=x=>rows.filter(r=>r[v.x]===x).reduce((a,r)=>a+r[k],0);
    const grand=xs.reduce((a,x)=>a+colTotal(x),0);
    let out=`<svg viewBox="0 0 ${W} ${H}" width="100%">`, cx=16;
    xs.forEach(x=>{ const cwd=(colTotal(x)/grand)*(W-40); let cy=10;
      rows.filter(r=>r[v.x]===x).forEach((r,j)=>{ const h=(r[k]/colTotal(x))*(H-84);
        out+=`<rect class="markcell" data-x="${esc(x)}" data-y="${esc(r[v.series])}" x="${cx}" y="${cy}" width="${Math.max(cwd-3,2)}" height="${Math.max(h-2,1)}" fill="${SERIES[j%8]}" style="cursor:pointer"><title>${esc(x)} × ${esc(r[v.series])}: ${fmt(r[k],unit(k))} — click to drill</title></rect>`;
        if(h>20&&cwd>64) out+=`<text pointer-events="none" x="${cx+6}" y="${cy+15}" fill="${j%8===2?"var(--ink-900)":"var(--surface-card)"}">${esc(r[v.series])} ${(100*r[k]/colTotal(x)).toFixed(0)}%</text>`;
        cy+=h;});
      out+=`<text x="${cx+cwd/2}" y="${H-52}" text-anchor="middle" class="val">${esc(x)}</text><text x="${cx+cwd/2}" y="${H-38}" text-anchor="middle">${(100*colTotal(x)/grand).toFixed(0)}% · ${fmt(colTotal(x),unit(k))}</text>`;
      cx+=cwd;});
    return out+`</svg><div class="note">width = share of ${esc(((FACTS[k]||{}).label||k)).toLowerCase()} · height = share within column · click a block to drill</div>`;
  }
  if(v.representation==="cohort_matrix"){
    const cohorts=MEMBERS.first_order_month, n=cohorts.length;
    let out=`<table><tr><th>Cohort</th>`; for(let m=0;m<n;m++) out+=`<th>M${m}</th>`; out+="</tr>";
    cohorts.forEach((c,ci)=>{ out+=`<tr><td>${esc(c)}</td>`;
      for(let m=0;m<n;m++){ if(ci+m>=n){out+="<td></td>";continue;}
        const val=m===0?100:Math.max(4,100*Math.pow(0.55+0.2*hash(c),m)*(0.9+0.2*hash(c+m)));
        const step=Math.min(4,Math.floor(val/100*5));
        out+=`<td class="num" style="background:${m===0?"var(--surface-card)":HEAT[step]};color:${step>=3?"var(--surface-card)":"var(--ink-700)"}">${val.toFixed(0)}%</td>`;}
      out+="</tr>";});
    return out+`</table><div class="note">retention of first-order cohorts — % still ordering m months later; values always printed</div>`;
  }
  if(v.representation==="sankey"){
    const stages=MEMBERS.funnel_stage; const vals=[96000,41000,9000,4200,1900]; const H=300;
    const sw=(W-160)/(stages.length-1); let out=`<svg viewBox="0 0 ${W} ${H}" width="100%">`;
    stages.forEach((s,i)=>{ const h=(vals[i]/vals[0])*(H-80), y=(H-60-h)/2+10, x=60+i*sw;
      out+=`<rect x="${x}" y="${y}" width="14" height="${h}" fill="var(--series-1)" rx="1"/>`;
      if(i<stages.length-1){ const h2=(vals[i+1]/vals[0])*(H-80), y2=(H-60-h2)/2+10, x2=60+(i+1)*sw;
        out+=`<path d="M${x+14},${y} C${x+sw/2},${y} ${x2-sw/2},${y2} ${x2},${y2} L${x2},${y2+h2} C${x2-sw/2},${y2+h2} ${x+sw/2},${y+h} ${x+14},${y+h} Z" fill="var(--series-1)" opacity="0.16"/>`;
        out+=`<text x="${x+sw/2+7}" y="${Math.min(y,y2)-8}" text-anchor="middle">${(100*vals[i+1]/vals[i]).toFixed(0)}% →</text>`;}
      out+=`<text x="${x+7}" y="${y+h+16}" text-anchor="middle">${esc(s)}</text><text x="${x+7}" y="${y+h+30}" text-anchor="middle" class="val num">${fmt(vals[i],"num")}</text>`;});
    return out+`</svg><div class="note">flow between funnel stages · ribbon = carry-through · label = stage-to-stage rate</div>`;
  }
  // table (DataTable spec: sunken sticky header, hover rows, numerics right, first col left)
  const dims=Object.keys(rows[0]||{}).filter(c=>!c.endsWith("__prev")&&!(c in FACTS));
  const mets=Object.keys(rows[0]||{}).filter(c=>c in FACTS);
  let out="<table><tr>"+dims.concat(mets).map(c=>`<th>${esc((FACTS[c]||{}).label||(DIMS[c]||{}).label||c)}${v.sort&&v.sort.by===c?` <span style="color:var(--ink-400)">${v.sort.direction==="asc"?"↑":"↓"}</span>`:""}</th>`).join("")+"</tr>";
  rows.forEach((r,i)=>{ out+=`<tr class="click mark num" data-i="${i}" title="click to drill">`+dims.concat(mets).map(c=>`<td>${typeof r[c]==="number"?fmt(r[c],unit(c)):esc(r[c])}</td>`).join("")+"</tr>";});
  return out+`</table><div class="note">exact values, ${rows.length} rows · click a row to drill ${drillHint(spec)}</div>`;
}
function breakoutDim(spec){
  const used=new Set((spec.query.task.dimensions||[]));
  const c=spec.envelope.dims.find(d=>d.cardinality==="low"&&!used.has(d.key))||spec.envelope.dims.find(d=>!used.has(d.key));
  return c?c.key:null;
}
function drillTarget(spec, dimKeys){
  const used=new Set((spec.query.task.where||[]).map(w=>w.dimension).concat(dimKeys));
  const prefer=["advertised_asin","fsn","product","keyword","campaign","ad_set","creative","search_term"];
  for(const dk of dimKeys){ const d=spec.envelope.dims.find(x=>x.key===dk); if(!d) continue;
    const cands=d.drill_to.filter(t=>!used.has(t));
    for(const p of prefer) if(cands.includes(p)) return p;
    if(cands.length) return cands[0]; }
  return null;
}
function drillHint(spec){ const v=spec.view; const d=spec.envelope.dims.find(x=>x.key===v.x);
  return d&&d.drill_to.length?`→ ${d.drill_to.map(k=>DIMS[k].label.toLowerCase()).join(" / ")}`:""; }

/* ── UI shell ───────────────────────────────────────────────────────────── */
let SPEC=null;
const $=s=>document.querySelector(s);
function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600);}
function wireTrendHover(el){
  if(!TREND) return;
  const svg=el.querySelector("svg.trend"); if(!svg) return;
  const tip=el.querySelector("#tip"), xh=svg.querySelector("#xhair"), xp=svg.querySelector("#xpt");
  const body=el.querySelector(".body");
  svg.addEventListener("mousemove",e=>{
    const r=svg.getBoundingClientRect();
    const vx=(e.clientX-r.left)*(W/r.width), vy=(e.clientY-r.top)*(TREND.H/r.height);
    if(vx<TREND.pad||vx>W-16){tip.style.display="none";xh.style.display="none";xp.style.display="none";return;}
    const i=Math.max(0,Math.min(TREND.xs.length-1,Math.round((vx-TREND.pad)/((W-TREND.pad-16)/Math.max(TREND.xs.length-1,1)))));
    let best=null,bd=1e9;
    TREND.seriesDefs.forEach(s=>{const d=s.data[i]; if(d==null)return; const dy=Math.abs(TREND.py(d)-vy); if(dy<bd){bd=dy;best=s;}});
    if(!best){tip.style.display="none";return;}
    const cx=TREND.px(i), cy=TREND.py(best.data[i]);
    xh.setAttribute("x1",cx); xh.setAttribute("x2",cx); xh.style.display="";
    xp.setAttribute("cx",cx); xp.setAttribute("cy",cy); xp.style.stroke=best.color.startsWith("var")?getComputedStyle(document.documentElement).getPropertyValue(best.color.slice(4,-1)):best.color; xp.style.display="";
    svg.querySelectorAll(".tline").forEach(p=>{p.style.stroke=(p.dataset.sid===best.id)?p.dataset.color:"var(--series-dim)";});
    tip.querySelector("#tipDate").textContent=TREND.xs[i];
    tip.querySelector("#tipLabel").textContent=best.label;
    tip.querySelector("#tipVal").textContent=fmt(best.data[i],best.unit||TREND.defaultUnit);
    const br=body.getBoundingClientRect();
    tip.style.left=Math.min(e.clientX-br.left+14,br.width-180)+"px";
    tip.style.top=Math.max(0,e.clientY-br.top-48)+"px";
    tip.style.display="block";
  });
  svg.addEventListener("mouseleave",()=>{tip.style.display="none";xh.style.display="none";xp.style.display="none";
    svg.querySelectorAll(".tline").forEach(p=>p.style.stroke=p.dataset.color);});
}
function render(){
  const spec=SPEC, v=spec.view, task=spec.query.task, rows=execQuery(spec.query);
  const el=$("#chartCard");
  const dimOpts=spec.envelope.dims.map(d=>`<option value="${d.key}" ${task.dimensions&&task.dimensions.includes(d.key)?"selected":""}>${esc(d.label)}</option>`).join("");
  const factOpts=spec.envelope.facts.map(f=>`<option value="${f.key}" ${v.y[0]===f.key?"selected":""}>${esc(f.label)}</option>`).join("");
  const grain=(task.dimensions||[]).find(d=>GRAINS.includes(d));
  el.innerHTML=`
    <div class="card-h"><div class="t">${esc(spec.title||"")}</div><div class="q">${esc(v.intent)} · ${esc(v.representation)} · ${esc(spec.envelope.platform)} · ${esc(spec.envelope.source)}</div></div>
    <div class="controls">
      ${["kpi","cohort_matrix","sankey"].includes(v.representation)?"":`<label>fact</label><select id="factSel">${factOpts}</select>`}
      ${["kpi","line","cohort_matrix","sankey"].includes(v.representation)?"":`<label>dim</label><select id="dimSel">${dimOpts}</select>`}
      ${grain?`<span class="seg">${GRAINS.map(g=>`<button data-g="${g}" class="${grain===g?"on":""}">${g[0].toUpperCase()}</button>`).join("")}</span>`:""}
      <span class="seg">${["7d","30d","90d"].map(p=>`<button data-p="${p}" class="${task.time_range&&task.time_range.value===parseInt(p)?"on":""}">${p}</button>`).join("")}</span>
      <button id="cmp" class="${task.comparison?"on":""}">Compare</button>
      <button id="pin" style="display:inline-flex;align-items:center">${ICON_PIN}Pin</button>
    </div>
    <div class="crumbs">${(task.where||[]).length?"drilled: ":"no drills — click marks to drill"}${(task.where||[]).map((w,i)=>`<span class="crumb" data-w="${i}" title="remove">${esc((DIMS[w.dimension]||{}).label||w.dimension)} = ${esc(w.value)} ✕</span>`).join("")}</div>
    <div class="body">${renderChart(spec,rows)}</div>
    <div class="foot"><span>data as of 2026-09-10 06:30 ist · last 2 days provisional</span><span>demo data, seeded</span></div>`;
  $("#specView").textContent=JSON.stringify({...spec},null,1);
  wireTrendHover(el);
  el.querySelectorAll(".markkpi").forEach(t=>t.addEventListener("click",()=>{
    const k=t.dataset.k, s=JSON.parse(JSON.stringify(spec));
    s.query.task.dimensions=["date"]; s.query.task.comparison={metric:k,baseline:"previous_period"};
    s.view={intent:"trend",representation:"line",x:"date",y:[k],compare:true};
    s.title=(FACTS[k]||{}).label+" — trend"; SPEC=s; render(); toast(`expanded ${FACTS[k].label} → its trend (same query, +date grain)`);
  }));
  el.querySelectorAll(".markline").forEach(t=>t.addEventListener("click",()=>{
    const member=t.dataset.s; if(!member) return;
    const to=drillTarget(spec,[v.series]); if(!to){toast("edge of the envelope — no drill from "+v.series);return;}
    try{SPEC=applyI(spec,{type:"drill",on_dim:v.series,value:member,to});
      SPEC.title=`${DIMS[to].label} within ${member}`; render(); toast(`drilled: where ${v.series} = ${member}`);}catch(e){toast(e.message);}
  }));
  el.querySelectorAll(".markpt").forEach(t=>t.addEventListener("click",()=>{
    const bo=breakoutDim(spec); if(!bo){toast("nothing to break out by in this envelope");return;}
    const s=JSON.parse(JSON.stringify(spec));
    s.query.task.dimensions=(s.query.task.dimensions||[]).concat([bo]); delete s.query.task.comparison;
    s.view=chooseView(s.query,s.envelope,"trend"); s.title=(spec.title||"")+" — by "+DIMS[bo].label;
    SPEC=s; render(); toast(`broken out by ${DIMS[bo].label} — one line per member`);
  }));
  el.querySelectorAll(".markcell").forEach(t=>t.addEventListener("click",()=>{
    const to=drillTarget(spec,[v.x,v.series]); if(!to){toast("edge of the envelope — no drill from this cell");return;}
    try{SPEC=applyI(spec,{type:"drill",filters:[{dim:v.x,value:t.dataset.x},{dim:v.series,value:t.dataset.y}],to});
      SPEC.title=`${DIMS[to].label} within ${t.dataset.x} × ${t.dataset.y}`; render();
      toast(`drilled: where ${v.x} = ${t.dataset.x} AND ${v.series} = ${t.dataset.y}`);}catch(e){toast(e.message);}
  }));
  el.querySelectorAll(".mark").forEach(m=>m.addEventListener("click",()=>{
    const r=rows[parseInt(m.dataset.i)], d=spec.envelope.dims.find(x=>x.key===v.x);
    if(!d||!d.drill_to.length){toast("no drill from this dim (edge of the envelope)");return;}
    try{ const to=drillTarget(spec,[v.x])||d.drill_to[0];
      SPEC=applyI(spec,{type:"drill",on_dim:v.x,value:r[v.x],to});
      SPEC.title=`${DIMS[SPEC.query.task.dimensions.filter(x=>!GRAINS.includes(x))[0]].label} within ${r[v.x]}`;
      render(); toast(`drilled: where ${v.x} = ${r[v.x]}`);}catch(e){toast(e.message);}
  }));
  const f=$("#factSel"); if(f) f.addEventListener("change",e=>{SPEC=applyI(spec,{type:"pivot_fact",to:e.target.value});render();});
  const dsel=$("#dimSel"); if(dsel) dsel.addEventListener("change",e=>{SPEC=applyI(spec,{type:"pivot_dim",to:e.target.value});render();});
  el.querySelectorAll("[data-g]").forEach(b=>b.addEventListener("click",()=>{SPEC=applyI(spec,{type:"regrain",to:b.dataset.g});render();}));
  el.querySelectorAll("[data-p]").forEach(b=>b.addEventListener("click",()=>{SPEC=applyI(spec,{type:"rerange",date_range:{type:"relative",value:parseInt(b.dataset.p),unit:"day"}});render();}));
  $("#cmp").addEventListener("click",()=>{SPEC=applyI(spec,{type:"toggle_compare"});render();});
  $("#pin").addEventListener("click",()=>toast("pinned → card-definition written to the cockpit library (prebuilt lifecycle) — this exact query + view state"));
  el.querySelectorAll(".crumb").forEach(c=>c.addEventListener("click",()=>{
    const s=JSON.parse(JSON.stringify(spec)); s.query.task.where.splice(parseInt(c.dataset.w),1);
    if(!s.query.task.where.length) delete s.query.task.where;
    SPEC=s; render(); toast("un-drilled (predicate removed)");}));
}
const sel=$("#prompt");
PROMPTS.forEach((p,i)=>{const o=document.createElement("option");o.value=i;o.textContent=p.label;sel.appendChild(o);});
$("#run").addEventListener("click",()=>{SPEC=derive(PROMPTS[parseInt(sel.value)]);render();});
sel.value="2";
SPEC=derive(PROMPTS[2]); render();
