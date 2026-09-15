"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/use-require-auth";
import { api, fetchIconFromAndroidUrl } from "@/lib/api";

const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const ICON_FETCH_DEBOUNCE_MS = 600;

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isGooglePlayUrl(url: string): boolean {
  try {
    return new URL(url).hostname === "play.google.com";
  } catch {
    return false;
  }
}

export function useNewGamePage() {
  const session = useRequireAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [androidUrl, setAndroidUrl] = useState("");
  const [iosUrl, setIosUrl] = useState("");
  const [icon, setIcon] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  /** "manual" = user tự chọn ảnh -> không tự động ghi đè nữa; "auto" = do tool tự lấy từ link Android. */
  const [iconSource, setIconSource] = useState<"manual" | "auto" | null>(null);
  /** Tương tự iconSource nhưng cho tên game — chỉ tự điền khi user chưa tự gõ tên. */
  const [nameSource, setNameSource] = useState<"manual" | "auto" | null>(null);
  const [fetchingIcon, setFetchingIcon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview cục bộ (chưa upload) — thu hồi object URL cũ mỗi khi đổi ảnh/rời trang.
  useEffect(() => {
    if (!icon) {
      setIconPreview(null);
      return;
    }
    const url = URL.createObjectURL(icon);
    setIconPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [icon]);

  // Tự lấy icon + tên từ link Google Play khi user dán/nhập link — chỉ khi chưa tự chọn/gõ tay.
  useEffect(() => {
    if (!session || (iconSource === "manual" && nameSource === "manual") || !isGooglePlayUrl(androidUrl)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setFetchingIcon(true);
      fetchIconFromAndroidUrl(session.accessToken, androidUrl)
        .then(({ file, name: fetchedName }) => {
          if (cancelled) return;
          if (iconSource !== "manual") {
            setIcon(file);
            setIconSource("auto");
          }
          if (nameSource !== "manual" && fetchedName) {
            setName(fetchedName);
            if (!slugTouched) setSlug(slugify(fetchedName));
            setNameSource("auto");
          }
        })
        .catch(() => undefined) // lấy không được thì im lặng, không chặn form
        .finally(() => {
          if (!cancelled) setFetchingIcon(false);
        });
    }, ICON_FETCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [androidUrl, session, iconSource, nameSource, slugTouched]);

  const handleNameChange = (value: string) => {
    setName(value);
    setNameSource(value ? "manual" : null);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleSlugChange = (value: string) => {
    setSlug(value);
    setSlugTouched(true);
  };

  const handleIconFileChange = (file: File | null) => {
    setIcon(file);
    setIconSource(file ? "manual" : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      const game = await api.createGame(session.accessToken, {
        name,
        slug: slug || slugify(name),
        androidUrl: androidUrl || undefined,
        iosUrl: iosUrl || undefined,
        icon: icon || undefined,
      });
      router.push(`/games/${game.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  return {
    session,
    name,
    slug,
    androidUrl,
    iosUrl,
    icon,
    iconPreview,
    fetchingIcon,
    handleIconFileChange,
    submitting,
    error,
    handleNameChange,
    handleSlugChange,
    setAndroidUrl,
    setIosUrl,
    handleSubmit,
  };
}
