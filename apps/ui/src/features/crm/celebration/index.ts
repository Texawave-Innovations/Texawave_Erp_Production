// CRM Core Domain — Success Celebration system, public entry point. Import `celebrateCrm` from
// here anywhere in `src/modules/crm/` and call it right after a CRM mutation's write is confirmed;
// see `celebrationConfig.ts` for the full catalogue of keys and their messages.
export { celebrateCrm } from "./celebrationBus";
export type { CrmCelebrationKey } from "./celebrationConfig";
export { celebrationKeyForStage } from "./pipelineCelebration";
export { CrmCelebrationHost } from "./CrmCelebrationHost";
export { CrmWelcomeCelebration } from "./CrmWelcomeCelebration";
