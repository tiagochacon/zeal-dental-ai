import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { authRouter } from "./routers/auth";
import { patientsRouter } from "./routers/patients";
import { consultationsRouter, feedbacksRouter, neurovendasRouter } from "./routers/consultations";
import { billingRouter, stripeRouter } from "./routers/billing";
import { clinicRouter } from "./routers/clinic";
import { leadsRouter } from "./routers/leads";
import { callsRouter } from "./routers/calls";
import { adminRouter } from "./routers/admin";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  patients: patientsRouter,
  consultations: consultationsRouter,
  feedbacks: feedbacksRouter,
  neurovendas: neurovendasRouter,
  billing: billingRouter,
  stripe: stripeRouter,
  clinic: clinicRouter,
  leads: leadsRouter,
  calls: callsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
