import { InvitationSummary, Member } from '@src/models/v2/iam';

export const isMembership = (value?: Member | InvitationSummary): value is Member => {
  return value ? Boolean((value as Member).subject) : false;
};
