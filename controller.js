// SPDX-License-Identifier: Apache-2.0
// Copyright 2021 @mzyy94

// @ts-check

import { BufferView, SPIBuffer, hexStringToNumberArray, ColorBuffer } from "./buffer.js";

/** @readonly @enum {string} */
const types = ["unknown", "left-joycon", "right-joycon", "procon"];
const images = [
  "",
  "images/Joy-Con_Left.svg",
  "images/Joy-Con_Right.svg",
  "images/Pro-Controller.svg",
];

/** @readonly @enum {number} */
const SubCommand = {
  DeviceInfo: 0x02,
  ReadSPI: 0x10,
  WriteSPI: 0x11,
  Voltage: 0x50,
};

/** @readonly @enum {number} */
const SPIAddr = {
  SerialNumber: 0x6000,
  TypeInfo: 0x6012,
  ColorType: 0x601b,
  DeviceColor: 0x6050,
};

/** @readonly @enum {number} */
const ColorType = {
  Default: 0,
  BodyAndButton: 1,
  FullCustom: 2,
};

export class Controller {
  /** @private @type {HIDDevice} */
  _device;
  macAddr = "";

  /**
   * @param {HIDDevice} device
   */
  constructor(device) {
    this._device = device;
  }

  /**
   * @returns {string}
   */
  get productName() {
    return this._device.productName;
  }

  /**
   * @param {SubCommand} scmd
   * @param {!Array.<number> | !Uint8Array} body
   * @param {(data: BufferView) => boolean} optionFilter
   * @param {number} timeout
   * @param {number} retry
   * @returns {!Promise.<BufferView>}
   */
  async sendSubCommand(
    scmd,
    body = new Uint8Array([]),
    optionFilter = () => true,
    timeout = 1000,
    retry = 3
  ) {
    const reportId = 0x01;
    const data = new Uint8Array([1, 0, 1, 64, 64, 0, 1, 64, 64, scmd, ...body]);
    /**
     * @param {number} reportId
     * @param {BufferView} data
     */
    const filter = (reportId, data) =>
      reportId == 0x21 && data.getUint8(13) == scmd && optionFilter(data);

    return new Promise((resolve, reject) =>
      this.sendReport(reportId, data, filter, timeout, retry)
        .then((data) => resolve(new BufferView(data.buffer.slice(14))))
        .catch(() => reject(`request failed: subCommand=${scmd}`))
    );
  }

  /**
   * @param {number} reportId
   * @param {!Uint8Array} sendData
   * @param {(reportId: number, data: BufferView) => boolean} filter
   * @param {number} timeout
   * @param {number} retry
   */
  async sendReport(reportId, sendData, filter, timeout, retry) {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this._device.removeEventListener("inputreport", reporter);
        if (retry > 0) {
          this.sendReport(reportId, sendData, filter, timeout, retry - 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(`request timeout: reportId=${reportId}`);
        }
      }, timeout);
      /**
       * @param {HIDInputReportEvent} event
       */
      const reporter = ({ target, reportId, data }) => {
        if (filter(reportId, new BufferView(data.buffer))) {
          clearTimeout(timeoutHandle);
          target.removeEventListener("inputreport", reporter);
          resolve(data);
        }
      };
      this._device.addEventListener("inputreport", reporter);
      this._device.sendReport(reportId, sendData);
    });
  }

  async startConnection() {
    if (this._device.collections[0]?.outputReports.find(({reportId}) => reportId == 0x80) == undefined) {
      return;
    }
    await this._device.sendReport(0x80, new Uint8Array([0x05])); // Stop UART connection
    /**
     * @param {number} id
     * @param {!BufferView} data
     */
    const filter = (id, data) => id == 0x81 && data.getUint8(0) == 0x02;
    await this.sendReport(0x80, new Uint8Array([0x02]), filter, 500, 3) // Handshake
      .catch(() => console.warn("Failed to start connection. Ignore;"));
    await this._device.sendReport(0x80, new Uint8Array([0x04])); // Start UART connection
  }

  async fetchDeviceInfo() {
    const deviceInfo = await this.sendSubCommand(SubCommand.DeviceInfo);

    this.macAddr = deviceInfo.toHexString(4, 6, ":");
    this.type = types[deviceInfo.getUint8(2)];
    this.image = images[deviceInfo.getUint8(2)];
    this.firmware = `${deviceInfo.getUint8(0)}.${deviceInfo.getUint8(1)}`;

    const colorType = await this.readSPIFlash(SPIAddr.ColorType, 1);
    this.colorType = colorType.readUint8();

    const deviceColor = await this.readSPIFlash(SPIAddr.DeviceColor, 12);
    const colorBuffer = new ColorBuffer(deviceColor.data);
    if (this.type == "procon" && this.colorType != ColorType.FullCustom) {
      colorBuffer.initGripColors()
    }
    this.colors = colorBuffer;

    const serialNumber = await this.readSPIFlash(SPIAddr.SerialNumber, 16);
    this.serialNumber = String.fromCharCode
      // @ts-ignore
      .apply("", new Uint8Array(serialNumber))
      .replace(/\xff/g, "*")
      .replace(/\0/g, "");

    const voltage = await this.sendSubCommand(SubCommand.Voltage);
    this.voltage = voltage.readUint32() / 400;
  }

  /**
   * @param {SPIAddr} address
   * @param {number} length
   * @returns {!Promise.<SPIBuffer>}
   */
  async readSPIFlash(address, length) {
    const { sendData } = new SPIBuffer(address, length)
    /**
     * @param {BufferView} data
     */
    const filter = (data) => {
      const payload = new SPIBuffer(data.buffer.slice(14));
      return payload.address == address && payload.length == length;
    };
    const flashData = await this.sendSubCommand(
      SubCommand.ReadSPI,
      sendData,
      filter
    );
    return new SPIBuffer(flashData.buffer);
  }

  /**
   * @param {SPIAddr} address
   * @param {!Uint8Array | !Array.<number>} data
   */
  async writeSPIFlash(address, data) {
    const { sendData } = new SPIBuffer(address, data.length, data);
    const flashData = await this.sendSubCommand(SubCommand.WriteSPI, sendData);
    if (flashData.readUint8() != 0) {
      return Promise.reject("Write SPI Error");
    }
    return Promise.resolve();
  }

  async submitColor() {
    const buffer = new Uint8Array([
      ...hexStringToNumberArray(this.colors?.body),
      ...hexStringToNumberArray(this.colors?.button),
      ...hexStringToNumberArray(this.colors?.leftGrip),
      ...hexStringToNumberArray(this.colors?.rightGrip),
    ]);

    if (this.type == "procon" && this.colorType != ColorType.FullCustom) {
      if (
        this.colors?.leftGrip != this.colors?.body ||
        this.colors?.rightGrip != this.colors?.body
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
 * @typedef HIDInputReportEvent~Event
 * @type {object}
 * @property {number} reportId
 * @property {!DataView} data
 * @property {!HIDDevice} target
 */

/**
 * @typedef HIDDevice
 * @type {object}
 * @property {Function} close
 * @property {Array.<{outputReports: {reportId: number}[]}>} collections
 * @property {?Function} oninputreport
 * @property {Function} open
 * @property {boolean} opened
 * @property {number} productId
 * @property {string} productName
 * @property {Function} receiveFeatureReport
 * @property {Function} sendFeatureReport
 * @property {Function} sendReport
 * @property {number} vendorId
 * @property {(type: "inputreport", listener: { (evt: HIDInputReportEvent): void;}) => void} addEventListener
 * @property {(type: "inputreport", listener: { (evt: HIDInputReportEvent): void;}) => void} removeEventListener
 */
