import {
  addDays,
  addMonths,
  dayLabel,
  daysBetween,
  eachDateInRange,
  endOfMonth,
  isoWeekday,
  isValidIsoDate,
  isValidTimeZone,
  localHour,
  normalizeTimeOfDay,
  resolveTimeZone,
  startOfMonth,
  startOfWeek,
  timeOfDayLabel,
  toLocalDate,
  toLocalTimeOfDay,
  zonedOffsetMs,
  zonedTimeToUtc,
} from './date.util';

describe('isValidIsoDate', () => {
  it.each(['2026-01-01', '2026-12-31', '2024-02-29'])('accepts %s', (value) => {
    expect(isValidIsoDate(value)).toBe(true);
  });

  /**
   * The interesting rejections are the ones a regex alone would let through:
   * a well-formed string naming a day that does not exist.
   */
  it.each([
    ['2025-02-30', 'a day the month does not have'],
    ['2025-02-29', 'a leap day in a non-leap year'],
    ['2025-13-01', 'a thirteenth month'],
    ['2025-00-10', 'a zeroth month'],
    ['2025-1-1', 'unpadded components'],
    ['26-01-01', 'a two-digit year'],
    ['not-a-date', 'arbitrary text'],
    ['', 'an empty string'],
  ])('rejects %s (%s)', (value) => {
    expect(isValidIsoDate(value)).toBe(false);
  });
});

describe('time zone resolution', () => {
  it('accepts real IANA zones and rejects invented ones', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('Africa/Mogadishu')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
  });

  /**
   * A profile with a missing or corrupt zone must not make date formatting
   * throw — every day-scoped read would fail for that user.
   */
  it.each([null, undefined, '', 'Nowhere/Nothing'])('falls back to UTC for %s', (value) => {
    expect(resolveTimeZone(value)).toBe('UTC');
  });

  it('keeps a valid zone untouched', () => {
    expect(resolveTimeZone('Asia/Tokyo')).toBe('Asia/Tokyo');
  });
});

describe('toLocalDate', () => {
  /**
   * The case the whole module exists for: one instant is two different calendar
   * days depending on where the user is. Getting this wrong files a meal under
   * the wrong day.
   */
  it('resolves one instant to different days either side of the date line', () => {
    const instant = new Date('2026-03-15T23:30:00Z');

    expect(toLocalDate(instant, 'UTC')).toBe('2026-03-15');
    expect(toLocalDate(instant, 'Asia/Tokyo')).toBe('2026-03-16');
    expect(toLocalDate(instant, 'America/Los_Angeles')).toBe('2026-03-15');
  });

  it('rolls back a day for zones behind UTC just after midnight', () => {
    const instant = new Date('2026-03-15T02:00:00Z');
    expect(toLocalDate(instant, 'America/New_York')).toBe('2026-03-14');
  });
});

describe('localHour', () => {
  it('reports midnight as 0 rather than 24', () => {
    expect(localHour(new Date('2026-03-15T00:30:00Z'), 'UTC')).toBe(0);
  });

  it('shifts with the zone', () => {
    const instant = new Date('2026-03-15T12:00:00Z');
    expect(localHour(instant, 'UTC')).toBe(12);
    expect(localHour(instant, 'Asia/Tokyo')).toBe(21);
  });
});

describe('calendar arithmetic', () => {
  it('adds and subtracts days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('measures whole days between dates, signed', () => {
    expect(daysBetween('2026-03-01', '2026-03-08')).toBe(7);
    expect(daysBetween('2026-03-08', '2026-03-01')).toBe(-7);
    expect(daysBetween('2026-03-01', '2026-03-01')).toBe(0);
  });

  /**
   * `daysBetween` is computed from UTC midnights precisely so a daylight-saving
   * change cannot make a week measure 6.96 days and round to 6.
   */
  it('is unaffected by a daylight-saving change in between', () => {
    expect(daysBetween('2026-03-25', '2026-04-01')).toBe(7);
    expect(daysBetween('2026-10-22', '2026-10-29')).toBe(7);
  });

  it('anchors weeks to Monday', () => {
    // 2026-03-15 is a Sunday; its week began on Monday the 9th.
    expect(startOfWeek('2026-03-15')).toBe('2026-03-09');
    expect(startOfWeek('2026-03-09')).toBe('2026-03-09');
    expect(startOfWeek('2026-03-10')).toBe('2026-03-09');
  });

  it('numbers weekdays ISO-style, Monday through Sunday', () => {
    expect(isoWeekday('2026-03-09')).toBe(1);
    expect(isoWeekday('2026-03-15')).toBe(7);
  });

  it('finds the first and last day of a month', () => {
    expect(startOfMonth('2026-03-15')).toBe('2026-03-01');
    expect(endOfMonth('2026-03-15')).toBe('2026-03-31');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29');
  });

  /**
   * Month arithmetic clamps rather than overflowing: adding a month to the 31st
   * must not silently become the 1st or 2nd of the month after next.
   */
  it('clamps to the end of a shorter target month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('enumerates an inclusive range and returns nothing for a reversed one', () => {
    expect(eachDateInRange('2026-03-01', '2026-03-04')).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
    ]);
    expect(eachDateInRange('2026-03-01', '2026-03-01')).toEqual(['2026-03-01']);
    expect(eachDateInRange('2026-03-04', '2026-03-01')).toEqual([]);
  });
});

describe('time-of-day handling', () => {
  it('normalises to the HH:MM:SS a time column stores', () => {
    expect(normalizeTimeOfDay('08:00')).toBe('08:00:00');
    expect(normalizeTimeOfDay('08:00:30')).toBe('08:00:30');
  });

  it('renders a stored time the way the app displays it', () => {
    expect(timeOfDayLabel('08:00:00')).toBe('8:00 AM');
    expect(timeOfDayLabel('20:30:00')).toBe('8:30 PM');
    expect(timeOfDayLabel('00:00:00')).toBe('12:00 AM');
    expect(timeOfDayLabel('12:00:00')).toBe('12:00 PM');
  });

  it('recovers the local wall clock an instant reads as', () => {
    expect(toLocalTimeOfDay(new Date('2026-03-15T08:00:00Z'), 'UTC')).toBe('08:00');
    expect(toLocalTimeOfDay(new Date('2026-03-15T08:00:00Z'), 'Asia/Tokyo')).toBe('17:00');
  });
});

describe('zonedOffsetMs', () => {
  const HOUR = 3_600_000;

  it('reports zero for UTC and a positive offset east of it', () => {
    expect(zonedOffsetMs(new Date('2026-03-15T12:00:00Z'), 'UTC')).toBe(0);
    expect(zonedOffsetMs(new Date('2026-03-15T12:00:00Z'), 'Asia/Tokyo')).toBe(9 * HOUR);
  });

  it('reports a negative offset west of UTC', () => {
    expect(zonedOffsetMs(new Date('2026-01-15T12:00:00Z'), 'America/New_York')).toBe(-5 * HOUR);
  });

  /** The same zone has different offsets in summer and winter. */
  it('tracks the daylight-saving rule rather than a fixed table', () => {
    expect(zonedOffsetMs(new Date('2026-01-15T12:00:00Z'), 'Europe/London')).toBe(0);
    expect(zonedOffsetMs(new Date('2026-07-15T12:00:00Z'), 'Europe/London')).toBe(HOUR);
  });

  it('is not skewed by sub-second components of the instant', () => {
    expect(zonedOffsetMs(new Date('2026-07-15T12:00:00.750Z'), 'Europe/London')).toBe(HOUR);
  });
});

describe('zonedTimeToUtc', () => {
  it('converts an ordinary local time to the right instant', () => {
    expect(zonedTimeToUtc('2026-03-15', '08:00', 'UTC').toISOString()).toBe(
      '2026-03-15T08:00:00.000Z',
    );
    // Tokyo is UTC+9 year round.
    expect(zonedTimeToUtc('2026-03-15', '08:00', 'Asia/Tokyo').toISOString()).toBe(
      '2026-03-14T23:00:00.000Z',
    );
  });

  it('accounts for summer time', () => {
    // London is UTC+1 in July, so 08:00 local is 07:00Z.
    expect(zonedTimeToUtc('2026-07-15', '08:00', 'Europe/London').toISOString()).toBe(
      '2026-07-15T07:00:00.000Z',
    );
    // …and UTC+0 in January.
    expect(zonedTimeToUtc('2026-01-15', '08:00', 'Europe/London').toISOString()).toBe(
      '2026-01-15T08:00:00.000Z',
    );
  });

  /**
   * The spring-forward gap: on 29 March 2026 the UK clock jumps 01:00 → 02:00,
   * so 01:30 local never happens. The documented behaviour is to land just after
   * the jump — never before the requested time, which would fire a reminder an
   * hour early.
   */
  it('pushes a skipped local time forward past the gap', () => {
    const resolved = zonedTimeToUtc('2026-03-29', '01:30', 'Europe/London');

    expect(resolved.getTime()).toBeGreaterThanOrEqual(
      Date.parse('2026-03-29T01:00:00.000Z'),
    );
    expect(resolved.toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });

  /**
   * The autumn-back overlap: on 25 October 2026 the UK clock repeats 01:00–02:00,
   * so 01:30 local happens twice — at 00:30Z (still BST) and again at 01:30Z
   * (GMT). Both are legitimate answers.
   *
   * What is asserted here is the property that actually matters to a reminder:
   * it resolves to *one* instant, on the requested date, at which the local clock
   * really does read the requested time. Which of the two repeated hours it picks
   * is not something a user can perceive — the clock says 01:30 either way — so
   * pinning it would be testing an implementation detail rather than a contract.
   */
  it('resolves an ambiguous local time to a single valid instant', () => {
    const zone = 'Europe/London';
    const resolved = zonedTimeToUtc('2026-10-25', '01:30', zone);

    expect(toLocalTimeOfDay(resolved, zone)).toBe('01:30');
    expect(toLocalDate(resolved, zone)).toBe('2026-10-25');
    expect([
      '2026-10-25T00:30:00.000Z',
      '2026-10-25T01:30:00.000Z',
    ]).toContain(resolved.toISOString());
  });

  it('round-trips an unambiguous time back to the same wall clock', () => {
    for (const [date, zone] of [
      ['2026-06-15', 'Europe/London'],
      ['2026-01-15', 'America/New_York'],
      ['2026-06-15', 'Asia/Tokyo'],
      ['2026-06-15', 'Africa/Mogadishu'],
    ] as const) {
      const instant = zonedTimeToUtc(date, '08:00', zone);
      expect(toLocalTimeOfDay(instant, zone)).toBe('08:00');
      expect(toLocalDate(instant, zone)).toBe(date);
    }
  });
});

describe('dayLabel', () => {
  const today = '2026-03-15';

  it('names the days around today', () => {
    expect(dayLabel('2026-03-15', today)).toBe('Today');
    expect(dayLabel('2026-03-14', today)).toBe('Yesterday');
    expect(dayLabel('2026-03-16', today)).toBe('Tomorrow');
  });

  it('uses the weekday name within the past week', () => {
    // 2026-03-11 is a Wednesday, four days before Sunday the 15th.
    expect(dayLabel('2026-03-11', today)).toBe('Wednesday');
  });

  it('falls back to an absolute date beyond a week', () => {
    expect(dayLabel('2026-03-01', today)).toBe('Mar 1');
  });
});
