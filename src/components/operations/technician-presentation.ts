export type TechnicianTimelineTimestamps = {
  assignedAt: string;
  acceptedAt: string | null;
  enRouteAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export const technicianTimelineSteps = [
  { key: 'assignedAt', label: 'Đã phân công' },
  { key: 'acceptedAt', label: 'Đã nhận việc' },
  { key: 'enRouteAt', label: 'Đang di chuyển' },
  { key: 'arrivedAt', label: 'Đã đến nơi' },
  { key: 'startedAt', label: 'Đang thực hiện' },
  { key: 'completedAt', label: 'Hoàn thành' },
] as const satisfies ReadonlyArray<{
  key: keyof TechnicianTimelineTimestamps;
  label: string;
}>;

export function buildTechnicianTimeline(input: TechnicianTimelineTimestamps) {
  return technicianTimelineSteps.map((step) => ({
    ...step,
    complete: Boolean(input[step.key]),
    timestamp: input[step.key],
  }));
}
