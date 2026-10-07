export function BrandMark({ className = "" }: { className?: string }) {
  return <span className={`archicovaMark ${className}`.trim()} aria-hidden="true"><img src="/brand/logo-192.png" alt="" width="36" height="36" /></span>;
}
