const getLanguage = () => localStorage.getItem('tradingpro_lang') || 'ru';

const translations = {
  ru: {
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
  },
  en: {
    'Net PNL': {
      title: 'Net PNL',
      description: 'Total profit/loss for selected period',
      formula: 'Sum of all closed trades (profit - loss)',
      notes: 'Shows financial result in dollars and % of balance'
    },
    'Winrate': {
      title: 'Winrate',
      description: 'Percentage of profitable trades',
      formula: 'Winrate = Wins / (Wins + Losses) × 100%',
      notes: 'Breakeven trades NOT included. High winrate (>50%) is good, but balance with R matters'
    },
    'Avg R Multiple': {
      title: 'Avg R',
      description: 'Average R-multiple — how many risks earned',
      formula: 'R = PNL / Entry Risk',
      notes: 'Positive = profitable trading. +1R = earned 1 risk, -2R = lost 2 risks'
    },
    'Profit Factor': {
      title: 'Profit Factor',
      description: 'Ratio of gross profit to gross loss',
      formula: 'PF = Gross Profit / Gross Loss',
      notes: 'PF > 1.5 — excellent, PF < 1 — losing. Shows strategy efficiency'
    },
    'Expectancy': {
      title: 'Expectancy',
      description: 'Mathematical expectation — how much $ each trade brings',
      formula: 'E = (Winrate × Avg Win) - (Lossrate × Avg Loss)',
      notes: 'Positive = profitable system long-term. Higher is better'
    },
    'Max Drawdown': {
      title: 'Max Drawdown',
      description: 'Maximum balance drawdown from start',
      formula: 'Max DD = min((Equity - Start Balance) / Start Balance) × 100%',
      notes: 'Shows worst moment in trading. <10% — excellent, >20% — dangerous'
    },
    'Trades': {
      title: 'Trades',
      description: 'Number of trades',
      formula: 'Count of closed and open positions',
      notes: 'Need minimum 10+ closed trades for statistical significance'
    },
    'Discipline Index': {
      title: 'Discipline Index',
      description: 'Percentage of fully completed trades',
      formula: 'Complete Trades / Total Trades × 100%',
      notes: 'Open: Strategy, Timeframe, Confidence, Entry Reason, Stop, Take. Closed: Trade Analysis, Violations'
    }
  }
};

// Helper to get translated help
export const getMetricHelp = (key) => {
  const lang = getLanguage();
  return translations[lang]?.[key] || translations.ru[key];
};

export default getMetricHelp;