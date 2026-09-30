import React from "react";
interface DeviceFrameProps {
  device: {
    width: number;
    height: number;
    radius: number;
    type: string;
  };
  children: React.ReactNode;
}
const DeviceFrame = ({ device, children }: DeviceFrameProps) => {
  return (
    <div
      className="relative shrink-0 bg-white p-[14px] shadow-xl"
      style={{
        width: device.width + 28,
        height: device.height + 28,
        borderRadius: device.radius + 14,
      }}
    >
      {/* Screen */}
      <div
        className="relative h-full w-full overflow-hidden bg-black"
        style={{
          borderRadius: device.radius,
        }}
      >
        {children}

        {/* iPhone notch — chỉ hợp lý ở chiều dọc; vị trí này không tính lại được cho chiều ngang nên ẩn đi khi xoay màn. */}
        {device.type === "phone" && device.width < device.height && (
          <div
            className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 bg-black"
            style={{
              width: 170,
              height: 30,
              borderBottomLeftRadius: 18,
              borderBottomRightRadius: 18,
            }}
          />
        )}

        {/* iPhone home indicator */}
        {device.type === "phone" && device.height === 812 && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 h-[5px] w-[70px] -translate-x-1/2 rounded-full bg-white" />
        )}
      </div>
    </div>
  );
};

export default DeviceFrame;
