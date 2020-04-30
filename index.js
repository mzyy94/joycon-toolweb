const previewJoyconColor = (object, bodyColor, buttonColor) => {
  const style = object.contentDocument.querySelector("style");
  const replaceStyle = (selector, color) => {
    const index = Array.from(style.sheet.rules).findIndex(
      rule => rule.selectorText == selector
    );
    style.sheet.insertRule(`${selector} { fill: ${color} }`, index + 1);
    style.sheet.deleteRule(index);
  };
  replaceStyle(".body-shell", bodyColor);
  replaceStyle(".button", buttonColor);
};

const kindOfController = ["unknown", "left-joycon", "right-joycon", "procon"];
const controllerImage = ["", "Joy-Con_Left.svg", "Joy-Con_Right.svg", ""];

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

  get productName() {
    return this.#_device.productName;
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
      const sendData = [1, 0, 1, 64, 64, 0, 1, 64, 64, scmd, ...data];
      this.#_device.addEventListener("inputreport", responseGrabber);
      this.#_device.sendReport(0x01, new Uint8Array(sendData));
    });
  }

  async fetchDeviceInfo() {
    const data = await this.sendSubCommand(SubCommand.DeviceInfo);

    const macAddr = bufferToHexString(data.buffer, 4, 6, ":");
    const kind = kindOfController[data.getUint8(2)];
    const image = controllerImage[data.getUint8(2)];
    const firmware = `${data.getUint8(0)}.${data.getUint8(1)}`;

    this.kind = kind;
    this.image = image;
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
    return flashData.buffer.slice(5);
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

const submitControllerColor = (controller, bodyColor, buttonColor) => {
  const buffer = new Uint8Array([
    ...bodyColor.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16)),
    ...buttonColor.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16))
  ]);
  controller.writeSPIFlash(SPIAddr.DeviceColor, buffer).catch(e => {
    alert(e);
  });
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

        const buffer = await controller.readSPIFlash(SPIAddr.DeviceColor, 6);
        controller.bodyColor = `#${bufferToHexString(buffer, 0, 3)}`;
        controller.buttonColor = `#${bufferToHexString(buffer, 3, 3)}`;

        document.body.dispatchEvent(
          new CustomEvent("register-controller", { detail: { controller } })
        );
      });
    });
