"use strict";
(async () => {
  const status = document.getElementById("loading-text");
  try {
    const [data, response] = await Promise.all([
      window.ExplorerStudy.read(), fetch("./explorer.html", {credentials: "same-origin"})
    ]);
    if (!response.ok) throw new Error("Explorer assets failed to load");
    const base = new DOMParser().parseFromString(await response.text(), "text/html");
    const scripts = [...base.querySelectorAll("script")];
    if (scripts.length !== 2 || scripts.some(s => s.hasAttribute("src")))
      throw new Error("Unexpected explorer asset layout");
    scripts.forEach(s => s.remove());
    [...base.querySelectorAll("style")].forEach(style => document.head.append(document.importNode(style,true)));
    document.body.replaceChildren(...[...base.body.childNodes].map(n => document.importNode(n,true)));
    const activate = original => {
      const script = document.createElement("script");
      script.textContent = original.textContent;
      document.body.append(script);
    };
    activate(scripts[0]);
    window.ExplorerStudy.updateEstimates(data);
    activate(scripts[1]);
    window.ExplorerStudy.mount(data);
  } catch (error) {
    console.error(error);
    if (status.isConnected) status.textContent = "The updated explorer could not load.";
    else {
      const note = document.createElement("p");
      note.setAttribute("role","status");
      const link = Object.assign(document.createElement("a"), {href:"explorer.html",textContent:"Open the previous edition"});
      note.append("The updated explorer could not load. ",link);
      document.body.prepend(note);
    }
  }
})();
