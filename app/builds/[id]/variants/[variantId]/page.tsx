"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/common";
import {
  ArrowLeftIcon,
  LayersIcon,
} from "@/components/icons";
import { PageLoading } from "@/components/Spinner";
import { PlaygroundConfigForm } from "@/components/PlaygroundConfigForm";
import DeviceFrame from "@/components/Preview/DeviceFrame";

import { useVariantEditorPage } from "./useVariantEditorPage";

export default function VariantEditorPage() {
  const {
    session,
    buildId,
    build,
    variant,
    config,
    setConfig,
    previewUrl,
    loadError,
    canEdit,
    saving,
    saveError,
    saved,
    handleSave,

    deviceId,
    setDeviceId,
    selectedDevice,
    previewDevices,
  } = useVariantEditorPage();

  const previewContainerRef = useRef<HTMLDivElement>(null);

  const [deviceScale, setDeviceScale] = useState(1);

  // ------------------------------------------------------------
  // Auto scale device để luôn vừa vùng preview
  // ------------------------------------------------------------

  useEffect(() => {
    const element = previewContainerRef.current;

    if (!element) return;

    const updateScale = () => {
      const rect = element.getBoundingClientRect();

      // Khoảng trống xung quanh device
      const padding = 48;

      const availableWidth = rect.width - padding;
      const availableHeight = rect.height - padding;

      const deviceWidth = selectedDevice.width;
      const deviceHeight = selectedDevice.height;

      const scaleX = availableWidth / deviceWidth;
      const scaleY = availableHeight / deviceHeight;

      // Không scale lớn hơn 1 để preview không bị phóng to quá mức.
      const scale = Math.min(scaleX, scaleY, 1);

      setDeviceScale(Math.max(scale, 0.1));
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(element);

    return () => observer.disconnect();
  }, [
    selectedDevice.width,
    selectedDevice.height,
  ]);

  if (!session) {
    return <PageLoading />;
  }

  return (
    <main className="flex flex-1 flex-col gap-4 bg-zinc-50 px-6 py-5 dark:bg-black">

      {/* ------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------ */}

      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/builds/${buildId}`}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            {build?.name ?? "Quay lại concept"}
          </Link>

          <div className="mt-0.5 flex items-center gap-2">
            <LayersIcon className="h-5 w-5 text-primary" />

            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {variant?.name ?? "Biến thể"}
            </h1>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                ✓ Đã lưu
              </span>
            )}

            {saveError && (
              <span className="text-xs text-red-600 dark:text-red-400">
                {saveError}
              </span>
            )}

            <Button
              type="button"
              onClick={handleSave}
              disabled={!previewUrl}
              loading={saving}
            >
              {saving ? "Đang lưu..." : "Lưu biến thể"}
            </Button>
          </div>
        )}
      </div>


      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {loadError}
        </div>
      )}

      {previewUrl && (
        <div className="flex min-h-0 flex-1 gap-5">

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">


            <div className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900">


              <div className="relative">
                <select
                  value={deviceId}
                  onChange={(e) =>
                    setDeviceId(e.target.value)
                  }
                  className="
                    h-8
                    min-w-[170px]
                    appearance-none
                    rounded-lg
                    border
                    border-zinc-200
                    bg-white
                    px-3
                    pr-8
                    text-xs
                    font-medium
                    text-zinc-700
                    outline-none
                    transition
                    hover:border-zinc-300
                    focus:border-zinc-400
                    dark:border-zinc-700
                    dark:bg-zinc-800
                    dark:text-zinc-200
                    dark:hover:border-zinc-600
                  "
                >
                  {previewDevices.map((device) => (
                    <option
                      key={device.id}
                      value={device.id}
                    >
                      {device.name}
                    </option>
                  ))}
                </select>

                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">
                  ▼
                </span>
              </div>

              {/* Resolution */}

              <span className="text-[11px] text-zinc-400">
                {selectedDevice.width} ×{" "}
                {selectedDevice.height}
              </span>

              <div className="flex-1" />

              {/* Zoom */}

              <span className="text-[11px] tabular-nums text-zinc-400">
                {Math.round(deviceScale * 100)}%
              </span>

            </div>


            <div
              ref={previewContainerRef}
              className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
            >
              {/* 
                Scale bằng transform.
                
                Quan trọng:
                iframe vẫn có width/height thật của device.
                Chỉ phần hiển thị bên ngoài được scale.
              */}

              <div
                style={{
                  width: selectedDevice.width,
                  height: selectedDevice.height,
                  transform: `scale(${deviceScale})`,
                  transformOrigin: "center center",
                }}
              >
                <DeviceFrame device={selectedDevice}>
                  <iframe
                    key={`${previewUrl}-${selectedDevice.id}`}
                    src={previewUrl}
                    title="Variant preview"
                    sandbox="allow-scripts allow-same-origin"
                    style={{
                      display: "block",
                      width: selectedDevice.width,
                      height: selectedDevice.height,
                      border: "none",
                    }}
                  />
                </DeviceFrame>
              </div>
            </div>
          </div>

          <div className="flex w-100 shrink-0 flex-col gap-3 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900">

            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Chỉnh sửa
            </h2>

            {!canEdit && (
              <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                Bạn chỉ có quyền xem, không lưu được thay đổi.
              </p>
            )}

            <PlaygroundConfigForm
              fieldsRegistry={
                build?.fieldsRegistry ?? null
              }
              config={config}
              onChange={setConfig}
              readOnly={!canEdit}
            />
          </div>
        </div>
      )}
    </main>
  );
}