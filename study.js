"use strict";
window.ExplorerStudy = (() => {
  const $ = id => document.getElementById(id);
  const node = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const svg = (tag, attrs, text) => {
    const e = document.createElementNS("http://www.w3.org/2000/svg",tag);
    for (const [k,v] of Object.entries(attrs)) e.setAttribute(k,v);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const shown = (n,d) => n == null ? "Not available" : (n > 0 ? "+" : "") +
    n.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
  const ageStyle = {"65+":["65+","#4E5961","2 4"],
    "65-74":["65–74","#126A80",""],"75-84":["75–84","#AC532C","9 4"],"85+":["85+","#855184","4 3"]};
  const sexNames = ["Both sexes", "Men", "Women"];
  const select = (id, label, options) => {
    const container = node("label",label);
    const control = node("select"); control.id=id;
    for (const label of options) control.append(node("option",label));
    container.append(control);
    return container;
  };
  async function read() {
    const parts=await Promise.all(window.EXPLORER_STUDY_PARTS.map(async file=>{
      const response=await fetch("./"+file,{credentials:"same-origin"});
      if(!response.ok) throw new Error("Dietary series could not load");
      return response.arrayBuffer();
    }));
    const stream = new Blob(parts).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).json();
  }
  function updateEstimates(data) {
    for (const [id, area] of Object.entries(window.EXPLORER_DATA.countries)) {
      area.incidence = data.incidence[id] || {};
      area.projected = data.scenario[id] || {};
    }
    const matched = document.querySelector(".counts span:nth-child(2) b");
    matched.textContent = Object.keys(window.EXPLORER_DATA.countries)
      .filter(id => data.incidence[id]?.["65+"] != null).length;
  }
  function chart(years, series, bounds, metric) {
    const {min,max,step}=bounds;
    const h = 202, lo = 70, hi = 408;
    const x = i => lo + (hi-lo)*(years[i]-years[0])/(years.at(-1)-years[0]);
    const y = v => 16 + (max-v)/(max-min)*140;
    const draw = svg("svg",{viewBox:"0 0 448 "+h,class:"study-chart",role:"img",
      "aria-label":metric.label+" change from 1990 by age, "+metric.unit});
    const grid=Array.from({length:Math.round((max-min)/step)+1},(_,i)=>+(min+i*step).toPrecision(10));
    for (const v of grid) {
      draw.append(svg("line",{x1:lo,y1:y(v),x2:hi,y2:y(v),class:v===0?"zero":"study-grid"}));
      draw.append(svg("text",{x:lo-6,y:y(v)+4,"text-anchor":"end"},
        Number(v).toLocaleString("en-US",{maximumFractionDigits:3})));
    }
    years.forEach((yr,i) => {
      if (i % 2 === 0 || i === years.length-1)
        draw.append(svg("text",{x:x(i),y:182,"text-anchor":"middle"},String(yr)));
    });
    for (const {age,values} of series) {
      const [label,color,dash]=ageStyle[age];
      let path = "", connected = false;
      values.forEach((n,i) => {
        if (n == null) { connected=false; return; }
        path += (connected ? " L" : " M") + x(i) + "," + y(n);
        connected=true;
      });
      if(path) draw.append(svg("path",{d:path,class:"trend",stroke:color,"stroke-dasharray":dash}));
      values.forEach((n,i) => {
        if(n == null) return;
        const marker=svg("circle",{cx:x(i),cy:y(n),r:3.4,fill:color,stroke:"white","stroke-width":.8});
        marker.append(svg("title",{},label+" years · "+years[i]+": "+shown(n,metric.digits)+" "+metric.unit));
        draw.append(marker);
      });
    }
    return draw;
  }
  function yBounds(values,digits) {
    const lo=Math.min(0,...values),hi=Math.max(0,...values), quantum=10**(-digits);
    const raw=Math.max(quantum,(hi-lo)/4);
    const magnitude=10**Math.floor(Math.log10(raw));
    const step=magnitude*[1,2,5,10].find(x=>x*magnitude>=raw-1e-10);
    const min=Math.floor(lo/step+1e-8)*step;
    return {min,max:Math.max(Math.ceil(hi/step-1e-8)*step,min+step),step};
  }
  function mount(data) {
    const areas = window.EXPLORER_DATA.countries;
    const panel = node("section",undefined,"board study-panel");
    panel.id="dietary-changes"; panel.setAttribute("aria-labelledby","study-heading");
    const title = node("h2","Dietary change, 1990–2018"); title.id="study-heading";
    const subtitle = node("p");
    const filters = node("div",undefined,"study-controls");
    const download = node("button","Download displayed series as CSV"); download.type="button";
    const foodLabel=select("study-food","Food or nutrient",[]);
    for(const group of [...new Set(data.foods.map(f=>f.group))]) {
      const groupEl=node("optgroup"); groupEl.label=group;
      for (const f of data.foods.filter(f=>f.group===group)) {
        const opt=node("option",f.label); opt.value=f.id; groupEl.append(opt);
      }
      foodLabel.querySelector("select").append(groupEl);
    }
    filters.append(foodLabel,select("study-sex","Sex",sexNames),download);
    const ages=node("fieldset",undefined,"study-ages");
    ages.append(node("legend","Age groups to compare"));
    for(const age of ["65-74","75-84","85+","65+"]) {
      const [label,color,dash]=ageStyle[age];
      const control=node("input"); control.type="checkbox"; control.value=age; control.checked=age!=="65+";
      const item=node("label"); item.append(control);
      const swatch=svg("svg",{width:24,height:12,"aria-hidden":"true"});
      swatch.append(svg("line",{x1:0,y1:6,x2:24,y2:6,stroke:color,"stroke-width":2.5,"stroke-dasharray":dash}));
      item.append(swatch,node("span",label+" years")); ages.append(item);
    }
    const charts = node("div",undefined,"study-charts");
    panel.append(title,filters,ages,subtitle,charts);
    document.querySelector(".workspace").after(panel);
    const jump = node("button","Explore dietary changes","study-jump");
    jump.type="button"; jump.onclick=() => panel.scrollIntoView({behavior:"smooth"});
    document.querySelector(".hero").append(jump);
    const note = node("p","Changes are calculated from the Global Dietary Database at Tufts University (GDD 2018 estimates; accessed November 20, 2026), with the same reference age weights in each year. The 2050 scenario applies 2024 age-specific incidence rates to the projected population.");
    document.querySelector("footer").append(note);
    let current = [], metric;
    const render = () => {
      const ageKeys=[...ages.querySelectorAll("input:checked")].map(input=>input.value);
      const food = data.foods.findIndex(f=>f.id===$("study-food").value), sex = $("study-sex").selectedIndex;
      metric=data.foods[food];
      subtitle.textContent="Change from each age group’s own 1990 estimate ("+metric.unit+"). "+
        (metric.id==="whole_grain_share"?"Share is whole grains as a percentage of whole and refined grain weight. ":"")+
        "Gaps indicate unavailable estimates.";
      current = [...$("detail").querySelectorAll("[data-area]")].map(e => e.dataset.area)
        .map(id => ({id,name:id==="CHN" ? "China (mainland)" :
          id==="TWN" ? "Taiwan (province of China)" : areas[id].name,
          series:ageKeys.map(age=>({age,values:data.trend[id]?.[food]?.[sex]?.[data.ages.indexOf(age)] ||
            data.years.map(() => null)}))}));
      const numeric=current.flatMap(a => a.series.flatMap(s=>s.values)).filter(n=>n!=null);
      const bounds=yBounds(numeric,metric.digits);
      charts.replaceChildren();
      for (const a of current) {
        const item=node("article",undefined,"study-area");
        item.append(node("h3",a.name));
        if (a.series.some(s=>s.values.some(n=>n!=null))) {
          item.append(chart(data.years,a.series,bounds,metric));
          const details=node("details");
          details.append(node("summary","Show yearly values"));
          const table=node("table",undefined,"study-data-table");
          table.createCaption().className="study-sr"; table.caption.textContent=a.name;
          const head=table.createTHead().insertRow();
          ["Year",...a.series.map(s=>ageStyle[s.age][0])].forEach(label=>{
            const th=node("th",label); th.scope="col"; head.append(th);
          });
          const body=table.createTBody();
          data.years.forEach((year,i)=>{
            const row=body.insertRow();
            row.insertCell().textContent=year;
            for(const s of a.series) row.insertCell().textContent=shown(s.values[i],metric.digits);
          });
          const scroll=node("div",undefined,"study-scroll");
          scroll.append(table); details.append(scroll); item.append(details);
        } else item.append(node("p","No series is available for this selection."));
        charts.append(item);
      }
      download.disabled=!numeric.length;
    };
    download.onclick=() => {
      const quote = v => '"' + String(v ?? "").replaceAll('"','""') + '"';
      const header = ["reporting_area","iso3","age","sex","indicator","year","unit","change_from_1990"];
      const rows=current.flatMap(a=>a.series.flatMap(s=>data.years.map((yr,i)=>[a.name,a.id,s.age,
        sexNames[$("study-sex").selectedIndex],metric.label,yr,metric.unit,s.values[i]])));
      const csv=[header,...rows].map(row=>row.map(quote).join(",")).join("\r\n")+"\r\n";
      const href=URL.createObjectURL(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}));
      const link=node("a"); link.href=href; link.download="Dietary changes.csv";
      document.body.append(link); link.click(); link.remove();
      setTimeout(()=>URL.revokeObjectURL(href),2000);
    };
    $("study-food").addEventListener("change",render);
    $("study-sex").addEventListener("change",render);
    new MutationObserver(() => {
      const selection=[...$("detail").querySelectorAll("[data-area]")].map(x=>x.dataset.area).join(",");
      if (selection!==current.map(x=>x.id).join(",")) render();
    }).observe($("detail"),{childList:true});
    ages.addEventListener("change",ev=>{
      if(!ages.querySelector("input:checked")) ev.target.checked=true;
      render();
    });
    render();
  }
  return {read,updateEstimates,mount};
})();
