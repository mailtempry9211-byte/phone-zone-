import { useEffect } from "react";

export interface ScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
}

/**
 * High-performance, lightweight IntersectionObserver animation hook.
 * Adds 'is-revealed' class to elements with [data-reveal] when scrolled into view.
 * Fully respects user's prefers-reduced-motion system setting.
 */
export function useScrollReveal(options: ScrollRevealOptions = {}) {
  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      document.querySelectorAll("[data-reveal]").forEach((el) => {
        el.classList.add("is-revealed");
      });
      return;
    }

    const { threshold = 0.12, rootMargin = "0px 0px -40px 0px" } = options;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            // Unobserve once revealed for performance
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin }
    );

    const elements = document.querySelectorAll("[data-reveal]");
    elements.forEach((el) => {
      el.classList.add("is-revealed");
      observer.observe(el);
    });

    return () => {
      elements.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [options.threshold, options.rootMargin]);
}

