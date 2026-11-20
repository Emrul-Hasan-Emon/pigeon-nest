export function sellerInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/** Photo or initials inside the plumage-sheen ring. */
export function SellerAvatar({ name, url, size = 48 }: { name: string; url: string | null; size?: number }) {
  return (
    <div className="shrink-0 rounded-full bg-gradient-to-br from-[#2e8f8b] via-[#4a6fa5] to-[#6a55a8] p-[2px]">
      <div
        className="flex items-center justify-center overflow-hidden rounded-full bg-st-ink font-display font-semibold text-white"
        style={{ width: size, height: size, fontSize: size * 0.34 }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          sellerInitials(name)
        )}
      </div>
    </div>
  );
}
