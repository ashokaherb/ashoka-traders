import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import api from "../api/axios";
import { ChevronLeft, ChevronRight } from "./icons";

const AUTOPLAY_MS = 4000;

/**
 * Full-width, auto-sliding banner carousel, managed entirely from Admin > Banners.
 * Sits right above "Shop by Category" on both desktop (below the Phase 6 hero) and
 * mobile (where that hero is hidden entirely, so this becomes the homepage's main
 * visual banner instead).
 *
 * Renders nothing at all when there are 0 active banners - never an empty shell.
 */
export default function BannerCarousel() {
  const [banners, setBanners] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  // loop:true so autoplay/arrows can wrap past the last slide back to the first.
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });

  useEffect(() => {
    api
      .get("/banners/active")
      .then((res) => setBanners(res.data))
      .catch(() => setBanners([]))
      .finally(() => setLoaded(true));
  }, []);

  const scrollTo = useCallback((index) => emblaApi?.scrollTo(index), [emblaApi]);
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // Keep the active dot in sync as the user swipes/drags manually (not just autoplay).
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => emblaApi.off("select", onSelect);
  }, [emblaApi]);

  // Auto-slide every ~4s. A single slide has nothing to advance to, so skip the timer.
  useEffect(() => {
    if (!emblaApi || banners.length <= 1) return;
    const timer = setInterval(() => emblaApi.scrollNext(), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [emblaApi, banners.length]);

  if (!loaded || banners.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4">
      <div className="relative rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {banners.map((banner) => (
              <div
                key={banner._id}
                className="relative flex-[0_0_100%] aspect-[16/9] sm:aspect-[3/1] bg-cream-dark"
              >
                <BannerSlide banner={banner} />
              </div>
            ))}
          </div>
        </div>

        {/* Manual arrows - desktop only, since touch swipe already covers mobile */}
        {banners.length > 1 && (
          <>
            <button
              type="button"
              onClick={scrollPrev}
              aria-label="Previous slide"
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white items-center justify-center shadow"
            >
              <ChevronLeft className="w-5 h-5 text-brand-700" />
            </button>
            <button
              type="button"
              onClick={scrollNext}
              aria-label="Next slide"
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white items-center justify-center shadow"
            >
              <ChevronRight className="w-5 h-5 text-brand-700" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {banners.length > 1 && (
          <div className="absolute bottom-2.5 sm:bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((banner, index) => (
              <button
                key={banner._id}
                type="button"
                onClick={() => scrollTo(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  index === selectedIndex ? "w-5 bg-white" : "w-1.5 bg-white/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** One slide's image (+ optional title overlay), wrapped in a link if it has one. */
function BannerSlide({ banner }) {
  const content = (
    <>
      <img
        src={banner.image}
        alt={banner.title || ""}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
      {banner.title && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-transparent flex items-end">
          <p className="text-white font-semibold text-base sm:text-2xl px-4 pb-4 sm:px-8 sm:pb-6 drop-shadow-md max-w-[80%]">
            {banner.title}
          </p>
        </div>
      )}
    </>
  );

  if (!banner.linkUrl) {
    return <div className="absolute inset-0">{content}</div>;
  }

  // A relative path (e.g. "/category/spices") uses react-router's Link for a client-
  // side navigation; anything else is treated as a full external URL.
  if (banner.linkUrl.startsWith("/")) {
    return (
      <Link to={banner.linkUrl} className="absolute inset-0 block">
        {content}
      </Link>
    );
  }
  return (
    <a
      href={banner.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute inset-0 block"
    >
      {content}
    </a>
  );
}
