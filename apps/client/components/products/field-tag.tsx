/** A small word after a field's name that says whether it must be filled in. */
export function Req() {
  return <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Required</span>;
}

export function Opt() {
  return <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Optional</span>;
}

/** One line at the top of a form that explains the two words. */
export function RequiredLegend() {
  return (
    <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-foreground">
      Fields marked <Req /> must be filled in. Fields marked <Opt /> can be left empty.
    </p>
  );
}
