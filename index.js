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
  const style = object.contentDocument?.querySelector("style");
  /**
   * @param {string} selector
   * @param {string | undefined} color
   */
  const replaceStyle = (selector, color) => {
    if (!style || !style.sheet) {
      return;
    }
    const index = Array.from(style.sheet.rules).findIndex(
      // @ts-ignore
      (rule) => rule.selectorText == selector
    );
    style.sheet.insertRule(`${selector} { fill: ${color} }`, index + 1);
    style.sheet.deleteRule(index);
  };
  replaceStyle(".body-shell", controller.colors?.body);
  if (controller.type == "procon") {
    replaceStyle(".left-grip", controller.colors?.leftGrip);
    replaceStyle(".right-grip", controller.colors?.rightGrip);
  }
  replaceStyle(".button", controller.colors?.button);
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
  // @ts-ignore
  navigator.hid?.requestDevice({ filters: [{ vendorId: 0x057e }] }).then(async (
    /** @type {import("./controller.js").HIDDevice[]} */ devices
  ) => {
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
    } else {
      return Promise.reject("unavailable");
    }
  }) ?? Promise.reject("unavailable");

Object.assign(window, { previewColor, setBatteryCapacity, connectController });
