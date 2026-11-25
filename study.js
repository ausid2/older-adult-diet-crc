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
  const shown = n => n == null ? "Not available" : (n > 0 ? "+" : "") + n.toFixed(1);
  const foodNames = ["Processed meat", "Whole grains"];
  const sexNames = ["Both sexes", "Men", "Women"];
  const select = (id, label, options) => {
    const container = node("label",label);
    const control = node("select"); control.id=id;
    for (const label of options) control.append(node("option",label));
    container.append(control);
    return container;
  };
  async function read() {
    const bytes = Uint8Array.from(atob(window.EXPLORER_STUDY_DATA), c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
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
  function chart(years, series, min, max) {
    const h = 192, lo = 55, hi = 420;
    const x = i => lo + (hi-lo)*(years[i]-years[0])/(years.at(-1)-years[0]);
    const y = v => 16 + (max-v)/(max-min)*124;
    const draw = svg("svg",{viewBox:"0 0 448 "+h,class:"study-chart",role:"img",
      "aria-label":"Dietary change relative to 1990, in grams per day"});
    for (const v of [...new Set([min,0,max])]) {
      draw.append(svg("line",{x1:lo,y1:y(v),x2:hi,y2:y(v),class:v===0?"zero":"study-grid"}));
      draw.append(svg("text",{x:lo-6,y:y(v)+4,"text-anchor":"end"},String(v)));
    }
    let path = "", connected = false;
    series.forEach((n,i) => {
      if (n == null) { connected=false; return; }
      path += (connected ? " L" : " M") + x(i) + "," + y(n);
      connected=true;
    });
    draw.append(svg("path",{d:path,class:"trend"}));
    years.forEach((yr,i) => {
      const n = series[i];
      if (i % 2 === 0 || i === years.length-1)
        draw.append(svg("text",{x:x(i),y:160,"text-anchor":"middle"},String(yr)));
      if (n != null) {
        const marker = svg("circle",{cx:x(i),cy:y(n),r:4});
        marker.append(svg("title",{},yr+": "+shown(n)+" g/day"));
        draw.append(marker);
      }
    });
    return draw;
  }
  function mount(data) {
    const areas = window.EXPLORER_DATA.countries;
    const panel = node("section",undefined,"board study-panel");
    panel.id="dietary-changes"; panel.setAttribute("aria-labelledby","study-heading");
    const title = node("h2","Dietary change, 1990–2018"); title.id="study-heading";
    const subtitle = node("p","Change from the 1990 intake estimate for the selected reporting area, age and sex (g/day).");
    const filters = node("div",undefined,"study-controls");
    const download = node("button","Download displayed series as CSV"); download.type="button";
    filters.append(select("study-food","Food",foodNames),select("study-sex","Sex",sexNames),download);
    const charts = node("div",undefined,"study-charts");
    panel.append(title,subtitle,filters,charts);
    document.querySelector(".workspace").after(panel);
    const jump = node("button","Explore dietary changes","study-jump");
    jump.type="button"; jump.onclick=() => panel.scrollIntoView({behavior:"smooth"});
    document.querySelector(".hero").append(jump);
    const note = node("p","Dietary change uses the same reference age weights in each year. The 2050 scenario shows how many new cases annual services would see if the 2024 incidence rates at each age stayed the same and only the population changed.");
    document.querySelector("footer").append(note);
    let current = [];
    const render = () => {
      const age = $("age").value;
      const food = $("study-food").selectedIndex, sex = $("study-sex").selectedIndex;
      current = [...$("detail").querySelectorAll("[data-area]")].map(e => e.dataset.area)
        .map(id => ({id,name:id==="CHN" ? "China (mainland)" :
          id==="TWN" ? "Taiwan (province of China)" : areas[id].name,
          series:data.trend[id]?.[food]?.[sex]?.[data.ages.indexOf(age)] ||
          data.years.map(() => null)}));
      const numeric=current.flatMap(a => a.series).filter(n=>n!=null);
      const low=Math.min(0,...numeric), high=Math.max(0,...numeric);
      const step=Math.max(.5, (high-low)>15 ? 5 : (high-low)>3 ? 1 : .5);
      const min=Math.floor(low/step)*step, max=Math.max(Math.ceil(high/step)*step,min+step);
      charts.replaceChildren();
      for (const a of current) {
        const item=node("article",undefined,"study-area");
        item.append(node("h3",a.name));
        if (a.series.some(n=>n!=null)) {
          item.append(chart(data.years,a.series,min,max));
          const details=node("details");
          details.append(node("summary","Show yearly values"));
          const table=node("table",undefined,"study-data-table");
          table.createCaption().className="study-sr"; table.caption.textContent=a.name;
          const head=table.createTHead().insertRow();
          ["Year","Change (g/day)"].forEach(label=>{
            const th=node("th",label); th.scope="col"; head.append(th);
          });
          const body=table.createTBody();
          data.years.forEach((year,i)=>{
            const row=body.insertRow();
            row.insertCell().textContent=year;
            row.insertCell().textContent=shown(a.series[i]);
          });
          details.append(table); item.append(details);
        } else item.append(node("p","No series is available for this selection."));
        charts.append(item);
      }
      download.disabled=!numeric.length;
    };
    download.onclick=() => {
      const quote = v => '"' + String(v ?? "").replaceAll('"','""') + '"';
      const header = ["reporting_area","iso3","age","sex","food","year","change_from_1990_g_per_day"];
      const rows=current.flatMap(a=>data.years.map((yr,i)=>[a.name,a.id,$("age").value,
        sexNames[$("study-sex").selectedIndex],foodNames[$("study-food").selectedIndex],yr,a.series[i]]));
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
    $("age").addEventListener("change",render);
    render();
  }
  return {read,updateEstimates,mount};
})();
