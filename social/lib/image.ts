/**
 * Whether next/image may run this src through the optimizer, i.e. its host is
 * in next.config.ts remotePatterns. Imported catalogue videos bring
 * thumbnails from any host, which the optimizer refuses with a runtime error —
 * pass `unoptimized={!isOptimizableImage(src)}` so those render as-is.
 */
export const isOptimizableImage = (src: string) => {
  if (src.startsWith("/")) return true;
  try {
    const { hostname } = new URL(src);
    return (
      hostname === "image.mux.com" ||
      hostname === "i.ytimg.com" ||
      hostname.endsWith(".supabase.co")
    );
  } catch {
    return false;
  }
};
