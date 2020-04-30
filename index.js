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

const connectController = () =>
  navigator.hid
    .requestDevice({ filters: [{ vendorId: 0x057e }] })
    .then(devices => {
      devices.forEach(async device => {
        if (!device.opened) {
          await device.open();
        }
        console.log(device.productName, "connected");
      });
    });

const main = () => {
  const object = document.querySelector("object");
  const style = document.createElement("style");
  object.addEventListener("load", ({ target: object }) => {
    setupJoyconStyle(object, style);
  });
  const button = document.querySelector("button");
  button.addEventListener("click", connectController);
};

document.addEventListener("DOMContentLoaded", main);
