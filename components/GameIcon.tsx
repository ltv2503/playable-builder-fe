import type { ApiGame } from "@/lib/api";

const GRADIENTS = [
  "from-orange-400 to-amber-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-fuchsia-400 to-purple-500",
  "from-rose-400 to-pink-500",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

interface Props {
  game: ApiGame;
  className?: string;
}

export function GameIcon({ game, className = "h-11 w-11 rounded-xl text-base" }: Props) {
  if (game.iconUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={game.iconUrl} alt={game.name} className={`shrink-0 object-cover ${className}`} />;
  }
  return (
    <div className={`flex shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white ${gradientFor(game.id)} ${className}`}>
      {game.name.charAt(0).toUpperCase()}
    </div>
  );
}
