import type { ActivityDay } from '../../api/queries/activity';

export interface ActivityCell {
  key: string;
  amount: number;
  /** 0 for a quiet day, up to 4 for the busiest ones. */
  level: number;
  label: string;
  isToday: boolean;
}

export interface ActivityGrid {
  /** Columns of seven days, Monday first; null where the year hasn't started or the day hasn't come. */
  weeks: (ActivityCell | null)[][];
  /** The month's short name above the week it starts in; empty elsewhere. */
  monthLabels: string[];
  total: number;
  activeDays: number;
}

const dayMs = 24 * 60 * 60 * 1000;
const weekDays = 7;
const daysShown = 365;

// <-- Un jour calme n'a pas de couleur ; ensuite, quatre paliers de plus en plus soutenus -->
export function levelOf(amount: number): number {
  if (amount <= 0) return 0;
  if (amount === 1) return 1;
  if (amount <= 3) return 2;
  if (amount <= 6) return 3;
  return 4;
}

const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// <-- AniList date chaque jour à minuit dans un fuseau qu'il ne dit pas (23:00 UTC pour Paris) : midi plus tard, la date civile est la bonne quel que soit le fuseau -->
const keyOfHistoryDay = (unixSeconds: number) => new Date((unixSeconds + 12 * 3600) * 1000).toISOString().slice(0, 10);

function describe(date: Date, amount: number): string {
  const day = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (!amount) return `${day} : aucune activité`;
  return `${day} : ${amount} activité${amount > 1 ? 's' : ''}`;
}

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** The last year of activity as weeks of seven days, ending on `today`. */
export function buildActivityGrid(history: ActivityDay[], today = new Date()): ActivityGrid {
  const amounts = new Map(history.map(({ date, amount }) => [keyOfHistoryDay(date), amount]));
  const lastDay = addDays(today, 0);
  const firstDay = addDays(lastDay, -(daysShown - 1));
  const gridStart = addDays(firstDay, -((firstDay.getDay() + 6) % weekDays));
  const weekCount = Math.ceil((Math.round((lastDay.getTime() - gridStart.getTime()) / dayMs) + 1) / weekDays);

  let total = 0;
  let activeDays = 0;
  const weeks: (ActivityCell | null)[][] = [];
  const monthLabels: string[] = [];

  for (let week = 0; week < weekCount; week++) {
    const days: (ActivityCell | null)[] = [];
    for (let weekday = 0; weekday < weekDays; weekday++) {
      const date = addDays(gridStart, week * weekDays + weekday);
      if (date < firstDay || date > lastDay) {
        days.push(null);
        continue;
      }
      const amount = amounts.get(keyOf(date)) ?? 0;
      total += amount;
      if (amount) activeDays++;
      days.push({ key: keyOf(date), amount, level: levelOf(amount), label: describe(date, amount), isToday: date.getTime() === lastDay.getTime() });
    }
    weeks.push(days);

    const monday = addDays(gridStart, week * weekDays);
    const isNewMonth = week === 0 || monday.getMonth() !== addDays(monday, -weekDays).getMonth();
    monthLabels.push(isNewMonth ? monday.toLocaleDateString('fr-FR', { month: 'short' }) : '');
  }
  return { weeks, monthLabels, total, activeDays };
}
