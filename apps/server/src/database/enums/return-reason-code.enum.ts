/** Why a customer is returning a bird or item. The customer picks one; the written reason adds the detail. */
export enum ReturnReasonCode {
  NOT_AS_DESCRIBED = 'not_as_described',
  SICK_OR_INJURED = 'sick_or_injured',
  WRONG_BIRD = 'wrong_bird',
  DAMAGED_IN_TRANSIT = 'damaged_in_transit',
  LATE_DELIVERY = 'late_delivery',
  CHANGED_MIND = 'changed_mind',
  OTHER = 'other',
}

export const RETURN_REASON_LABEL: Record<ReturnReasonCode, string> = {
  [ReturnReasonCode.NOT_AS_DESCRIBED]: 'Not as described',
  [ReturnReasonCode.SICK_OR_INJURED]: 'Sick or injured',
  [ReturnReasonCode.WRONG_BIRD]: 'Wrong bird or item sent',
  [ReturnReasonCode.DAMAGED_IN_TRANSIT]: 'Hurt or damaged on the way',
  [ReturnReasonCode.LATE_DELIVERY]: 'Arrived too late',
  [ReturnReasonCode.CHANGED_MIND]: 'Changed my mind',
  [ReturnReasonCode.OTHER]: 'Other',
};
