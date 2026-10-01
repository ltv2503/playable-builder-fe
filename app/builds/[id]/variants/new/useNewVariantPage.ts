"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { mutate } from "swr";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { api } from "@/lib/api";
import { swrKeys } from "@/lib/api/swr-keys";
import { routes } from "@/lib/routes";

export function useNewVariantPage() {
  const { id: buildId } = useParams<{ id: string }>();
  const session = useRequireAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setCreating(true);
    setError(null);
    try {
      const variant = await api.createVariant(session.accessToken, buildId, name);
      // mutate(key) không kèm data/fetcher chỉ thật sự gọi lại API khi có 1
      // useSWR(key) đang mounted lúc gọi — ở trang này thì không (danh sách
      // biến thể nằm ở trang build detail, đã unmount). Phải tự truyền fetcher
      // thì mutate mới có cách nào để lấy lại dữ liệu mới.
      await mutate(swrKeys.variants(buildId), () => api.listVariants(session.accessToken, buildId));
      router.push(routes.buildVariant(buildId, variant.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCreating(false);
    }
  };

  return { session, buildId, name, setName, creating, error, handleSubmit };
}
