// CRM Core Domain — maps a Pipeline stage to the right contextual celebration, shared by the
// two places a deal can change stage: the drag-and-drop board and the drawer's "Move Stage"
// action. Legacy matched stable ids ('interested' | 'proposal' | 'negotiation'); the new API's
// stage ids may be opaque, so this also accepts the stage name/label (case-insensitive).
import type { CrmCelebrationKey } from "./celebrationConfig";

export const STAGE_ID_INTERESTED = "interested";
export const STAGE_ID_PROPOSAL = "proposal";
export const STAGE_ID_NEGOTIATION = "negotiation";

export function celebrationKeyForStage(
  stageIdOrName: string,
): CrmCelebrationKey {
  switch (stageIdOrName.trim().toLowerCase()) {
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
