import type { AnyRoute } from '../../http/route';
import { payRateRoutes } from './payRates';
import { profileRoutes } from './profiles';
import { tierRoutes } from './tiers';

export const staffRoutes: AnyRoute[] = [...tierRoutes, ...profileRoutes, ...payRateRoutes];
