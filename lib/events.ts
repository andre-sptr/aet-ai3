export function eventStatus(startDate: Date | string, endDate: Date | string | null, now = Date.now()): 'upcoming' | 'ongoing' | 'past' {
  const start = new Date(startDate).getTime();
  const end = endDate ? new Date(endDate).getTime() : start;
  return now < start ? 'upcoming' : now < end ? 'ongoing' : 'past';
}
