// SPDX-License-Identifier: Apache-2.0

// @ts-check
"use strict";

/**
 * Apply preview color to svg element class
 *
 * @param {HTMLObjectElement} object
 * @param {Controller} controller
 */
const previewColor = (object, controller) => {
  const style = object.contentDocument.querySelector("style");
  /**
   * @param {string} selector
   * @param {string} color
   */
  const replaceStyle = (selector, color) => {
    const index = Array.from(style.sheet.rules).findIndex(
      (rule) => rule.selectorText == selector
    );
    style.sheet.insertRule(`${selector} { fill: ${color} }`, index + 1);
    style.sheet.deleteRule(index);
  };
  replaceStyle(".body-shell", controller.bodyColor);
  if (controller.kind == "procon") {
    replaceStyle(".left-grip", controller.leftGripColor);
    replaceStyle(".right-grip", controller.rightGripColor);
  }
  replaceStyle(".button", controller.buttonColor);
};

/**
 * Set battery capacity level of battery icon
 *
 * @param {HTMLObjectElement} object
 * @param {number} voltage
 */
const setBatteryCapacity = (object, voltage) => {
  const level = (voltage - 3.3) / (4.2 - 3.3);
  const capacity = object.contentDocument.querySelector("#capacity");
  capacity.setAttribute("width", String(416 * level));
};

const kindOfController = ["unknown", "left-joycon", "right-joycon", "procon"];
const controllerImage = [
  "",
  "images/Joy-Con_Left.svg",
  "images/Joy-Con_Right.svg",
  "images/Pro-Controller.svg",
];

/** @enum {number} */
const SubCommand = {
  DeviceInfo: 0x02,
  ReadSPI: 0x10,
  WriteSPI: 0x11,
  Voltage: 0x50,
};

/** @enum {number} */
const SPIAddr = {
  SerialNumber: 0x6000,
  TypeInfo: 0x6012,
  ColorType: 0x601b,
  DeviceColor: 0x6050,
};

const ColorType = {
  Default: 0,
  BodyAndButton: 1,
  FullCustom: 2,
};

/**
 * ArrayBuffer to hex string
 *
 * @param {ArrayBuffer} buffer
 * @param {number} start
 * @param {number} length
 * @param {?string} sep
 */
const bufferToHexString = (buffer, start, length, sep = "") =>
  Array.from(new Uint8Array(buffer.slice(start, start + length)))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join(sep);

/**
 * Hex string to number Array
 *
 * @param {string} hexString
 */
const hexStringToNumberArray = (hexString) =>
  hexString.match(/[\da-f]{2}/gi).map((h) => parseInt(h, 16));

class Controller {
  /** @type {HIDDevice} */
  #_device;
  macAddr = "";

  /**
   * @param {HIDDevice} device
   */
  constructor(device) {
    this.#_device = device;
  }

  /**
   * @returns {string}
   */
  get productName() {
    return this.#_device.productName;
  }

  /**
   * @param {SubCommand} scmd
   * @param {?Array.<number> | ?Uint8Array} data
   * @param {?Function} filter
   * @param {?number} timeout
   * @returns {!Promise.<DataView>}
   */
  async sendSubCommand(scmd, data = [], filter = () => 1, timeout = 1000) {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.#_device.removeEventListener("inputreport", reporter);
        return reject();
      }, timeout);
      /**
       * @param {Event & {reportId: number, data: DataView}} event
       */
      const reporter = ({ target, reportId, data }) => {
        if (reportId == 0x21 && data.getUint8(13) == scmd && filter(data)) {
          clearTimeout(timeoutHandle);
          target.removeEventListener("inputreport", reporter);
          resolve(new DataView(data.buffer.slice(14)));
        }
      };
      const sendData = [1, 0, 1, 64, 64, 0, 1, 64, 64, scmd, ...data];
      this.#_device.addEventListener("inputreport", reporter);
      this.#_device.sendReport(0x01, new Uint8Array(sendData));
    });
  }

  async stopInputReport() {
    this.#_device.sendReport(0x80, new Uint8Array(0x05));
    return new Promise((resolve) => setTimeout(resolve, 500));
  }

  async fetchDeviceInfo() {
    await this.stopInputReport();

    const deviceInfo = await this.sendSubCommand(SubCommand.DeviceInfo);

    this.macAddr = bufferToHexString(deviceInfo.buffer, 4, 6, ":");
    this.kind = kindOfController[deviceInfo.getUint8(2)];
    this.image = controllerImage[deviceInfo.getUint8(2)];
    this.firmware = `${deviceInfo.getUint8(0)}.${deviceInfo.getUint8(1)}`;

    const colorType = await this.readSPIFlash(SPIAddr.ColorType, 1);
    this.colorType = new Uint8Array(colorType)[0];

    const deviceColor = await this.readSPIFlash(SPIAddr.DeviceColor, 12);
    this.bodyColor = `#${bufferToHexString(deviceColor, 0, 3)}`;
    this.buttonColor = `#${bufferToHexString(deviceColor, 3, 3)}`;
    this.leftGripColor = `#${bufferToHexString(deviceColor, 6, 3)}`;
    this.rightGripColor = `#${bufferToHexString(deviceColor, 9, 3)}`;
    if (this.kind == "procon" && this.colorType != ColorType.FullCustom) {
      this.leftGripColor = this.bodyColor;
      this.rightGripColor = this.bodyColor;
    }

    const serialNumber = await this.readSPIFlash(SPIAddr.SerialNumber, 16);
    this.serialNumber = String.fromCharCode
      .apply("", new Uint8Array(serialNumber))
      .replace(/\0/g, "");

    const voltage = await this.sendSubCommand(SubCommand.Voltage);
    this.voltage = voltage.getUint16(0, true) / 400;
  }

  /**
   * @param {SPIAddr} address
   * @param {number} length
   * @returns {!Promise.<ArrayBuffer>}
   */
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

  /**
   * @param {SPIAddr} address
   * @param {!Uint8Array | !Array.<number>} data
   */
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

  /**
   * @param {Controller} controller
   */
  async submitColor(controller) {
    const buffer = new Uint8Array([
      ...hexStringToNumberArray(controller.bodyColor),
      ...hexStringToNumberArray(controller.buttonColor),
      ...hexStringToNumberArray(controller.leftGripColor),
      ...hexStringToNumberArray(controller.rightGripColor),
    ]);

    if (
      controller.kind == "procon" &&
      controller.colorType != ColorType.FullCustom
    ) {
      if (
        controller.leftGripColor != controller.bodyColor ||
        controller.rightGripColor != controller.bodyColor
      ) {
        await this.writeSPIFlash(SPIAddr.ColorType, [2]).catch((e) => {
          alert(e);
        });
      }
    }

    this.writeSPIFlash(SPIAddr.DeviceColor, buffer).catch((e) => {
      alert(e);
    });
  }
}

/**
 * @returns {HIDDevice}
 */
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

/**
 * @typedef {{
 * close: Function,
 * collections: Array.<any>
 * oninputreport: ?Function,
 * open: Function,
 * opened: boolean,
 * productId: number,
 * productName: string,
 * receiveFeatureReport: Function,
 * sendFeatureReport: Function,
 * sendReport: Function,
 * vendorId: number,
 * } & EventTarget} HIDDevice
 */
