// SPDX-License-Identifier: Apache-2.0
// Copyright 2020 @mzyy94

// @ts-check

import { Controller } from "./controller.js";

/**
 * Apply preview color to svg element class
 *
 * @param {HTMLObjectElement} object
 * @param {Controller} controller
 */
const previewColor = (object, controller) => {
  const sheet = object.contentDocument?.querySelector("style")?.sheet;
  if (!sheet) return;
  /**
   * @param {string} selector
   * @param {string} color
   */
  const replaceStyle = (selector, color) => {
    const index = Array.from(sheet.rules).findIndex(
      (rule) => rule.selectorText == selector
    );
    sheet.insertRule(`${selector} { fill: ${color} }`, index + 1);
    sheet.deleteRule(index);
  };
  replaceStyle(".body-shell", controller.bodyColor);
  if (controller.type == "procon") {
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
  const capacity = object.contentDocument?.querySelector("#capacity");
  capacity?.setAttribute("width", String(416 * level));
};

const connectController = () =>
  navigator.hid?.requestDevice({ filters: [{ vendorId: 0x057e }] })
    .then(async (devices) => {
      if (devices.length == 1) {
        const device = devices[0];
        await device.close();
        await device.open();
        console.log(device.productName, "connected");

        const controller = new Controller(device);
        await controller.startConnection();
        await controller.fetchDeviceInfo();

        console.table(controller);
        return controller;
      } else if (devices.length > 1) {
        return Promise.reject("Please select only one controller.");
      }
    })
  ?? Promise.reject("unavailable");

Object.assign(window, { previewColor, setBatteryCapacity, connectController });
