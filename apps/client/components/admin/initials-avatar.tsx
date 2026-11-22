const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

/** A person's photo, or their initials on a brass tint when there is none. */
export function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-10 w-10 rounded-full border border-border object-cover" />;
  }
  return (
    <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-full bg-brass-soft text-xs font-semibold text-brass-ink ring-1 ring-brass/25">
      {initials(name)}
    </span>
  );
}
