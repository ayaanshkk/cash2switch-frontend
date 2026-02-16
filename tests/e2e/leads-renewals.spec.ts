import { test, expect, type Page } from "@playwright/test";

const buildUser = () => ({
  id: 1,
  name: "Admin",
  email: "admin@example.com",
  first_name: "Admin",
  last_name: "User",
  full_name: "Admin User",
  role: "admin",
  is_active: true,
  is_verified: true,
  created_at: new Date().toISOString(),
});

const stageData = {
  data: [
    { stage_id: 1, stage_name: "Not Called" },
    { stage_id: 2, stage_name: "Called" },
    { stage_id: 3, stage_name: "Priced" },
    { stage_id: 4, stage_name: "Lost" },
  ],
};

const electricityLeads = {
  data: [
    {
      opportunity_id: 101,
      business_name: "Elec Biz",
      contact_person: "Bob",
      tel_number: "+441111111111",
      email: "elec@example.com",
      mpan_mpr: "MPAN-ELEC-1",
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      stage_id: 2,
      stage_name: "Called",
      created_at: new Date().toISOString(),
    },
    {
      opportunity_id: 102,
      business_name: "Power Co",
      contact_person: "Jill",
      tel_number: "+441111111112",
      email: "power@example.com",
      mpan_mpr: "MPAN-ELEC-2",
      start_date: "2025-02-01",
      end_date: "2025-12-31",
      stage_id: 1,
      stage_name: "Not Called",
      created_at: new Date().toISOString(),
    },
  ],
};

const waterLeads = {
  data: [
    {
      opportunity_id: 201,
      business_name: "Water Biz",
      contact_person: "Alice",
      tel_number: "+441111111113",
      email: "water@example.com",
      mpan_mpr: "MPAN-WATER-1",
      start_date: "2025-03-01",
      end_date: "2025-12-31",
      stage_id: 1,
      stage_name: "Not Called",
      created_at: new Date().toISOString(),
    },
  ],
};

const buildEnergyCustomers = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    client_id: index + 1,
    name: `${prefix} Contact ${index + 1}`,
    business_name: `${prefix} Business ${index + 1}`,
    contact_person: `${prefix} Contact ${index + 1}`,
    phone: `+447700900${String(index + 1).padStart(2, "0")}`,
    email: `${prefix.toLowerCase()}-${index + 1}@example.com`,
    address: `${index + 1} ${prefix} Street`,
    site_address: `${index + 1} ${prefix} Site`,
    mpan_mpr: `${prefix.toUpperCase()}-MPAN-${index + 1}`,
    supplier_id: 1,
    supplier_name: "Supplier A",
    annual_usage: 5000,
    start_date: "2025-01-01",
    end_date: "2025-12-31",
    unit_rate: 0.25,
    status: "called",
    stage_id: 2,
    opportunity_id: index + 500,
    assigned_to_id: 1,
    assigned_to_name: "Agent A",
    created_at: new Date().toISOString(),
  }));

const electricityCustomers = buildEnergyCustomers(30, "Electricity");
const waterCustomers = buildEnergyCustomers(3, "Water");

const suppliersData = [{ supplier_id: 1, supplier_name: "Supplier A", provisions: 1, provisions_text: "Standard" }];
const employeesData = [{ employee_id: 1, employee_name: "Agent A", email: "agent@example.com" }];
const stagesData = [{ stage_id: 1, stage_name: "Called" }];

async function seedAuth(page: Page, baseURL: string | undefined) {
  const cookieUrl = baseURL || "http://localhost:3000";
  await page.context().addCookies([
    {
      name: "auth-token",
      value: "test-token",
      url: cookieUrl,
    },
  ]);

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_user", JSON.stringify(user));
    localStorage.setItem("tenant_id", "1");
  }, { token: "test-token", user: buildUser() });
}

async function stubLeadsEndpoints(page: Page) {
  await page.route("**/api/crm/stages", async route => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stageData) });
  });

  await page.route("**/api/crm/leads**", async route => {
    const url = new URL(route.request().url());
    const service = url.searchParams.get("service");
    const stage = url.searchParams.get("stage");

    if (stage === "Lost") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) });
      return;
    }

    const payload = service === "water" ? waterLeads : electricityLeads;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
}

async function stubRenewalsEndpoints(page: Page) {
  await page.route("**/energy-clients**", async route => {
    const url = new URL(route.request().url());
    const service = url.searchParams.get("service");
    const payload = service === "water" ? waterCustomers : electricityCustomers;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  await page.route("**/suppliers", async route => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(suppliersData) });
  });

  await page.route("**/employees", async route => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(employeesData) });
  });

  await page.route("**/stages", async route => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stagesData) });
  });
}

test.describe("Leads page", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await seedAuth(page, baseURL!);
    await stubLeadsEndpoints(page);
  });

  test("loads leads and switches service tabs", async ({ page }) => {
    await page.goto("/dashboard/leads");

    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Electricity" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Water" })).toBeVisible();

    await expect(page.getByText("Elec Biz")).toBeVisible();
    await expect(page.getByText("Power Co")).toBeVisible();

    await page.getByRole("button", { name: "Water" }).click();
    await expect(page.getByText("Water Biz")).toBeVisible();
    await expect(page.getByText("Elec Biz")).toHaveCount(0);
  });

  test("filters leads and shows empty state", async ({ page }) => {
    await page.goto("/dashboard/leads");

    await page.getByPlaceholder("Search leads...").fill("No Match");
    await expect(page.getByText("No leads found.")).toBeVisible();

    await page.getByPlaceholder("Search leads...").fill("");
    await expect(page.getByText("Elec Biz")).toBeVisible();
  });

  test("bulk import modal opens", async ({ page }) => {
    await page.goto("/dashboard/leads");

    await page.getByRole("button", { name: "Bulk Import" }).click();
    await expect(page.getByRole("heading", { name: "Bulk Import Leads" })).toBeVisible();
  });

  test("selecting a lead enables bulk delete", async ({ page }) => {
    await page.goto("/dashboard/leads");

    const firstRowCheckbox = page.locator("tbody input[type='checkbox']").first();
    await firstRowCheckbox.check();

    await expect(page.getByRole("button", { name: /Delete Selected/ })).toBeVisible();
  });
});

test.describe("Renewals page", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await seedAuth(page, baseURL!);
    await stubRenewalsEndpoints(page);
  });

  test("loads renewals and switches service tabs", async ({ page }) => {
    await page.goto("/dashboard/renewals");

    await expect(page.getByRole("heading", { name: "Renewals" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Electricity" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Water" })).toBeVisible();

    await expect(page.getByText("Electricity Business 1", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Water" }).click();
    await expect(page.getByText("Water Business 1", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Electricity Business 1")).toHaveCount(0);
  });

  test("supports pagination for large datasets", async ({ page }) => {
    await page.goto("/dashboard/renewals");

    await expect(page.getByText("Showing 1 to 25 of 30 clients")).toBeVisible();
    await page.getByTitle("Next Page").click();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    await expect(page.getByText("Showing 26 to 30 of 30 clients")).toBeVisible();
  });

  test("bulk import modal opens", async ({ page }) => {
    await page.goto("/dashboard/renewals");

    await page.getByRole("button", { name: "Bulk Import" }).click();
    await expect(page.getByRole("heading", { name: "Bulk Import Energy Customers" })).toBeVisible();
  });
});
