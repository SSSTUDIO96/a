import type { AnyRoute } from '../../http/route';
import { appointmentRoutes } from './appointments';
import { customerRoutes } from './customers';

export const scheduleRoutes: AnyRoute[] = [...customerRoutes, ...appointmentRoutes];
