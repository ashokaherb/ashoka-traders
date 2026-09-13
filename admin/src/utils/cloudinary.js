/**
 * Returns a smaller version of a Cloudinary image for thumbnails and cards.
 *
 * Uploads are stored at up to 1000px wide, so using the stored URL as-is makes a 200px card
 * download the full-size file. Cloudinary resizes on the fly when transformation parameters
 * are added after "/upload/":
 *   .../image/upload/v123/products/abc.jpg
 *   -> .../image/upload/w_400,c_limit,f_auto,q_auto/v123/products/abc.jpg
 *
 * `width` is the pixel width to fetch - pass about 2x the displayed CSS width so the image
 * stays sharp on high-density (retina/phone) screens. c_limit never upscales a smaller original.
 * Anything that isn't a Cloudinary upload URL (placeholders, local /uploads) is returned unchanged.
 *
 * @param {string} url
 * @param {number} width
 * @returns {string}
 */
export function getCloudinaryThumbnail(url, width) {
  if (typeof url !== "string" || !url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) {
    return url;
  }
  const [base, rest] = url.split("/image/upload/");
  return `${base}/image/upload/w_${Math.round(width)},c_limit,f_auto,q_auto/${rest}`;
}
