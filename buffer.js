// SPDX-License-Identifier: Apache-2.0
// Copyright 2021 @mzyy94

// @ts-check

export class BufferView extends DataView {
  /** @private */
  _cursor = 0;
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
    const code = this.toHexString(this._cursor, 3);
    this._cursor += 3;
    return `#${code}`;
  }

  /**
   * @param {number} value
   */
  writeUint32(value) {
    this.setUint32(this._cursor, value, this.le);
    this._cursor += 4;
  }

  /**
   * @param {number} value
   */
  writeUint8(value) {
    this.setUint8(this._cursor, value);
    this._cursor += 1;
  }

  readUint32() {
    const value = this.getUint32(this._cursor, this.le);
    this._cursor += 4;
    return value;
  }

  readUint8() {
    const value = this.getUint8(this._cursor);
    this._cursor += 1;
    return value;
  }
}

export class SPIBuffer extends BufferView {
  /**
   * @param {number} address
   * @param {!Uint8Array | !Array.<number>} data
   */
  constructor(address, length = 0, data = []) {
    const sendData = new Uint8Array([...new Array(5), ...data]);
    super(sendData.buffer);
    this.writeUint32(address);
    this.writeUint8(data.length || length);
    this.sendData = sendData;
  }
}

/**
 * Hex string to number Array
 *
 * @param {string | undefined} hexString
 */
export const hexStringToNumberArray = (hexString) =>
  hexString?.match(/[\da-f]{2}/gi)?.map((h) => parseInt(h, 16)) ?? [];
