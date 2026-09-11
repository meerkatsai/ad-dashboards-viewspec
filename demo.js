/* View-spec living chart demo.
   JS port of generator/derive.py (derive + apply) over seeded demo data.
   The chart is a pivot surface CONTAINED to its envelope; every gesture
   rewrites the query deterministically and re-renders. No LLM. */
"use strict";

const GRAINS = ["date", "week", "month"];
const NON_ADDITIVE = new Set(["roas","roi","direct_roi","indirect_roi","acos","ctr","cvr","cpc","avg_cpc","cpm","cpi","aov","reach","frequency","conv_rate","cost_per_conv","conv_value_per_cost","mer","spend_share"]);
const FACTS = { // canonical keys -> label/unit (subset of the catalog, demo scope)
  spend:{label:"Spend",unit:"inr"}, sales:{label:"Sales",unit:"inr"}, revenue:{label:"Revenue",unit:"inr"},
  orders:{label:"Orders",unit:"num"}, clicks:{label:"Clicks",unit:"num"}, views:{label:"Views",unit:"num"},
  impressions:{label:"Impressions",unit:"num"}, roas:{label:"ROAS",unit:"x"}, roi:{label:"ROI",unit:"x"},
  acos:{label:"ACOS",unit:"pct",invert:true}, ctr:{label:"CTR",unit:"pct"}, cvr:{label:"CVR",unit:"pct"},
  cpc:{label:"CPC",unit:"inr",invert:true}, purchases:{label:"Purchases",unit:"num"},
  total_sales:{label:"Total sales",unit:"inr"}, spend_share:{label:"Spend share",unit:"pct"},
  sessions:{label:"Sessions",unit:"num"}, atc:{label:"ATC",unit:"num"}, checkouts:{label:"Checkouts",unit:"num"}
};
const MEMBERS = { // demo dimension members
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
const DIMS = { // drill graph (subset of rules/drill-graph.json, demo scope)
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

/* ── canned prompts: what the router WOULD emit ─────────────────────────── */
const PROMPTS = [
  {label:'"Spend allocation across placements" (Amazon)', platform:"amazon", intent:"composition",
   title:"Spend allocation across placements",
   task:{entity:"campaign",metrics:["spend","roas"],dimensions:["placement"],time_range:{type:"relative",value:30,unit:"day"}}},
  {label:'"Which products are eating spend?" (Amazon)', platform:"amazon", intent:"comparison",
   title:"Products by spend",
   task:{entity:"campaign",metrics:["spend","roas","acos"],dimensions:["advertised_asin"],time_range:{type:"relative",value:30,unit:"day"},sort:{metric:"spend",direction:"desc"},limit:10}},
  {label:'"How is spend trending?" (Amazon)', platform:"amazon", intent:"trend",
   title:"Spend — daily trend",
   task:{entity:"account",metrics:["spend","sales"],dimensions:["date"],time_range:{type:"relative",value:30,unit:"day"},comparison:{metric:"spend",baseline:"previous_period"}}},
  {label:'"Account KPIs" (Amazon)', platform:"amazon", intent:"kpi",
   title:"Account KPIs",
   task:{entity:"account",metrics:["spend","sales","roas","acos"],time_range:{type:"relative",value:30,unit:"day"},comparison:{metric:"spend",baseline:"previous_period"}}},
  {label:'"Placement × match type efficiency" (Flipkart)', platform:"flipkart", intent:"comparison",
   title:"ROI — placement × match type",
   task:{entity:"campaign",metrics:["roi","spend"],dimensions:["placement","match_type"],time_range:{type:"relative",value:30,unit:"day"}}},
  {label:'"Spend share — placement × match type" (Flipkart)', platform:"flipkart", intent:"composition",
   title:"Spend share — placement × match type",
   task:{entity:"campaign",metrics:["spend"],dimensions:["placement","match_type"],time_range:{type:"relative",value:30,unit:"day"}}},
  {label:'"Repeat orders by first-order cohort" (Shopify)', platform:"shopify", intent:"cohort",
   title:"Repeat orders by first-order cohort",
   task:{entity:"store",metrics:["orders"],dimensions:["first_order_month","month"],time_range:{type:"relative",value:6,unit:"month"}}},
  {label:'"Where does the funnel leak?" (Shopify)', platform:"shopify", intent:"flow",
   title:"Funnel flow — sessions to purchase",
   task:{entity:"store",metrics:["sessions"],dimensions:["funnel_stage"],time_range:{type:"relative",value:30,unit:"day"}}}
];

/* ── derive (port of derive.py) ─────────────────────────────────────────── */
function envelopeFor(query, platform){
  const task = query.task;
  const qdims = (task.dimensions||[]).filter(d=>!GRAINS.includes(d));
  const keys=[], frontier=[...qdims];
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
  if(intent==="cohort") Object.assign(v,{representation:"cohort_matrix",x:cats[0]?cats[0].key:"first_order_month",series:"month",y:[primary]});
  else if(intent==="flow"&&cats.some(c=>c.kind==="stage")) Object.assign(v,{representation:"sankey",x:cats[0].key,series:cats[0].key,y:[primary]});
  else if(intent==="composition"&&cats.length===2&&fact(primary).additive) Object.assign(v,{representation:"marimekko",x:cats[0].key,series:cats[1].key,y:[primary]});
  else if(intent==="kpi"||(!cats.length&&!grain)) Object.assign(v,{representation:"kpi",y:env.facts.map(f=>f.key).slice(0,4),compare:true});
  else if(grain&&!cats.length) Object.assign(v,{representation:"line",x:grain,y:task.metrics.slice(0,2),compare:!!task.comparison});
  else if(grain&&cats.length===1&&cats[0].cardinality==="low") Object.assign(v,{representation:"line",x:grain,series:cats[0].key,y:[primary]});
  else if(cats.length===1&&cats[0].cardinality==="low"){Object.assign(v,{representation:"bars_v",x:cats[0].key,y:[primary]}); if(intent==="composition"&&fact(primary).additive) v.share=true;}
  else if(cats.length===1) Object.assign(v,{representation:"bars_h",x:cats[0].key,y:[primary],sort:{by:primary,direction:fact(primary).invert?"asc":"desc"},limit:10});
  else if(cats.length===2) Object.assign(v,{representation:"heatmap",x:cats[0].key,series:cats[1].key,y:[primary]});
  else Object.assign(v,{representation:"table",y:env.facts.map(f=>f.key),sort:{by:primary,direction:"desc"},limit:10});
  return v;
}
function derive(p){ const query={version:"1.0",task_type:"query",task:JSON.parse(JSON.stringify(p.task))};
  const env=envelopeFor(query,p.platform);
  return {version:"1.0",title:p.title,query,envelope:env,view:chooseView(query,env,p.intent),pin:{pinnable:true}};
}
/* apply (port of derive.py apply) */
function applyI(spec, i){
  const s=JSON.parse(JSON.stringify(spec)), task=s.query.task, env=s.envelope;
  const dimKeys=new Set(env.dims.map(d=>d.key)), factKeys=new Set(env.facts.map(f=>f.key));
  if(i.type==="drill"){
    const src=env.dims.find(d=>d.key===i.on_dim);
    if(!src||!src.drill_to.includes(i.to)) throw Error(`drill ${i.on_dim}→${i.to} outside envelope`);
    (task.where=task.where||[]).push({dimension:i.on_dim,operator:"eq",value:i.value});
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
  if(primary){ if(!task.sort) task.sort={metric:primary,direction:(FACTS[primary]&&FACTS[primary].invert)?"asc":"desc"}; }
  s.view=chooseView(s.query,env,s.view.intent);
  if(primary) s.view.y=[primary];
  return s;
}

/* ── seeded demo executor: query_task -> rows ───────────────────────────── */
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

/* ── formatting ─────────────────────────────────────────────────────────── */
function fmt(v,unit){ if(v==null||isNaN(v))return "—";
  if(unit==="pct")return v.toFixed(2)+"%"; if(unit==="x")return v.toFixed(1)+"×";
  const inr=unit==="inr"; const a=Math.abs(v);
  const s=a>=1e7?(v/1e7).toFixed(1)+" Cr":a>=1e5?(v/1e5).toFixed(1)+" L":a>=1e3?(v/1e3).toFixed(1)+" K":Math.round(v).toString();
  return inr?"₹"+s:s; }
const esc=t=>String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;");

/* ── renderers (inline SVG, design-system chrome) ───────────────────────── */
const W=760;
function renderChart(spec,rows){
  const v=spec.view, unit=k=>(FACTS[k]||{}).unit||"num";
  if(v.representation==="kpi"){
    return `<div class="kpis">`+v.y.map(k=>{ const r=rows[0]||{}; const cur=r[k],prev=r[k+"__prev"];
      const d=prev?((cur-prev)/prev)*100:null; const inv=(FACTS[k]||{}).invert;
      const good=d!=null&&((d>=0)!==!!inv);
      return `<div class="kpi"><div class="lab">${esc((FACTS[k]||{}).label||k)}</div><div class="v num">${fmt(cur,unit(k))}</div>${d!=null?`<div class="d ${good?"up":"down"}">${d>=0?"+":"−"}${Math.abs(d).toFixed(1)}% vs prev</div>`:""}</div>`;}).join("")+`</div>`;
  }
  if(v.representation==="line"){
    const k=v.y[0], H=260, pad=46, series=v.series?[...new Set(rows.map(r=>r[v.series]))]:[null];
    const xs=[...new Set(rows.map(r=>r[v.x]))]; const colors=["var(--blue)","var(--red)","var(--yellow)","var(--green)","var(--purple)"];
    let maxV=0; rows.forEach(r=>{maxV=Math.max(maxV,r[k]||0,r[k+"__prev"]||0)});
    const px=i=>pad+ i*(W-pad-10)/Math.max(xs.length-1,1), py=val=>H-30-(val/maxV)*(H-60);
    let out=`<svg viewBox="0 0 ${W} ${H}" width="100%">`;
    for(let g=0;g<=3;g++){const y=py(maxV*g/3);out+=`<line x1="${pad}" x2="${W-10}" y1="${y}" y2="${y}" stroke="var(--rule)"/><text x="${pad-6}" y="${y+3}" text-anchor="end">${fmt(maxV*g/3,unit(k))}</text>`;}
    series.forEach((s,si)=>{ const sr=s?rows.filter(r=>r[v.series]===s):rows;
      out+=`<path fill="none" stroke="${colors[si%5]}" stroke-width="2" d="${sr.map((r,i)=>`${i?"L":"M"}${px(xs.indexOf(r[v.x]))},${py(r[k])}`).join("")}"/>`;
      if(!s&&sr[0]&&sr[0][k+"__prev"]!=null) out+=`<path fill="none" stroke="var(--ink-300)" stroke-width="1.5" stroke-dasharray="4 3" d="${sr.map((r,i)=>`${i?"L":"M"}${px(i)},${py(r[k+"__prev"])}`).join("")}"/>`;
      if(s) out+=`<text x="${W-12}" y="${py(sr[sr.length-1][k])}" text-anchor="end" fill="${colors[si%5]}">${esc(s)}</text>`;});
    xs.forEach((x,i)=>{ if(i%Math.ceil(xs.length/8)===0) out+=`<text x="${px(i)}" y="${H-10}" text-anchor="middle">${esc(x)}</text>`;});
    return out+"</svg>";
  }
  if(v.representation==="bars_v"){
    const k=v.y[0],H=280,pad=46,total=rows.reduce((a,r)=>a+(r[k]||0),0);
    const bw=Math.min(90,(W-pad-20)/rows.length-24); let maxV=Math.max(...rows.map(r=>r[k]||0));
    let out=`<svg viewBox="0 0 ${W} ${H}" width="100%">`;
    for(let g=0;g<=3;g++){const y=H-50-(g/3)*(H-100);out+=`<line x1="${pad}" x2="${W-10}" y1="${y}" y2="${y}" stroke="var(--rule)"/><text x="${pad-6}" y="${y+3}" text-anchor="end">${fmt(maxV*g/3,unit(k))}</text>`;}
    rows.forEach((r,i)=>{ const x=pad+20+i*((W-pad-30)/rows.length), h=((r[k]||0)/maxV)*(H-100), y=H-50-h;
      out+=`<rect class="mark" data-i="${i}" x="${x}" y="${y}" width="${bw}" height="${h}" rx="1" fill="var(--blue)" style="cursor:pointer"/>`;
      out+=`<text class="val" x="${x+bw/2}" y="${y-16}" text-anchor="middle">${fmt(r[k],unit(k))}</text>`;
      if(v.share) out+=`<text x="${x+bw/2}" y="${y-4}" text-anchor="middle">${(100*(r[k]||0)/total).toFixed(0)}% of total</text>`;
      out+=`<text x="${x+bw/2}" y="${H-34}" text-anchor="middle">${esc(r[v.x])}</text>`;});
    return out+`</svg><div class="note">click a bar to drill ${drillHint(spec)}</div>`;
  }
  if(v.representation==="bars_h"){
    const k=v.y[0],rh=30,H=rows.length*rh+40,lw=230;
    const maxV=Math.max(...rows.map(r=>r[k]||0));
    let out=`<svg viewBox="0 0 ${W} ${H}" width="100%">`;
    rows.forEach((r,i)=>{ const y=16+i*rh,w=((r[k]||0)/maxV)*(W-lw-110);
      out+=`<text x="${lw-8}" y="${y+13}" text-anchor="end" class="val">${esc(String(r[v.x]).slice(0,32))}</text>`;
      out+=`<rect class="mark" data-i="${i}" x="${lw}" y="${y}" width="${w}" height="${rh-11}" rx="1" fill="var(--blue)" style="cursor:pointer"/>`;
      out+=`<text x="${lw+w+8}" y="${y+13}">${fmt(r[k],unit(k))}${spec.query.task.metrics[1]?`  ·  ${esc((FACTS[spec.query.task.metrics[1]]||{}).label||"")} ${fmt(r[spec.query.task.metrics[1]],unit(spec.query.task.metrics[1]))}`:""}</text>`;});
    return out+`</svg><div class="note">ranked by ${esc((FACTS[k]||{}).label||k)}, top ${rows.length}${drillHint(spec)?" · click a bar to drill "+drillHint(spec):""}</div>`;
  }
  if(v.representation==="heatmap"){
    const k=v.y[0], xs=[...new Set(rows.map(r=>r[v.x]))], ys=[...new Set(rows.map(r=>r[v.series]))];
    const vals=rows.map(r=>r[k]); const mn=Math.min(...vals),mx=Math.max(...vals);
    const cw=Math.min(120,(W-180)/xs.length), ch=34, H=ys.length*ch+70;
    const inv=(FACTS[k]||{}).invert;
    let out=`<svg viewBox="0 0 ${W} ${H}" width="100%">`;
    xs.forEach((x,i)=>out+=`<text x="${170+i*cw+cw/2}" y="14" text-anchor="middle">${esc(x)}</text>`);
    ys.forEach((yv,j)=>{ out+=`<text x="162" y="${40+j*ch+ch/2}" text-anchor="end" class="val">${esc(yv)}</text>`;
      xs.forEach((x,i)=>{ const r=rows.find(rr=>rr[v.x]===x&&rr[v.series]===yv); if(!r)return;
        let t=(r[k]-mn)/((mx-mn)||1); if(inv) t=1-t;
        out+=`<rect x="${170+i*cw}" y="${28+j*ch}" width="${cw-4}" height="${ch-4}" rx="1" fill="rgba(37,99,235,${0.12+0.68*t})"/><text x="${170+i*cw+cw/2}" y="${28+j*ch+ch/2+4}" text-anchor="middle" fill="${t>0.6?"#fff":"var(--ink-700)"}">${fmt(r[k],unit(k))}</text>`;});});
    return out+"</svg>";
  }
  if(v.representation==="marimekko"){
    const k=v.y[0], xs=[...new Set(rows.map(r=>r[v.x]))], H=320;
    const colTotal=x=>rows.filter(r=>r[v.x]===x).reduce((a,r)=>a+r[k],0);
    const grand=xs.reduce((a,x)=>a+colTotal(x),0); const colors=["var(--blue)","var(--yellow)","var(--teal)","var(--purple)","var(--pink)"];
    let out=`<svg viewBox="0 0 ${W} ${H}" width="100%">`, cx=40;
    xs.forEach(x=>{ const cwd=(colTotal(x)/grand)*(W-90); let cy=24;
      rows.filter(r=>r[v.x]===x).forEach((r,j)=>{ const h=(r[k]/colTotal(x))*(H-90);
        out+=`<rect x="${cx}" y="${cy}" width="${Math.max(cwd-3,2)}" height="${Math.max(h-2,1)}" fill="${colors[j%5]}" opacity="0.85"/>`;
        if(h>18&&cwd>60) out+=`<text x="${cx+6}" y="${cy+14}" fill="#fff">${esc(r[v.series])} ${(100*r[k]/colTotal(x)).toFixed(0)}%</text>`;
        cy+=h;});
      out+=`<text x="${cx+cwd/2}" y="${H-42}" text-anchor="middle">${esc(x)}</text><text x="${cx+cwd/2}" y="${H-28}" text-anchor="middle">${(100*colTotal(x)/grand).toFixed(0)}% · ${fmt(colTotal(x),unit(k))}</text>`;
      cx+=cwd;});
    return out+`</svg><div class="note">width = share of ${esc((FACTS[k]||{}).label||k)} · height = share within column</div>`;
  }
  if(v.representation==="cohort_matrix"){
    const cohorts=MEMBERS.first_order_month, n=cohorts.length;
    let out=`<table><tr><th>Cohort</th>`; for(let m=0;m<n;m++) out+=`<th>M${m}</th>`; out+="</tr>";
    cohorts.forEach((c,ci)=>{ out+=`<tr><td>${esc(c)}</td>`;
      for(let m=0;m<n;m++){ if(ci+m>=n){out+="<td></td>";continue;}
        const val=m===0?100:Math.max(4,100*Math.pow(0.55+0.2*hash(c),m)*(0.9+0.2*hash(c+m)));
        out+=`<td style="background:rgba(37,99,235,${0.05+0.6*val/100})">${val.toFixed(0)}%</td>`;}
      out+="</tr>";});
    return out+`</table><div class="note">retention of first-order cohorts, % still ordering M months later (values printed — no color-only encoding)</div>`;
  }
  if(v.representation==="sankey"){
    const stages=MEMBERS.funnel_stage; const vals=[96000,41000,9000,4200,1900]; const H=300;
    const sw=(W-160)/(stages.length-1); let out=`<svg viewBox="0 0 ${W} ${H}" width="100%">`;
    stages.forEach((s,i)=>{ const h=(vals[i]/vals[0])*(H-80), y=(H-60-h)/2+10, x=60+i*sw;
      out+=`<rect x="${x}" y="${y}" width="14" height="${h}" fill="var(--blue)"/>`;
      if(i<stages.length-1){ const h2=(vals[i+1]/vals[0])*(H-80), y2=(H-60-h2)/2+10, x2=60+(i+1)*sw;
        out+=`<path d="M${x+14},${y} C${x+sw/2},${y} ${x2-sw/2},${y2} ${x2},${y2} L${x2},${y2+h2} C${x2-sw/2},${y2+h2} ${x+sw/2},${y+h} ${x+14},${y+h} Z" fill="var(--blue)" opacity="0.18"/>`;
        out+=`<text x="${x+sw/2+7}" y="${Math.min(y,y2)-6}" text-anchor="middle">${(100*vals[i+1]/vals[i]).toFixed(0)}% →</text>`;}
      out+=`<text x="${x+7}" y="${y+h+16}" text-anchor="middle">${esc(s)}</text><text x="${x+7}" y="${y+h+30}" text-anchor="middle" class="val">${fmt(vals[i],"num")}</text>`;});
    return out+`</svg><div class="note">flow between funnel stages; ribbon = carry-through, label = stage-to-stage rate</div>`;
  }
  // table
  const cols=Object.keys(rows[0]||{}).filter(c=>!c.endsWith("__prev"));
  let out="<table><tr>"+cols.map(c=>`<th>${esc((FACTS[c]||{}).label||(DIMS[c]||{}).label||c)}</th>`).join("")+"</tr>";
  rows.forEach((r,i)=>{ out+=`<tr class="click mark" data-i="${i}">`+cols.map(c=>`<td>${typeof r[c]==="number"?fmt(r[c],unit(c)):esc(r[c])}</td>`).join("")+"</tr>";});
  return out+"</table>";
}
function drillHint(spec){ const v=spec.view; const d=spec.envelope.dims.find(x=>x.key===v.x);
  return d&&d.drill_to.length?`→ ${d.drill_to.map(k=>DIMS[k].label).join(" / ")}`:""; }

/* ── UI shell ───────────────────────────────────────────────────────────── */
let SPEC=null;
const $=s=>document.querySelector(s);
function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600);}
function render(){
  const spec=SPEC, v=spec.view, task=spec.query.task, rows=execQuery(spec.query);
  const el=$("#chartCard");
  const dimOpts=spec.envelope.dims.map(d=>`<option value="${d.key}" ${task.dimensions&&task.dimensions.includes(d.key)?"selected":""}>${esc(d.label)}</option>`).join("");
  const factOpts=spec.envelope.facts.map(f=>`<option value="${f.key}" ${v.y[0]===f.key?"selected":""}>${esc(f.label)}</option>`).join("");
  const grain=(task.dimensions||[]).find(d=>GRAINS.includes(d));
  el.innerHTML=`
    <div class="card-h"><div class="t">${esc(spec.title||"")}</div><div class="q">${esc(v.intent)} · ${esc(v.representation)} · ${esc(spec.envelope.platform)} · ${esc(spec.envelope.source)}</div></div>
    <div class="controls">
      ${["kpi","cohort_matrix","sankey"].includes(v.representation)?"":`<label style="font-size:11px;color:var(--ink-500)">fact</label><select id="factSel">${factOpts}</select>`}
      ${["kpi","line","cohort_matrix","sankey"].includes(v.representation)?"":`<label style="font-size:11px;color:var(--ink-500)">dim</label><select id="dimSel">${dimOpts}</select>`}
      ${grain?`<span class="seg">${GRAINS.map(g=>`<button data-g="${g}" class="${grain===g?"on":""}">${g[0].toUpperCase()}</button>`).join("")}</span>`:""}
      <span class="seg">${["7d","30d","90d"].map(p=>`<button data-p="${p}" class="${task.time_range&&task.time_range.value===parseInt(p)?"on":""}">${p}</button>`).join("")}</span>
      <button id="cmp" class="${task.comparison?"on":""}">Compare</button>
      <button id="pin">Pin</button>
    </div>
    <div class="crumbs">${(task.where||[]).length?"drilled: ":"no drills — click marks to drill"}${(task.where||[]).map((w,i)=>`<span class="crumb" data-w="${i}" title="remove">${esc((DIMS[w.dimension]||{}).label||w.dimension)} = ${esc(w.value)} ✕</span>`).join("")}</div>
    <div class="body">${renderChart(spec,rows)}</div>
    <div class="foot"><span>data as of 2026-09-10 06:30 IST · last 2 days provisional</span><span>demo data, seeded</span></div>`;
  $("#specView").textContent=JSON.stringify({...spec},null,1);
  // wire interactions
  el.querySelectorAll(".mark").forEach(m=>m.addEventListener("click",()=>{
    const r=rows[parseInt(m.dataset.i)], d=spec.envelope.dims.find(x=>x.key===v.x);
    if(!d||!d.drill_to.length){toast("no drill from this dim (edge of the envelope)");return;}
    try{ SPEC=applyI(spec,{type:"drill",on_dim:v.x,value:r[v.x],to:d.drill_to.includes("advertised_asin")?"advertised_asin":d.drill_to[0]});
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
SPEC=derive(PROMPTS[0]); render();
