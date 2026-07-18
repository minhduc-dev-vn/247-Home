import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import {
  WarrantyStatusBadge,
  WarrantyTimeline,
  warrantyStatusPresentation,
  warrantyTimelineStates,
} from '@/components/warranty/warranty-presentation';

describe('customer warranty presentation', () => {
  it('uses a resolved or rejected branch without presenting both as sequential states', () => {
    expect(warrantyTimelineStates('RESOLVED')).toEqual([
      'SUBMITTED',
      'IN_REVIEW',
      'RESOLVED',
      'CLOSED',
    ]);
    expect(warrantyTimelineStates('REJECTED')).toEqual([
      'SUBMITTED',
      'IN_REVIEW',
      'REJECTED',
      'CLOSED',
    ]);
  });

  it('renders accessible status and timeline components from backend state', () => {
    const badge = renderToStaticMarkup(
      createElement(WarrantyStatusBadge, { status: 'IN_REVIEW' }),
    );
    const timeline = renderToStaticMarkup(
      createElement(WarrantyTimeline, { status: 'REJECTED' }),
    );
    expect(badge).toContain(warrantyStatusPresentation.IN_REVIEW.label);
    expect(timeline).toContain('aria-label="Tiến trình bảo hành"');
    expect(timeline).toContain(warrantyStatusPresentation.REJECTED.label);
    expect(timeline).not.toContain(warrantyStatusPresentation.RESOLVED.label);
  });
});
