// CRM Core Domain — maps a Pipeline stage id to the right contextual celebration, shared by the
// two places a deal can change stage: the drag-and-drop board (`Pipeline.tsx`) and the drawer's
// "Move Stage" action (`domain/OpportunityDrawer.tsx`). Won/Lost/On Hold have their own dedicated
// actions elsewhere and are not reached through this generic move.
import { CrmCelebrationKey } from "./celebrationConfig";
import {
  STAGE_ID_INTERESTED,
  STAGE_ID_PROPOSAL,
  STAGE_ID_NEGOTIATION,
} from "../domain/config";

export function celebrationKeyForStage(stageId: string): CrmCelebrationKey {
  switch (stageId) {
    case STAGE_ID_INTERESTED:
      return "deal.interested";
    case STAGE_ID_PROPOSAL:
      return "deal.proposalSent";
    case STAGE_ID_NEGOTIATION:
      return "deal.negotiation";
    default:
      return "deal.stageChanged";
  }
}
