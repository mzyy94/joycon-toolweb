const previewJoyconColor = (object, controller) => {
  const style = object.contentDocument.querySelector("style");
  const replaceStyle = (selector, color) => {
    const index = Array.from(style.sheet.rules).findIndex(
      (rule) => rule.selectorText == selector
    );
    style.sheet.insertRule(`${selector} { fill: ${color} }`, index + 1);
    style.sheet.deleteRule(index);
  };
  replaceStyle(".body-shell", controller.bodyColor);
  replaceStyle(".button", controller.buttonColor);
};

const setBatteryCapacity = (object, voltage) => {
  const level = (voltage - 3.3) / (4.2 - 3.3);
  const capacity = object.contentDocument.querySelector("#capacity");
  capacity.setAttribute("width", 416 * level);
};

const kindOfController = ["unknown", "left-joycon", "right-joycon", "procon"];
const controllerImage = ["", "Joy-Con_Left.svg", "Joy-Con_Right.svg", ""];

const SubCommand = {
  DeviceInfo: 0x02,
  ReadSPI: 0x10,
  WriteSPI: 0x11,
  Voltage: 0x50,
};

const SPIAddr = {
  SerialNumber: 0x6000,
  TypeInfo: 0x6012,
  DeviceColor: 0x6050,
};

const bufferToHexString = (buffer, start, length, sep = "") =>
  Array.from(new Uint8Array(buffer.slice(start, start + length)))
    .map((v) => v.toString(16).padStart(2, "0"))
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
    const deviceInfo = await this.sendSubCommand(SubCommand.DeviceInfo);

    this.macAddr = bufferToHexString(deviceInfo.buffer, 4, 6, ":");
    this.kind = kindOfController[deviceInfo.getUint8(2)];
    this.image = controllerImage[deviceInfo.getUint8(2)];
    this.firmware = `${deviceInfo.getUint8(0)}.${deviceInfo.getUint8(1)}`;

    const deviceColor = await this.readSPIFlash(SPIAddr.DeviceColor, 6);
    this.bodyColor = `#${bufferToHexString(deviceColor, 0, 3)}`;
    this.buttonColor = `#${bufferToHexString(deviceColor, 3, 3)}`;

    const serialNumber = await this.readSPIFlash(SPIAddr.SerialNumber, 16);
    this.serialNumber = String.fromCharCode
      .apply("", new Uint8Array(serialNumber))
      .replace(/\0/g, "");

    const voltage = await this.sendSubCommand(SubCommand.Voltage);
    this.voltage = voltage.getUint16(0, true) / 400;
  }

  async readSPIFlash(address, length) {
    const sendData = new Uint8Array(5);
    const dataView = new DataView(sendData.buffer);
    dataView.setUint16(0, address, true);
    dataView.setUint8(4, length);
    const filter = (data) => {
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

  async submitColor(bodyColor, buttonColor) {
    const buffer = new Uint8Array([
      ...bodyColor.match(/[\da-f]{2}/gi).map((h) => parseInt(h, 16)),
      ...buttonColor.match(/[\da-f]{2}/gi).map((h) => parseInt(h, 16)),
    ]);
    this.writeSPIFlash(SPIAddr.DeviceColor, buffer).catch((e) => {
      alert(e);
    });
  }
}

const connectController = () =>
  navigator.hid
    .requestDevice({ filters: [{ vendorId: 0x057e }] })
    .then((devices) => {
      devices.forEach(async (device) => {
        if (!device.opened) {
          await device.open();
        }
        console.log(device.productName, "connected");

        const controller = new Controller(device);
        await controller.fetchDeviceInfo();

        console.table(controller);

        document.body.dispatchEvent(
          new CustomEvent("register-controller", { detail: { controller } })
        );
      });
    });
