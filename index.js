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
  const capacity = object.contentDocument.querySelector("#capacity");
  capacity.setAttribute("width", String(416 * level));
};

const connectController = () =>
  navigator.hid
    ? navigator.hid
        .requestDevice({ filters: [{ vendorId: 0x057e }] })
        .then((devices) => {
          devices.forEach(async (device) => {
            await device.close();
            await device.open();
            console.log(device.productName, "connected");

            const controller = new Controller(device);
            await controller.startConnection();
            await controller.fetchDeviceInfo();

            console.table(controller);

            document.body.dispatchEvent(
              new CustomEvent("register-controller", { detail: { controller } })
            );
          });
        })
    : Promise.reject(new Error("WebHID API not found"));

Object.assign(window, { previewColor, setBatteryCapacity, connectController });
