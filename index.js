const setupJoyconStyle = (object, style) => {
  object.contentDocument
    .querySelectorAll("path[style^='fill:#00bbdb']")
    .forEach(path => path.classList.add("left-joycon-body"));
  object.contentDocument
    .querySelectorAll("path[style^='fill:#ff5f53']")
    .forEach(path => path.classList.add("right-joycon-body"));
  object.contentDocument.documentElement.append(style);

  style.sheet.addRule(".right-joycon-body", "fill: #fff !important");
  style.sheet.addRule(".left-joycon-body", "fill: #fff !important");
};

const main = () => {
  const object = document.querySelector("object");
  const style = document.createElement("style");
  object.addEventListener("load", ({ target: object }) => {
    setupJoyconStyle(object, style);
  });
};

document.addEventListener("DOMContentLoaded", main);
