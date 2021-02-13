// SPDX-License-Identifier: Apache-2.0
// Copyright 2021 @mzyy94

// @ts-check

export class BufferView extends DataView {
  /**
   * ArrayBuffer to hex string
   *
   * @param {number} start
   * @param {number} length
   * @param {string} sep
   */
  toHexString(start, length, sep = "") {
    return Array.from(new Uint8Array(this.buffer.slice(start, start + length)))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join(sep);
  }
}

export class DeviceInfo {
  /**
   * @param {DataView} data 
   */
  constructor(data) {
    this.major = data.getUint8(0);
    this.minor = data.getUint8(1);
    this.type = data.getUint8(2);
    this.macAddr = Array.from(new Uint8Array(data.buffer.slice(4, 10)))
      .map((v) => v.toString(16).padStart(2, "0")).join(":");
  }
}

export class SPIBuffer extends BufferView {
  /**
   * @param {number | ArrayBuffer} address - SPI address OR raw buffer
   * @param {!Uint8Array | !Array.<number>} data
   */
  constructor(address, length = 0, data = []) {
    if (typeof address != 'number') {
      super(address);
      return;
    }
    const sendData = new Uint8Array([...new Array(5), ...data]);
    super(sendData.buffer);
    this.setUint32(0, address, true);
    this.setUint8(4, data.length || length);
  }

  get address() {
    return this.getUint32(0, true);
  }

  get length() {
    return this.getUint8(4);
  }

  get data() {
    return this.buffer.slice(5);
  }

  get sendData() {
    return new Uint8Array(this.buffer);
  }
}

export class ColorBuffer extends BufferView {
  /**
   * @param {ArrayBuffer} buffer
   */
  constructor(buffer) {
    super(buffer);
  }

  initGripColors() {
    this.leftGrip = this.body;
    this.rightGrip = this.body;
    if (this.button == "#ffffff" && this.body == "#313232") {
      this.leftGrip = "#1edc00";
      this.rightGrip = "#ff3278";
    } else if (this.button == "#ffffff" && this.body == "#323132") {
      this.leftGrip = "#b04256";
      this.rightGrip = "#b04256";
    }
  }

  get body() {
    return `#${this.toHexString(0, 3)}`;
  }

  get button() {
    return `#${this.toHexString(3, 3)}`;
  }

  get leftGrip() {
    return `#${this.toHexString(6, 3)}`;
  }

  get rightGrip() {
    return `#${this.toHexString(9, 3)}`;
  }

  /**
   * @param {string} value
   * @param {number} offset
   * @private
   */
  _setHexString(value, offset) {
    const rgb = value.match(/[\da-f]{2}/gi)?.map((h) => parseInt(h, 16)) ?? [];
    for (let i = 0; i < rgb.length; i++) {
      this.setUint8(i + offset, rgb[i])
    }
  }

  set body(value) {
    this._setHexString(value, 0);
  }

  set button(value) {
    this._setHexString(value, 3);
  }

  set leftGrip(value) {
    this._setHexString(value, 6);
  }

  set rightGrip(value) {
    this._setHexString(value, 9);
  }
}
