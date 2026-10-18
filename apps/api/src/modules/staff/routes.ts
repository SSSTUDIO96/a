import type { AnyRoute } from '../../http/route';
import { availabilityRoutes } from './availability';
import { payRateRoutes } from './payRates';
import { profileRoutes } from './profiles';
import { tierRoutes } from './tiers';

export const staffRoutes: AnyRoute[] = [...tierRoutes, ...availabilityRoutes, ...profileRoutes, ...payRateRoutes];
