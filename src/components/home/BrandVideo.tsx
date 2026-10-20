"use client";

import { useEffect, useRef, useState } from "react";

// Phones get the full 16:9 film. Tablets and desktop get a wide 2.4:1 version, cropped when encoded
// (top and bottom trimmed, framed scene by scene so faces and products stay in shot).
const PHONE = { src: "/videos/urbanlane-brand-v3-720.mp4", poster: "/videos/urbanlane-brand-v3-poster.jpg" }; // 3.7 MB
const WIDE = { src: "/videos/urbanlane-brand-v3-wide.mp4", poster: "/videos/urbanlane-brand-v3-poster-wide.jpg" }; // 6.1 MB
const PHONE_QUERY = "(max-width: 767px)";

/**
 * Homepage brand film, in the same centred column as the other sections.
 * Silent, looping and muted so browsers allow autoplay. Nothing is downloaded until the film
 * scrolls near the screen, and it pauses while off screen. Visitors who ask for reduced motion
 * get the poster with a play button instead of autoplay.
 */
export function BrandVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [poster, setPoster] = useState(WIDE.poster);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const userPausedRef = useRef(false);
  userPausedRef.current = userPaused;

  useEffect(() => {
    if (window.matchMedia(PHONE_QUERY).matches) setPoster(PHONE.poster);
  }, []);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setUserPaused(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !userPausedRef.current) {
          el.play().catch(() => setPlaying(false));
        } else if (!entry.isIntersecting) {
          el.pause();
        }
      },
      { rootMargin: "200px 0px", threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const el = video.current;
    if (!el) return;
    if (el.paused) {
      setUserPaused(false);
      el.play().catch(() => {});
    } else {
      setUserPaused(true);
      el.pause();
    }
  };

  return (
    <section aria-label="Urban Lane brand film" className="container-site pb-8">
      <div className="relative overflow-hidden rounded-2xl bg-line-soft">
        <video
          ref={video}
          className="block aspect-video w-full object-cover md:aspect-[12/5]"
          poster={poster}
          muted
          loop
          playsInline
          preload="none"
          aria-label="Urban Lane: original UK high-street brands delivered across Pakistan"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        >
          <source src={PHONE.src} type="video/mp4" media={PHONE_QUERY} />
          <source src={WIDE.src} type="video/mp4" />
        </video>

        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause video" : "Play video"}
          className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:bottom-5 md:right-5"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
            </svg>
          )}
        </button>
      </div>
    </section>
  );
}
