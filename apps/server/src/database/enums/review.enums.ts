export enum ReviewStatus {
  PUBLISHED = 'published',
  HIDDEN = 'hidden',
}

// What a report, a status change or a vote points at.
export enum ReviewTarget {
  REVIEW = 'review',
  REPLY = 'reply',
}

export enum ReviewReportReason {
  SPAM = 'spam',
  ABUSIVE = 'abusive',
  FAKE = 'fake',
  IRRELEVANT = 'irrelevant',
  OTHER = 'other',
}

export enum ReviewReportStatus {
  OPEN = 'open',
  HIDDEN = 'resolved_hidden',
  DISMISSED = 'dismissed',
}
