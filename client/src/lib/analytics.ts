import posthog from 'posthog-js';

// ─── Disclaimer ──────────────────────────────────────────────────────────────

export const captureDisclaimerShown = () =>
  posthog.capture('disclaimer_shown');

export const captureDisclaimerCheckboxToggled = (checked: boolean) =>
  posthog.capture('disclaimer_checkbox_toggled', { checked });

export const captureDisclaimerAccepted = () =>
  posthog.capture('disclaimer_accepted');

// ─── Recommendations ─────────────────────────────────────────────────────────

export const captureRecommendationsLoaded = (props: {
  buy_count: number;
  sell_count: number;
  from_history: boolean;
  historical_date?: string;
}) => posthog.capture('recommendations_loaded', props);

export const captureRefreshClicked = (props: {
  cache_active: boolean;
  remaining_seconds?: number;
}) => posthog.capture('refresh_clicked', props);

export const captureRecommendationsError = (message: string) =>
  posthog.capture('recommendations_error', { message });

export const captureHistoryBannerShown = (historical_date: string) =>
  posthog.capture('history_banner_shown', { historical_date });

// ─── Stock cards ─────────────────────────────────────────────────────────────

export const captureCardOpened = (props: {
  symbol: string;
  side: 'buy' | 'sell';
  rank: number;
  instrument_type?: string;
}) => posthog.capture('card_opened', props);

export const captureCardPeriodChanged = (props: {
  symbol: string;
  side: 'buy' | 'sell';
  from_period: string;
  to_period: string;
}) => posthog.capture('card_period_changed', props);

// ─── Posts modal ─────────────────────────────────────────────────────────────

export const capturePostsModalClosed = (props: {
  symbol: string;
  side: 'buy' | 'sell';
}) => posthog.capture('posts_modal_closed', props);

export const capturePostRedditLinkClicked = (props: {
  symbol: string;
  side: 'buy' | 'sell';
  post_title: string;
  post_url: string;
}) => posthog.capture('post_reddit_link_clicked', props);

// ─── Manual lookup ───────────────────────────────────────────────────────────

export const captureManualLookupSearched = (symbol: string) =>
  posthog.capture('manual_lookup_searched', { symbol });

export const captureManualLookupResult = (props: {
  symbol: string;
  instrument_type: string;
  recommendation: string;
}) => posthog.capture('manual_lookup_result', props);

export const captureManualLookupError = (props: {
  symbol: string;
  message: string;
}) => posthog.capture('manual_lookup_error', props);

export const captureManualLookupPeriodChanged = (props: {
  symbol: string;
  from_period: string;
  to_period: string;
}) => posthog.capture('manual_lookup_period_changed', props);

// ─── Mobile navigation ───────────────────────────────────────────────────────

export const captureMobileTabSwitched = (props: {
  from_tab: string;
  to_tab: string;
}) => posthog.capture('mobile_tab_switched', props);
