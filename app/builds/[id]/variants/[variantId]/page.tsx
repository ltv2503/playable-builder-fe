"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";

import { Button, Dialog, Input } from "@/components/common";
import {
  ArrowLeftIcon,
  LayersIcon,
  RotateDeviceIcon,
  ShareIcon,
} from "@/components/icons";
import { PageLoading, Spinner } from "@/components/Spinner";
import { PlaygroundConfigForm } from "@/components/PlaygroundConfigForm";
import DeviceFrame from "@/components/Preview/DeviceFrame";
import { routes } from "@/lib/routes";

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
    canShare,
    saving,
    saveError,
    saved,
    handleSave,

    shareLink,
    sharing,
    shareError,
    handleCreateShareLink,
    handleRevokeShareLink,

    deviceId,
    setDeviceId,
    selectedDevice,
    previewDevices,
  } = useVariantEditorPage();

  const previewContainerRef = useRef<HTMLDivElement>(null);

  const [deviceScale, setDeviceScale] = useState(1);
  const [rotated, setRotated] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  /**
   * Xoay màn = đổi thật kích thước canvas (hoán vị width/height), không phải chỉ transform: rotate()
   * phần khung hiển thị — vì content bên trong (game Cocos) cần đọc đúng kích thước mới lúc khởi động
   * để tự dàn lại layout theo hướng ngang, không phải thấy y hệt bản dọc nhưng bị vặn nghiêng đi.
   * iframe key bên dưới include `rotated` để ép remount (load lại) mỗi khi đổi hướng.
   */
  const previewDevice = rotated
    ? { ...selectedDevice, width: selectedDevice.height, height: selectedDevice.width }
    : selectedDevice;

  // ------------------------------------------------------------
  // Anim xoay (FLIP kỹ thuật cũ điển): rotateWrapperRef đã LUÔN render đúng kích thước mới (previewDevice)
  // ngay khi rotated đổi — không đợi animation nào. Effect này chỉ lo phần NHÌN như đang xoay: snap tức
  // thời (không transition) về góc xoay khiến box-mới-kích-thước trông y hệt box-cũ-kích-thước, rồi bật
  // lại transition và trả góc xoay về 0 — tạo cảm giác xoay mượt trong lúc bản chất kích thước đã đổi
  // xong từ đầu (để content bên trong load đúng kích thước canvas ngay, không đợi hết animation).
  // ------------------------------------------------------------

  const rotateWrapperRef = useRef<HTMLDivElement>(null);
  const prevRotatedRef = useRef(rotated);

  useLayoutEffect(() => {
    const wasRotated = prevRotatedRef.current;
    prevRotatedRef.current = rotated;

    const el = rotateWrapperRef.current;
    if (!el || wasRotated === rotated) return;

    const preSpinDeg = rotated ? 90 : -90;
    el.style.transition = "none";
    el.style.transform = `rotate(${preSpinDeg}deg)`;
    void el.offsetHeight; // ép reflow để trình duyệt chốt state trên trước khi bật lại transition
    el.style.transition = "transform 350ms ease";
    el.style.transform = "rotate(0deg)";
  }, [rotated]);

  const shareUrl = shareLink && typeof window !== "undefined" ? `${window.location.origin}${routes.share(shareLink.token)}` : null;

  const handleOpenShareDialog = () => {
    setShareDialogOpen(true);
    if (!shareLink) handleCreateShareLink();
  };

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleRevokeAndClose = async () => {
    await handleRevokeShareLink();
    setShareDialogOpen(false);
  };

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

      const scaleX = availableWidth / previewDevice.width;
      const scaleY = availableHeight / previewDevice.height;

      // Không scale lớn hơn 1 để preview không bị phóng to quá mức.
      const scale = Math.min(scaleX, scaleY, 1);

      setDeviceScale(Math.max(scale, 0.1));
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(element);

    return () => observer.disconnect();
  }, [
    previewDevice.width,
    previewDevice.height,
    // previewContainerRef chỉ thật sự mount vào DOM khi previewUrl có giá trị ({previewUrl && (...)}) —
    // ref đổi từ null sang element KHÔNG tự kích hoạt effect chạy lại, nên phải thêm previewUrl vào đây,
    // nếu không lần đầu load trang effect bail ở `!element` và deviceScale kẹt ở 100% cho tới khi đổi device.
    previewUrl,
  ]);

  if (!session) {
    return <PageLoading />;
  }

  return (
    <main className="flex h-full min-h-0 flex-col gap-4 bg-zinc-50 px-6 py-5 dark:bg-black">

      {/* ------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------ */}

      <div className="flex shrink-0 items-center justify-between">
        <div>
          <Link
            href={routes.build(buildId)}
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

        {(canEdit || canShare) && (
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

            {canShare && (
              <Button type="button" variant="secondary" onClick={handleOpenShareDialog}>
                <ShareIcon className="h-4 w-4" />
                Share
              </Button>
            )}

            {canEdit && (
              <Button
                type="button"
                onClick={handleSave}
                disabled={!previewUrl}
                loading={saving}
              >
                {saving ? "Đang lưu..." : "Lưu biến thể"}
              </Button>
            )}
          </div>
        )}
      </div>


      {loadError && (
        <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {loadError}
        </div>
      )}

      {!previewUrl && !loadError && (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Spinner className="h-8 w-8" />
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
                {rotated ? selectedDevice.height : selectedDevice.width} ×{" "}
                {rotated ? selectedDevice.width : selectedDevice.height}
              </span>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setRotated((prev) => !prev)}
                title={rotated ? "Xoay lại màn dọc" : "Xoay ngang màn"}
                className={`hover:bg-zinc-100! dark:hover:bg-zinc-800! ${
                  rotated ? "text-primary!" : "text-zinc-400! hover:text-zinc-700! dark:hover:text-zinc-200!"
                }`}
              >
                <RotateDeviceIcon className="h-4 w-4" />
              </Button>

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
                previewDevice đã hoán vị width/height khi rotated — canvas/iframe được cấp đúng kích
                thước màn ngang thật ngay lập tức (không đợi animation). 2 lớp transform tách riêng:
                lớp ngoài scale-to-fit (%zoom, React re-render mượt theo deviceScale bình thường), lớp
                trong rotate do rotateWrapperRef's useLayoutEffect điều khiển (xem effect phía trên) —
                tách riêng để đổi % zoom không vô tình kích hoạt lại animation xoay và ngược lại.
              */}

              <div
                style={{
                  transform: `scale(${deviceScale})`,
                  transformOrigin: "center center",
                  transition: "transform 300ms ease",
                }}
              >
                <div
                  ref={rotateWrapperRef}
                  style={{
                    width: previewDevice.width,
                    height: previewDevice.height,
                    transform: "rotate(0deg)",
                    transformOrigin: "center center",
                  }}
                >
                  <DeviceFrame device={previewDevice}>
                    <iframe
                      // rotated trong key -> ép remount lúc đổi hướng, để content bên trong (Cocos) load
                      // lại từ đầu và tự đọc đúng kích thước canvas mới, không phải thấy y hệt bản cũ.
                      key={`${previewUrl}-${selectedDevice.id}-${rotated}`}
                      src={previewUrl}
                      title="Variant preview"
                      sandbox="allow-scripts allow-same-origin"
                      style={{
                        display: "block",
                        width: previewDevice.width,
                        height: previewDevice.height,
                        border: "none",
                      }}
                    />
                  </DeviceFrame>
                </div>
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

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen} title="Link xem công khai biến thể">
        {sharing && !shareLink && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Spinner className="h-4 w-4" />
            Đang tạo link...
          </div>
        )}

        {shareError && <p className="text-sm text-red-600 dark:text-red-400">{shareError}</p>}

        {shareUrl && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-zinc-500">
              Ai có link này đều xem được (không cần đăng nhập, đã vá đúng config của biến thể "{variant?.name}"),{" "}
              {shareLink?.expiresAt
                ? `hết hạn ngày ${new Date(shareLink.expiresAt).toLocaleString("vi-VN")}.`
                : "không hết hạn."}
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={shareUrl} onFocus={(e) => e.target.select()} className="flex-1 font-mono text-xs" />
              <Button type="button" variant="outline" size="sm" onClick={handleCopyShareUrl}>
                {linkCopied ? "Đã copy" : "Copy"}
              </Button>
            </div>
            <Button type="button" variant="danger" size="sm" onClick={handleRevokeAndClose} loading={sharing} className="self-start">
              Thu hồi link
            </Button>
          </div>
        )}
      </Dialog>
    </main>
  );
}