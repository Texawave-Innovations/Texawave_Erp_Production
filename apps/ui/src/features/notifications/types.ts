/** Row of GET /notifications (apps/api/src/platform/notifications). */
export interface AppNotification {
  id: number;
  /** Dotted sender code, e.g. attendance.missing_check_in */
  type: string;
  title: string;
  body: string;
  /** In-app path to open, or null. */
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
