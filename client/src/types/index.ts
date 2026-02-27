export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  timestamp: string;
}

export interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockRecommendation {
  symbol: string;
  companyName: string;
  instrumentType?: 'STOCK' | 'ETF';
  recommendation: 'BUY' | 'SELL';
  reason: string;
  exitReason?: string;
  popularityScore: number;
  quote?: StockQuote;
  historicalData?: HistoricalDataPoint[];
}

export interface RecommendationsResponse {
  buy: StockRecommendation[];
  sell: StockRecommendation[];
  lastUpdated: string;
  fromCache?: boolean;
  fromHistory?: boolean;
  historicalDate?: string;
}

export interface BasicFinancials {
  symbol: string;
  companyName?: string;
  instrumentType?: 'STOCK' | 'ETF';
  // Stock fields
  marketCap?: number;
  peRatio?: number;
  eps?: number;
  revenue?: number;
  profitMargin?: number;
  debtToEquity?: number;
  currentRatio?: number;
  beta?: number;
  shortFloat?: number;
  dividendYield?: number;
  priceToBook?: number;
  // ETF fields
  aum?: number;
  expenseRatio?: number;
  category?: string;
  nav?: number;
  yield?: number;
  inceptionDate?: string;
}

export interface StockAnalysis {
  symbol: string;
  recommendation: 'BUY' | 'SELL';
  reason: string;
  financials: BasicFinancials;
  quote?: StockQuote;
  historicalData?: HistoricalDataPoint[];
}
