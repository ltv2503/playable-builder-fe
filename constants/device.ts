const DEVICES = {
  iphoneX: {
    name: "iPhone X/XS",
    width: 375,
    height: 812,
    type: "phone",
    radius: 38,
  },
  iphone678: {
    name: "iPhone 6/7/8",
    width: 375,
    height: 667,
    type: "phone",
    radius: 38,
  },
  ipad: {
    name: "iPad",
    width: 768,
    height: 1024,
    type: "tablet",
    radius: 32,
  },
} as const;

type DeviceKey = keyof typeof DEVICES;
