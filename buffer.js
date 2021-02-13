// SPDX-License-Identifier: Apache-2.0
// Copyright 2021 @mzyy94

// @ts-check

export class BufferView extends DataView {
  cursor = 0;
  le = true;

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

  readColorCode() {
    const code = this.toHexString(this.cursor, 3);
    this.cursor += 3;
    return `#${code}`;
  }

  readUint32() {
    const value = this.getUint32(this.cursor, this.le);
    this.cursor += 4;
    return value;
  }

  readUint8() {
    const value = this.getUint8(this.cursor);
    this.cursor += 1;
    return value;
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
      this.cursor = 5;
      return;
    }
    const sendData = new Uint8Array([...new Array(5), ...data]);
    super(sendData.buffer);
    this.setUint32(0, address, true);
    this.setUint8(4, data.length || length);
    this.cursor = 5;
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

  set body(value) {
    const rgb = hexStringToNumberArray(value);
    for (let i = 0; i < rgb.length; i++) {
      this.setInt8(i + 0, rgb[i])
    }
  }

  set button(value) {
    const rgb = hexStringToNumberArray(value);
    for (let i = 0; i < rgb.length; i++) {
      this.setInt8(i + 3, rgb[i])
    }
  }

  set leftGrip(value) {
    const rgb = hexStringToNumberArray(value);
    for (let i = 0; i < rgb.length; i++) {
      this.setInt8(i + 6, rgb[i])
    }
  }

  set rightGrip(value) {
    const rgb = hexStringToNumberArray(value);
    for (let i = 0; i < rgb.length; i++) {
      this.setInt8(i + 9, rgb[i])
    }
  }
}

/**
 * Hex string to number Array
 *
 * @param {string | undefined} hexString
 */
export const hexStringToNumberArray = (hexString) =>
  hexString?.match(/[\da-f]{2}/gi)?.map((h) => parseInt(h, 16)) ?? [];
