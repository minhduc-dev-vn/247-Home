'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

type MotionStyle = CSSProperties & { '--motion-delay': string };

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.dataset.motionReady = 'true';
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.dataset.motionVisible = 'true';
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.dataset.motionVisible = 'true';
        observer.disconnect();
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn('motion-reveal', className)}
      data-motion-visible="false"
      ref={elementRef}
      style={{ '--motion-delay': `${Math.max(0, delay)}ms` } as MotionStyle}
    >
      {children}
    </div>
  );
}
