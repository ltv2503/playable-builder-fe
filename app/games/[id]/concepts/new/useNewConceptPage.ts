"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/use-require-auth";
import { api } from "@/lib/api";

export function useNewConceptPage() {
  const { id: gameId } = useParams<{ id: string }>();
  const session = useRequireAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !file) return;
    setUploading(true);
    setError(null);
    try {
      const build = await api.uploadBuild(session.accessToken, gameId, name, file);
      router.push(`/builds/${build.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setUploading(false);
    }
  };

  return { session, gameId, name, setName, file, setFile, uploading, error, handleSubmit };
}
