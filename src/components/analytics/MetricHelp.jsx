// Словарь подсказок для метрик
export const MetricHelp = {
  'Net PNL': {
    title: 'Net PNL',
    description: 'Общая прибыль/убыток за выбранный период',
    formula: 'Сумма всех закрытых сделок (прибыль - убыток)',
    notes: 'Показывает финансовый результат торговли в долларах и процентах от депозита'
  },
  'Winrate': {
    title: 'Winrate',
    description: 'Процент прибыльных сделок',
    formula: 'Winrate = Wins / (Wins + Losses) × 100%',
    notes: 'Breakeven сделки НЕ учитываются. Высокий winrate (>50%) — хорошо, но важен баланс с R'
  },
  'Avg R Multiple': {
    title: 'Avg R',
    description: 'Средний R-multiple — сколько рисков заработано',
    formula: 'R = PNL / Риск на входе',
    notes: 'Положительное значение = прибыльная торговля. +1R = заработал 1 риск, -2R = потерял 2 риска'
  },
  'Profit Factor': {
    title: 'Profit Factor',
    description: 'Отношение общей прибыли к общему убытку',
    formula: 'PF = Gross Profit / Gross Loss',
    notes: 'PF > 1.5 — отлично, PF < 1 — убыточная торговля. Показывает эффективность стратегии'
  },
  'Expectancy': {
    title: 'Expectancy',
    description: 'Математическое ожидание — сколько $ приносит каждая сделка',
    formula: 'E = (Winrate × Avg Win) - (Lossrate × Avg Loss)',
    notes: 'Положительное значение = прибыльная система в долгосрок. Чем выше, тем лучше'
  },
  'Max Drawdown': {
    title: 'Max Drawdown',
    description: 'Максимальная просадка депозита от старта',
    formula: 'Max DD = min((Equity - Start Balance) / Start Balance) × 100%',
    notes: 'Показывает худший момент в торговле. <10% — отлично, >20% — опасно'
  },
  'Trades': {
    title: 'Trades',
    description: 'Количество сделок',
    formula: 'Количество закрытых и открытых позиций',
    notes: 'Для статистической значимости нужно минимум 10+ закрытых сделок'
  },
  'Discipline Index': {
    title: 'Discipline Index',
    description: 'Процент полностью заполненных сделок',
    formula: 'Complete Trades / Total Trades × 100%',
    notes: 'Открытые: Strategy, Timeframe, Confidence, Entry Reason, Stop, Take. Закрытые: Trade Analysis, Violations'
  }
};