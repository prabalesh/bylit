export const CURRENCY_SYMBOLS: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    CNY: '¥',
    BRL: 'R$',
    ZAR: 'R',
    SGD: 'S$',
    NZD: 'NZ$',
    CHF: 'CHF',
    HKD: 'HK$',
    SEK: 'kr',
    IDR: 'Rp',
    KRW: '₩',
    AED: 'د.إ',
    SAR: '﷼',
    RUB: '₽',
};

export const getCurrencySymbol = (code?: string) => {
    if (!code) return '₹';
    return CURRENCY_SYMBOLS[code] || code;
};
