import { describe, expect, it } from 'vitest';

import {
  buildTechnicianTimeline,
  technicianTimelineSteps,
} from '@/components/operations/technician-presentation';

describe('technician timeline presentation', () => {
  it('keeps the required installation workflow in display order', () => {
    expect(technicianTimelineSteps.map((step) => step.key)).toEqual([
      'assignedAt',
      'acceptedAt',
      'enRouteAt',
      'arrivedAt',
      'startedAt',
      'completedAt',
    ]);
  });

  it('marks only persisted timestamps as complete', () => {
    const timeline = buildTechnicianTimeline({
      assignedAt: '2026-07-18T01:00:00.000Z',
      acceptedAt: '2026-07-18T01:05:00.000Z',
      enRouteAt: '2026-07-18T01:10:00.000Z',
      arrivedAt: null,
      startedAt: null,
      completedAt: null,
    });

    expect(timeline.map((step) => step.complete)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});
