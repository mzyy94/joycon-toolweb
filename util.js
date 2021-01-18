// SPDX-License-Identifier: Apache-2.0
// Copyright 2021 @mzyy94

// @ts-check

/**
 * ArrayBuffer to hex string
 *
 * @param {ArrayBuffer} buffer
 * @param {number} start
 * @param {number} length
 * @param {?string} sep
 */
export const bufferToHexString = (buffer, start, length, sep = "") =>
  Array.from(new Uint8Array(buffer.slice(start, start + length)))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join(sep);

/**
 * Hex string to number Array
 *
 * @param {string} hexString
 */
export const hexStringToNumberArray = (hexString) =>
  hexString.match(/[\da-f]{2}/gi).map((h) => parseInt(h, 16));
