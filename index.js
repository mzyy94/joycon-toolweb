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
  ReadSPI: 0x10,
  WriteSPI: 0x11
};

const SPIAddr = {
  DeviceColor: 0x6050
};

const bufferToHexString = (buffer, start, length, sep = "") =>
  Array.from(new Uint8Array(buffer.slice(start, start + length)))
    .map(v => v.toString(16).padStart(2, "0"))
    .join(sep);

class Controller {
  #_device;
  macAddr = "";

  constructor(device) {
    this.#_device = device;
  }

  async sendSubCommand(scmd, data = [], filter = () => 1, timeout = 1000) {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.#_device.removeEventListener("inputreport", responseGrabber);
        return reject();
      }, timeout);
      const responseGrabber = ({ target, reportId, data }) => {
        if (reportId == 0x21 && data.getUint8(13) == scmd && filter(data)) {
          clearTimeout(timeoutHandle);
          target.removeEventListener("inputreport", responseGrabber);
          resolve(new DataView(data.buffer.slice(14)));
        }
      };
      this.#_device.addEventListener("inputreport", responseGrabber);
      sendSubCommand(this.#_device, scmd, data);
    });
  }

  async fetchDeviceInfo() {
    const data = await this.sendSubCommand(SubCommand.DeviceInfo);

    const macAddr = bufferToHexString(data.buffer, 4, 6, ":");
    const kind = kindOfController[data.getUint8(2)];
    const firmware = `${data.getUint8(0)}.${data.getUint8(1)}`;

    this.kind = kind;
    this.macAddr = macAddr;
    this.firmware = firmware;
  }

  async readSPIFlash(address, length) {
    const sendData = new Uint8Array(5);
    const dataView = new DataView(sendData.buffer);
    dataView.setUint16(0, address, true);
    dataView.setUint8(4, length);
    const filter = data => {
      const addr = data.getUint16(14, true);
      const len = data.getUint8(18);
      return addr == address && len == length;
    };
    const flashData = await this.sendSubCommand(
      SubCommand.ReadSPI,
      sendData,
      filter
    );
    return flashData;
  }

  async writeSPIFlash(address, data) {
    const sendData = new Uint8Array([0, 0, 0, 0, 0, ...data]);
    const dataView = new DataView(sendData.buffer);
    dataView.setUint16(0, address, true);
    dataView.setUint8(4, data.length);
    const flashData = await this.sendSubCommand(SubCommand.WriteSPI, sendData);
    if (flashData.getUint8(0) != 0) {
      return Promise.reject("Write SPI Error");
    }
    return Promise.resolve();
  }
}

const sendSubCommand = async (device, subCommand, params = []) => {
  const data = [1, 0, 1, 64, 64, 0, 1, 64, 64, subCommand, ...params];
  device.sendReport(0x01, new Uint8Array(data));
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

        const controller = new Controller(device);
        await controller.fetchDeviceInfo();

        console.log("Firmware version:", controller.firmware);
        console.log("Controller Type:", controller.kind);
        console.log("Mac address:", controller.macAddr);

        document
          .querySelector(`button#${controller.kind}-submit`)
          .addEventListener("click", () => {
            const color = document.querySelector(
              `input[name='${controller.kind}']`
            ).value;
            const buffer = new Uint8Array(
              color.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16))
            );
            controller.writeSPIFlash(SPIAddr.DeviceColor, buffer).catch(e => {
              alert(e);
            });
          });

        const data = await controller.readSPIFlash(SPIAddr.DeviceColor, 3);
        const bodyColor = bufferToHexString(data.buffer, 5, 3);
        previewJoyconColor(controller.kind, bodyColor);
      });
    });

const main = () => {
  const object = document.querySelector("object");
  object.addEventListener("load", setupJoyconStyle);
  const connectButton = document.querySelector("button#connect");
  connectButton.addEventListener("click", connectController);
};

document.addEventListener("DOMContentLoaded", main);
