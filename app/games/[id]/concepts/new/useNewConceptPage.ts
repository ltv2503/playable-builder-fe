"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { mutate } from "swr";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { api } from "@/lib/api";
import { listPngImagesInZip, type ZipPngEntry } from "@/lib/cocos/zipPngPreview";
import { swrKeys } from "@/lib/api/swr-keys";

export type PngMode = "off" | "palette" | "webp";

interface PngImageState extends ZipPngEntry {
  compress: boolean;
}

export function useNewConceptPage() {
  const { id: gameId } = useParams<{ id: string }>();
  const session = useRequireAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pngMode, setPngMode] = useState<PngMode>("palette");
  const [pngImages, setPngImages] = useState<PngImageState[]>([]);
  const [isScanningZip, setIsScanningZip] = useState(false);

  const scanZip = async (candidate: File) => {
    setIsScanningZip(true);
    setPngImages([]);
    try {
      const images = await listPngImagesInZip(candidate);
      setPngImages(images.map((img) => ({ ...img, compress: true })));
    } catch {
      // zip lạ/không đọc được trước — không chặn submit, lỗi thật sẽ hiện khi build ở server
    } finally {
      setIsScanningZip(false);
    }
  };

  const handleFileChange = (newFile: File | null) => {
    setFile(newFile);
    if (newFile) scanZip(newFile);
    else setPngImages([]);
  };

  const togglePngCompress = (path: string) => {
    setPngImages((prev) => prev.map((img) => (img.path === path ? { ...img, compress: !img.compress } : img)));
  };

  const toggleAllPngCompress = (value: boolean) => {
    setPngImages((prev) => prev.map((img) => ({ ...img, compress: value })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !file) return;
    setUploading(true);
    setError(null);
    try {
      const noCompressPaths = pngImages.filter((img) => !img.compress).map((img) => img.path);
      const build = await api.uploadBuild(session.accessToken, gameId, name, file, { pngMode, noCompressPaths });
      // Phải truyền fetcher — không có useSWR(builds(gameId)) nào đang mounted ở
      // trang này để mutate(key) trần biết cách lấy lại dữ liệu (xem giải thích ở
      // useNewVariantPage.ts).
      await mutate(swrKeys.builds(gameId), () => api.listBuilds(session.accessToken, gameId));
      router.push(`/builds/${build.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setUploading(false);
    }
  };

  return {
    session,
    gameId,
    name,
    setName,
    file,
    setFile: handleFileChange,
    uploading,
    error,
    handleSubmit,
    pngMode,
    setPngMode,
    pngImages,
    isScanningZip,
    togglePngCompress,
    toggleAllPngCompress,
  };
}
