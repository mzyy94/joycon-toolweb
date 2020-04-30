const style = document.createElement("style");

const setupJoyconStyle = ({ target }) => {
  const svg = target.contentDocument.querySelector("svg");
  const width = svg.getAttribute("width");
  const height = svg.getAttribute("height");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  svg
    .querySelectorAll("path[style^='fill:#00bbdb']")
    .forEach(path => path.classList.add("left-joycon-body"));
  svg
    .querySelectorAll("path[style^='fill:#ff5f53']")
    .forEach(path => path.classList.add("right-joycon-body"));
  svg.append(style);

  style.sheet.addRule(".right-joycon-body", "fill: #fff !important");
  style.sheet.addRule(".left-joycon-body", "fill: #fff !important");

  setupColorPicker(svg);
};

const setupColorPicker = svg => {
  svg.addEventListener("click", e => {
    if (e.target.className.baseVal) {
      const target = e.target.className.baseVal.replace("body", "picker");
      document.querySelector(`#${target}`).click();
    }
  });

  document.querySelectorAll("input[type='color']").forEach(colorpicker => {
    colorpicker.addEventListener("change", ({ target }) => {
      previewJoyconColor(target.name, target.value.slice(1));
    });
  });
};

const previewJoyconColor = (kind, color) => {
  const label = `.${kind}-body`;
  const index = Array.from(style.sheet.rules).findIndex(
    rule => rule.selectorText == label
  );
  style.sheet.addRule(label, `fill: #${color} !important`);
  style.sheet.deleteRule(index);
  document.querySelector(`#${kind}-picker`).value = `#${color}`;
};

const kindOfController = ["unknown", "left-joycon", "right-joycon", "procon"];

const SubCommand = {
  DeviceInfo: 0x02,
  ReadSPI: 0x10
};

const SPIAddr = {
  DeviceColor: 0x6050
};

const bufferToHexString = (buffer, start, length, sep = "") =>
  Array.from(new Uint8Array(buffer.slice(start, start + length)))
    .map(v => v.toString(16).padStart(2, "0"))
    .join(sep);

const setupInputReportListener = device => {
  device.addEventListener("inputreport", ({ target, reportId, data }) => {
    if (reportId == 0x21) {
      const offset = 14;
      switch (data.getUint8(13)) {
        case SubCommand.DeviceInfo: {
          const macAddr = bufferToHexString(data.buffer, 4 + offset, 6, ":");
          const kind = kindOfController[data.getUint8(2 + offset)];
          const firmware = `${data.getUint8(0 + offset)}.${data.getUint8(
            1 + offset
          )}`;
          console.log("Firmware version:", firmware);
          console.log("Controller Type:", kind);
          console.log("Mac address:", macAddr);

          target.kind = kind;
          target.macAddr = macAddr;
          target.firmware = firmware;
          break;
        }
        case SubCommand.ReadSPI: {
          const addr = data.getUint16(offset, true);
          const len = data.getUint8(4 + offset);
          switch (addr) {
            case SPIAddr.DeviceColor: {
              const bodyColor = bufferToHexString(data.buffer, 5 + offset, 3);
              previewJoyconColor(target.kind, bodyColor);
              break;
            }
            default: {
              const hex = bufferToHexString(data.buffer, 5 + offset, len);
              console.log(addr.toString(16).padStart(4, "0"), len, hex);
            }
          }
          break;
        }
      }
    }
  });
};

const sendSubCommand = async (device, subCommand, params = []) => {
  const data = [1, 0, 1, 64, 64, 0, 1, 64, 64, subCommand, ...params];
  device.sendReport(0x01, new Uint8Array(data));
};

const readSPIRequest = async (device, addr, length) => {
  const buffer = new Uint8Array(5);
  const dataView = new DataView(buffer.buffer);
  dataView.setUint16(0, addr, true);
  dataView.setUint8(4, length);
  sendSubCommand(device, SubCommand.ReadSPI, buffer);
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
        await new Promise(resolve => setTimeout(resolve, 300));
        await readSPIRequest(device, SPIAddr.DeviceColor, 16);
      });
    });

const main = () => {
  const object = document.querySelector("object");
  object.addEventListener("load", setupJoyconStyle);
  const button = document.querySelector("button");
  button.addEventListener("click", connectController);
};

document.addEventListener("DOMContentLoaded", main);
