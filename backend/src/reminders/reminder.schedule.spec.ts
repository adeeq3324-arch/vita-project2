import { toLocalDate, toLocalTimeOfDay } from '../common/util/date.util';
import { firesOn, nextRunAt, repeatLabel, type ReminderSchedule } from './reminder.schedule';

const daily = (overrides: Partial<ReminderSchedule> = {}): ReminderSchedule => ({
  timeOfDay: '08:00',
  daysOfWeek: [],
  timeZone: 'UTC',
  ...overrides,
});

describe('firesOn', () => {
  it('treats an empty day list as every day', () => {
    // 2026-03-09 is a Monday, 2026-03-15 a Sunday.
    expect(firesOn([], '2026-03-09')).toBe(true);
    expect(firesOn([], '2026-03-15')).toBe(true);
  });

  it('matches ISO weekdays, Monday as 1', () => {
    expect(firesOn([1], '2026-03-09')).toBe(true);
    expect(firesOn([1], '2026-03-10')).toBe(false);
    expect(firesOn([7], '2026-03-15')).toBe(true);
  });

  it('fires on any listed day', () => {
    expect(firesOn([1, 3, 5], '2026-03-11')).toBe(true);
    expect(firesOn([1, 3, 5], '2026-03-12')).toBe(false);
  });
});

describe('nextRunAt', () => {
  it('returns today when the time is still ahead', () => {
    const after = new Date('2026-03-15T06:00:00Z');
    expect(nextRunAt(daily(), after).toISOString()).toBe('2026-03-15T08:00:00.000Z');
  });

  it('rolls to tomorrow once today has passed', () => {
    const after = new Date('2026-03-15T09:00:00Z');
    expect(nextRunAt(daily(), after).toISOString()).toBe('2026-03-16T08:00:00.000Z');
  });

  /**
   * Strictly after, never equal: the sweep claims a reminder and immediately
   * recomputes its next run from that instant. Returning the same time would
   * leave it permanently due and fire it in a loop.
   */
  it('never returns the instant it was given', () => {
    const exactly = new Date('2026-03-15T08:00:00Z');
    expect(nextRunAt(daily(), exactly).toISOString()).toBe('2026-03-16T08:00:00.000Z');
  });

  it('skips to the next listed weekday', () => {
    // Sunday 2026-03-15; next weekday-only firing is Monday the 16th.
    const after = new Date('2026-03-15T09:00:00Z');
    const schedule = daily({ daysOfWeek: [1, 2, 3, 4, 5] });

    expect(nextRunAt(schedule, after).toISOString()).toBe('2026-03-16T08:00:00.000Z');
  });

  /**
   * The case the eight-day search window exists for: a once-weekly reminder,
   * asked on its own day, after its time. The answer is a full week out, which a
   * seven-day search would miss by one.
   */
  it('finds the following week for a single-weekday schedule already past today', () => {
    const after = new Date('2026-03-09T09:00:00Z'); // Monday, after 08:00
    const schedule = daily({ daysOfWeek: [1] });

    expect(nextRunAt(schedule, after).toISOString()).toBe('2026-03-16T08:00:00.000Z');
  });

  it('resolves the wall-clock time in the user’s zone, not the server’s', () => {
    const after = new Date('2026-03-15T00:00:00Z');
    const schedule = daily({ timeZone: 'Asia/Tokyo' });

    // 08:00 in Tokyo (UTC+9) is 23:00Z the previous day.
    expect(nextRunAt(schedule, after).toISOString()).toBe('2026-03-15T23:00:00.000Z');
  });

  /**
   * The property that makes the whole module worth having: a reminder set for
   * 08:00 keeps firing at 08:00 local across a daylight-saving change, rather
   * than drifting to 07:00 or 09:00 as a fixed 24-hour interval would.
   */
  it('holds the local time across a spring-forward boundary', () => {
    const zone = 'Europe/London';
    const schedule = daily({ timeZone: zone });

    // UK clocks go forward on 2026-03-29.
    const before = nextRunAt(schedule, new Date('2026-03-27T09:00:00Z'));
    const after = nextRunAt(schedule, new Date('2026-03-29T09:00:00Z'));

    expect(toLocalTimeOfDay(before, zone)).toBe('08:00');
    expect(toLocalTimeOfDay(after, zone)).toBe('08:00');
    // The UTC instants differ by an hour precisely because the local time held.
    expect(before.toISOString()).toBe('2026-03-28T08:00:00.000Z');
    expect(after.toISOString()).toBe('2026-03-30T07:00:00.000Z');
  });

  it('holds the local time across an autumn-back boundary', () => {
    const zone = 'Europe/London';
    const schedule = daily({ timeZone: zone });

    const resolved = nextRunAt(schedule, new Date('2026-10-25T09:00:00Z'));

    expect(toLocalTimeOfDay(resolved, zone)).toBe('08:00');
    expect(toLocalDate(resolved, zone)).toBe('2026-10-26');
  });

  /**
   * A missed firing is skipped rather than delivered late: a nudge to drink water
   * two hours ago is worse than none, and a backlog arriving at once is worse still.
   */
  it('advances past a firing that was missed while the process was down', () => {
    const twoDaysLate = new Date('2026-03-17T09:00:00Z');
    expect(nextRunAt(daily(), twoDaysLate).toISOString()).toBe('2026-03-18T08:00:00.000Z');
  });

  it('accepts both HH:MM and HH:MM:SS', () => {
    const after = new Date('2026-03-15T06:00:00Z');

    expect(nextRunAt(daily({ timeOfDay: '08:00' }), after).toISOString()).toBe(
      nextRunAt(daily({ timeOfDay: '08:00:00' }), after).toISOString(),
    );
  });

  it('refuses a schedule that could never fire', () => {
    // 0 is not an ISO weekday, so no day ever matches.
    expect(() => nextRunAt(daily({ daysOfWeek: [0] }), new Date('2026-03-15T06:00:00Z'))).toThrow(
      /no day on which it would ever fire/i,
    );
  });
});

describe('repeatLabel', () => {
  it.each([
    [[], 'Every day'],
    [[1, 2, 3, 4, 5, 6, 7], 'Every day'],
    [[1, 2, 3, 4, 5], 'Weekdays'],
    [[6, 7], 'Weekends'],
    [[1, 3, 5], 'Mon, Wed, Fri'],
    [[7], 'Sun'],
  ])('describes %j as "%s"', (days, expected) => {
    expect(repeatLabel(days)).toBe(expected);
  });

  it('orders the days regardless of how they were supplied', () => {
    expect(repeatLabel([5, 1, 3])).toBe('Mon, Wed, Fri');
  });

  it('does not mutate the caller’s array', () => {
    const days = [5, 1, 3];
    repeatLabel(days);
    expect(days).toEqual([5, 1, 3]);
  });
});
