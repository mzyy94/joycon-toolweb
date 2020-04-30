const setupJoyconStyle = (object, style) => {
  object.contentDocument
    .querySelectorAll("path[style^='fill:#00bbdb']")
    .forEach(path => path.classList.add("left-joycon-body"));
  object.contentDocument
    .querySelectorAll("path[style^='fill:#ff5f53']")
    .forEach(path => path.classList.add("right-joycon-body"));
  object.contentDocument.documentElement.append(style);

  style.sheet.addRule(".right-joycon-body", "fill: #fff !important");
  style.sheet.addRule(".left-joycon-body", "fill: #fff !important");
};

const kindOfController = ["unknown", "left-joycon", "right-joycon", "procon"];

const SubCommand = {
  DeviceInfo: 0x02,
  ReadSPI: 0x10
};

const SPIAddr = {
  DeviceColor: 0x6050
};

const bufferToHexString = (buffer, start, length) =>
  Array.from(new Uint8Array(buffer.slice(start, start + length)))
    .map(v => v.toString(16).padStart(2, "0"))
    .join("");

const setupInputReportListener = device => {
  device.addEventListener("inputreport", ({ target, reportId, data }) => {
    if (reportId == 0x21) {
      const offset = 14;
      switch (data.getUint8(13)) {
        case SubCommand.DeviceInfo: {
          const macAddr = Array.from(
            new Uint8Array(data.buffer.slice(4 + offset, 10 + offset))
          )
            .map(b => b.toString(16).padStart(2, "0"))
            .join(":");
          console.log(
            `Firmware version: ${data.getUint8(0 + offset)}.${data.getUint8(
              1 + offset
            )}`
          );
          console.log(
            "Controller Type:",
            kindOfController[data.getUint8(2 + offset)]
          );
          console.log(`Mac address of ${target.productName}:`, macAddr);
          break;
        }
        case SubCommand.ReadSPI: {
          const addr = data.getUint16(offset, true);
          const len = data.getUint8(4 + offset);
          switch (addr) {
            case SPIAddr.DeviceColor: {
              const bodyColor = bufferToHexString(data.buffer, 5 + offset, 3);
              const buttonColor = bufferToHexString(data.buffer, 8 + offset, 3);
              console.log({ bodyColor, buttonColor });
              break;
            }
            default: {
              const hex = bufferToHexString(data.buffer, 5 + offset, len);
              console.log(addr.toString(16).padStart(4, "0"), len, hex);
            }
          }
          break;
        }
      }
    }
  });
};

const sendSubCommand = async (device, subCommand, params = []) => {
  const data = [1, 0, 1, 64, 64, 0, 1, 64, 64, subCommand, ...params];
  device.sendReport(0x01, new Uint8Array(data));
};

const readSPIRequest = async (device, addr, length) => {
  const buffer = new Uint8Array(5);
  const dataView = new DataView(buffer.buffer);
  dataView.setUint16(0, addr, true);
  dataView.setUint8(4, length);
  sendSubCommand(device, SubCommand.ReadSPI, buffer);
};

const connectController = () =>
  navigator.hid
    .requestDevice({ filters: [{ vendorId: 0x057e }] })
    .then(devices => {
      devices.forEach(async device => {
        if (!device.opened) {
          await device.open();
        }
        console.log(device.productName, "connected");

        setupInputReportListener(device);

        await sendSubCommand(device, SubCommand.DeviceInfo);
        await new Promise(resolve => setTimeout(resolve, 300));
        await readSPIRequest(device, SPIAddr.DeviceColor, 16);
      });
    });

const main = () => {
  const object = document.querySelector("object");
  const style = document.createElement("style");
  object.addEventListener("load", ({ target: object }) => {
    setupJoyconStyle(object, style);
  });
  const button = document.querySelector("button");
  button.addEventListener("click", connectController);
};

document.addEventListener("DOMContentLoaded", main);
