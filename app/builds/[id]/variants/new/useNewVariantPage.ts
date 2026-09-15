"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/use-require-auth";
import { api } from "@/lib/api";

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
      router.push(`/builds/${buildId}/variants/${variant.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCreating(false);
    }
  };

  return { session, buildId, name, setName, creating, error, handleSubmit };
}
