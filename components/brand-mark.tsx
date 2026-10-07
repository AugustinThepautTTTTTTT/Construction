export function BrandMark({ className = "brandMark" }: { className?: string }) {
  return <span className={`${className} archicovaMark`} aria-hidden="true"><img src="/brand/logo-192.png" alt="" width="36" height="36" /></span>;
}
