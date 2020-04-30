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

const kindOfController = ["unknown", "left-joycon", "right-joycon", "procon"];

const SubCommand = {
    DeviceInfo: 0x02
}

const setupInputReportListener = device => {
  device.addEventListener("inputreport", ({ target, reportId, data }) => {
    if (reportId == 0x21) {
      const offset = 14;
      switch (data.getUint8(13)) {
        case SubCommand.DeviceInfo: {
          const macAddr = Array.from(
            new Uint8Array(data.buffer.slice(4 + offset, 10 + offset))
          )
            .map(b => b.toString(16).padStart(2, "0"))
            .join(":");
          console.log(
            `Firmware version: ${data.getUint8(0 + offset)}.${data.getUint8(
              1 + offset
            )}`
          );
          console.log(
            "Controller Type:",
            kindOfController[data.getUint8(2 + offset)]
          );
          console.log(`Mac address of ${target.productName}:`, macAddr);
          break;
        }
      }
    }
  });
};

const sendSubCommand = async (device, subCommand, params = []) => {
  const buffer = [1, 0, 1, 64, 64, 0, 1, 64, 64, subCommand, ...params];
  device.sendReport(0x01, new Uint8Array(buffer));
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

        setupInputReportListener(device);

        await sendSubCommand(device, SubCommand.DeviceInfo);
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
