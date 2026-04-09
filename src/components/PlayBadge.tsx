// Play-button overlay rendered on top of post thumbnails when a post has a
// linked YouTube video (acf.youtube_id). Positioned absolute; parent must be
// relative. Dark translucent backdrop so it reads on both light and dark images.
type Size = "sm" | "md" | "lg";

const SIZE_MAP: Record<Size, { wrap: string; icon: number }> = {
  sm: { wrap: "w-8 h-8", icon: 12 },
  md: { wrap: "w-12 h-12", icon: 18 },
  lg: { wrap: "w-16 h-16", icon: 24 },
};

export default function PlayBadge({ size = "md" }: { size?: Size }) {
  const { wrap, icon } = SIZE_MAP[size];
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center z-[1]">
      <span
        className={`inline-flex items-center justify-center ${wrap} rounded-full bg-black/55 backdrop-blur-sm ring-1 ring-white/50 shadow-lg`}
      >
        <svg
          width={icon}
          height={icon}
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-white ml-0.5"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}
