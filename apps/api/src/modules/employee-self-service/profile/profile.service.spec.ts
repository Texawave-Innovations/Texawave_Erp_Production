import { ProfileService } from "./profile.service.js";

describe("ProfileService", () => {
  it("getMyProfile() resolves the employee from the login, taking no id", async () => {
    const employees = {
      getCurrentEmployee: vi.fn().mockResolvedValue({ id: 77 }),
    };
    const service = new ProfileService(employees as never);
    await expect(service.getMyProfile()).resolves.toEqual({ id: 77 });
    expect(employees.getCurrentEmployee).toHaveBeenCalledWith();
  });
});
