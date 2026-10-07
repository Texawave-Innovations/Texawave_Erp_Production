/** Mirrors apps/api/src/modules/hr/holidays/dto/holiday.dto.ts. */
export interface WorkLocationRef {
  id: number;
  code: string;
  name: string;
}

/** Row shape of GET /hr/holidays and /hr/holidays/:id. */
export interface Holiday {
  id: number;
  holidayDate: string;
  name: string;
  description: string | null;
  workLocation: WorkLocationRef | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
