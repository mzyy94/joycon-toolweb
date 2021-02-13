// SPDX-License-Identifier: Apache-2.0
// Copyright 2021 @mzyy94

// @ts-check

export class BufferView extends DataView {
  /** @private */
  _cursor = 0;

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
}

/**
 * Hex string to number Array
 *
 * @param {string | undefined} hexString
 */
export const hexStringToNumberArray = (hexString) =>
  hexString?.match(/[\da-f]{2}/gi)?.map((h) => parseInt(h, 16)) ?? [];
