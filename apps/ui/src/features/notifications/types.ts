/** GET/PUT /notifications/dnd. */
export interface DndState {
  /** Snoozed right now. */
  active: boolean;
  /** End of a timed snooze (ISO); null when off or indefinite. */
  until: string | null;
  indefinite: boolean;
}

/** PUT body: a timed snooze, indefinite, or neither (turn off). */
export interface DndRequest {
  until?: string | null;
  indefinite?: boolean;
}

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
