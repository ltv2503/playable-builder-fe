"use client";

import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { PageLoading } from "@/components/Spinner";

/**
 * All override kinds (boolean/number/string *and* spriteFrame) go through
 * window.__playgroundConfig (see lib/playgroundConfig.ts) whenever we can
 * resolve which component class they belong to — every @playgroundField AND
 * @playgroundAsset default in the built html already reads from there (see
 * src/pipeline/playgroundFields.ts's makePlaygroundFieldsConfigurable /
 * PLAYGROUND_APPLY_ASSET_FN), so this is a pure client-side script swap +
 * reboot, no server round-trip, and it persists into Export too. Only when
 * the class can't be resolved (rare — e.g. registry not populated yet) do we
 * fall back to the older live-instance-mutation script injection.
 */

export default function Home()
{
  const session = useRequireAuth();

  if (!session) return <PageLoading />;

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <div className="w-full h-200 flex items-center justify-center">
        <p className="text-4xl">
        Comming soon ...
        </p>
      </div>
    </div>
  );
}
