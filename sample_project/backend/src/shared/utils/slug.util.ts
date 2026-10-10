/**
 * Generates a URL-friendly slug from a Vietnamese/Unicode string.
 *
 * @example
 *   generateSlug('Đà Nẵng')        => 'da-nang'
 *   generateSlug('FPT Plaza 1')     => 'fpt-plaza-1'
 *   generateSlug('Tòa nhà Trung Tâm') => 'toa-nha-trung-tam'
 */
export function generateSlug(text: string): string {
  return text
    .normalize('NFD')                         // Decompose Vietnamese chars
    .replace(/[\u0300-\u036f]/g, '')           // Remove diacritics
    .replace(/đ/gi, 'd')                       // Replace đ/Đ
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')              // Remove non-alphanumeric
    .replace(/\s+/g, '-')                       // Spaces → hyphens
    .replace(/-+/g, '-')                        // Collapse multiple hyphens
    .replace(/^-|-$/g, '');                     // Trim leading/trailing hyphens
}
