import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { chromium } from "playwright";

const ownerToken = "test-owner-access-token";
const driverToken = "test-driver-access-token";
const outsiderToken = "test-outsider-access-token";
const ownerUserId = "test-owner-user";
const driverUserId = "test-driver-user";
const memberId = "test-driver-member";
const vehicleId = "test-vehicle";
const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const browserExecutable = process.env.FLEETVIX_TEST_CHROMIUM || "/repl/tools/bin/chromium";

function initialState() {
  return {
    vehicles: [{ id: vehicleId, name: "Test Truck", type: "Truck", regNumber: "TEST-001", status: "Active" }],
    fleetDays: [],
    logs: [],
    customers: [],
    ledgers: [],
    fuelRecords: [],
    drivers: [{ id: memberId, name: "Test Driver", phone: "9000000000", type: "Regular", dailyRate: 1200, vehicleIds: [vehicleId], status: "Active" }],
    driverPays: [],
    notes: [],
    khataBatches: [],
    settings: { businessName: "Test Fleet", isLoggedIn: true },
    maintenanceRequests: [],
    driverAbsentDates: [],
    deletedLogIds: [],
    deletedFuelIds: [],
  };
}

function clone(value) {
  return structuredClone(value);
}

function createFixture() {
  const fixture = {
    ownerState: initialState(),
    invoices: [],
    uploadedObjects: new Map(),
    nextFileId: 1,
    ownerStateSaveAttempts: 0,
    failFirstOwnerSave: true,
    driverStateSaveAttempts: 0,
    failFirstDriverSave: true,
    memberProfile: {
      name: "Test Driver",
      phone: "9000000000",
      address: "",
      vehicleIds: [vehicleId],
      documents: [],
      sharedFiles: [],
      status: "Active",
    },
  };

  const userForToken = new Map([
    [ownerToken, ownerUserId],
    [driverToken, driverUserId],
    [outsiderToken, "test-outsider-user"],
  ]);

  function memberResponse() {
    return {
      id: memberId,
      ownerUserId,
      driverUserId,
      profile: clone(fixture.memberProfile),
    };
  }

  function getDriverState() {
    const state = clone(fixture.ownerState);
    state.vehicles = state.vehicles.filter((vehicle) => fixture.memberProfile.vehicleIds.includes(vehicle.id));
    const allowedVehicles = new Set(state.vehicles.map((vehicle) => vehicle.id));
    state.logs = state.logs.filter((log) => log.driverId === memberId && allowedVehicles.has(log.vehicleId));
    state.fuelRecords = state.fuelRecords.filter((record) => record.driverId === memberId && allowedVehicles.has(record.vehicleId));
    state.driverPays = state.driverPays.filter((payment) => payment.driverId === memberId);
    state.maintenanceRequests = state.maintenanceRequests.filter((request) => request.driverId === memberId);
    state.notes = state.notes.filter((note) => note.driverId === memberId);
    state.drivers = state.drivers.filter((driver) => driver.id === memberId);
    state.customers = [];
    state.ledgers = [];
    state.fleetDays = [];
    return state;
  }

  function workspaceFor(userId) {
    if (userId === ownerUserId) {
      return {
        role: "owner",
        ownerUserId,
        inviteCode: "TEST42",
        state: clone(fixture.ownerState),
        members: [{ id: memberId, driverUserId, profile: clone(fixture.memberProfile) }],
        invoices: clone(fixture.invoices),
      };
    }
    if (userId === driverUserId) {
      return {
        role: "driver",
        ownerUserId,
        member: memberResponse(),
        ownerSettings: clone(fixture.ownerState.settings),
        availableVehicles: clone(fixture.ownerState.vehicles),
        state: getDriverState(),
        invoices: clone(fixture.invoices.filter((invoice) => invoice.driverUserId === driverUserId)),
      };
    }
    return { role: null };
  }

  async function reply(route, status, body) {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  }

  async function handleApi(route) {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    const token = request.headers().authorization?.replace(/^Bearer\s+/i, "");
    const userId = userForToken.get(token);

    if (!userId) {
      await reply(route, 401, { error: "Invalid session" });
      return;
    }

    if (pathname === "/api/storage/uploads/request-url" && method === "POST") {
      const uploadId = `workspace-file-${fixture.nextFileId++}`;
      await reply(route, 200, {
        uploadURL: `https://upload.test/${uploadId}`,
        objectPath: `/objects/uploads/${uploadId}`,
      });
      return;
    }

    const workspacePath = pathname.slice("/api/workspace".length) || "/";
    if (workspacePath === "/" && method === "GET") {
      await reply(route, 200, workspaceFor(userId));
      return;
    }

    if (workspacePath === "/owner/state" && method === "PUT") {
      if (userId !== ownerUserId) {
        await reply(route, 403, { error: "Only the owner can save workspace data" });
        return;
      }
      fixture.ownerStateSaveAttempts += 1;
      if (fixture.failFirstOwnerSave) {
        fixture.failFirstOwnerSave = false;
        await reply(route, 503, { error: "Simulated temporary save failure" });
        return;
      }
      fixture.ownerState = clone(JSON.parse(request.postData() || "{}").state);
      await reply(route, 200, { state: clone(fixture.ownerState) });
      return;
    }

    if (workspacePath === "/driver/state" && method === "PUT") {
      if (userId !== driverUserId) {
        await reply(route, 403, { error: "Only a driver can save driver workspace data" });
        return;
      }
      fixture.driverStateSaveAttempts += 1;
      if (fixture.failFirstDriverSave) {
        fixture.failFirstDriverSave = false;
        await reply(route, 503, { error: "Simulated temporary save failure" });
        return;
      }
      const incoming = JSON.parse(request.postData() || "{}").state;
      const incomingLogs = Array.isArray(incoming?.logs)
        ? incoming.logs.filter((log) => log.driverId === memberId && fixture.memberProfile.vehicleIds.includes(log.vehicleId))
        : [];
      fixture.ownerState.logs = [
        ...fixture.ownerState.logs.filter((log) => log.driverId !== memberId),
        ...incomingLogs,
      ];
      await reply(route, 200, { state: getDriverState() });
      return;
    }

    if (workspacePath === "/driver/profile" && method === "PUT" && userId === driverUserId) {
      fixture.memberProfile = clone(JSON.parse(request.postData() || "{}").profile);
      await reply(route, 200, { member: memberResponse() });
      return;
    }

    if (workspacePath === `/owner/members/${memberId}/files` && method === "POST" && userId === ownerUserId) {
      const input = JSON.parse(request.postData() || "{}").file;
      const file = {
        ...input,
        id: `shared-file-${fixture.nextFileId++}`,
        uploadedAt: new Date().toISOString().slice(0, 10),
      };
      fixture.memberProfile.sharedFiles.push(file);
      await reply(route, 200, { member: memberResponse() });
      return;
    }

    if (workspacePath === "/invoices" && method === "POST" && userId === ownerUserId) {
      const input = JSON.parse(request.postData() || "{}");
      const invoice = {
        id: `receipt-${fixture.invoices.length + 1}`,
        ownerUserId,
        driverUserId: input.driverUserId,
        title: input.title,
        html: input.html,
        revokedAt: null,
        createdAt: new Date().toISOString(),
      };
      fixture.invoices.push(invoice);
      await reply(route, 200, { invoice });
      return;
    }

    if (workspacePath === "/invoices" && method === "GET") {
      const invoices = userId === ownerUserId
        ? fixture.invoices
        : fixture.invoices.filter((invoice) => invoice.driverUserId === userId);
      await reply(route, 200, { invoices: clone(invoices) });
      return;
    }

    const fileUrlMatch = workspacePath.match(/^\/files\/([A-Za-z0-9-]+)\/url$/);
    if (fileUrlMatch && method === "GET") {
      const objectPath = `/objects/uploads/${fileUrlMatch[1]}`;
      const memberFiles = [...fixture.memberProfile.documents, ...fixture.memberProfile.sharedFiles];
      const isListed = memberFiles.some((file) => file.dataUrl === objectPath);
      const isWorkspaceUser = userId === ownerUserId || userId === driverUserId;
      if (!isListed || !isWorkspaceUser || !fixture.uploadedObjects.has(fileUrlMatch[1])) {
        await reply(route, 404, { error: "File not found or you do not have access to it." });
        return;
      }
      await reply(route, 200, { url: `https://download.test/${fileUrlMatch[1]}` });
      return;
    }

    await reply(route, 404, { error: `Unhandled test API request: ${method} ${workspacePath}` });
  }

  return {
    fixture,
    handleApi,
    getWorkspace: (userId) => workspaceFor(userId),
  };
}

async function addAuthSession(context, token, userId) {
  await context.addInitScript(({ token: accessToken, userId: id }) => {
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem("fleet-manager-auth", JSON.stringify({
      access_token: accessToken,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: `test-refresh-${id}`,
      user: {
        id,
        aud: "authenticated",
        app_metadata: { provider: "google", providers: ["google"] },
        user_metadata: { full_name: "Fleetvix Test User" },
        created_at: new Date().toISOString(),
      },
    }));
  }, { token, userId });
}

async function addMockRoutes(context, apiFixture) {
  await context.route("**/api/**", (route) => apiFixture.handleApi(route));
  await context.route("https://upload.test/**", async (route) => {
    const request = route.request();
    const corsHeaders = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "PUT, OPTIONS",
      "access-control-allow-headers": "content-type",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const uploadId = new URL(request.url()).pathname.slice(1);
    apiFixture.fixture.uploadedObjects.set(uploadId, {
      bytes: request.postDataBuffer() || Buffer.alloc(0),
      contentType: request.headers()["content-type"] || "application/octet-stream",
    });
    await route.fulfill({ status: 200, headers: corsHeaders, body: "uploaded" });
  });
  await context.route("https://download.test/**", async (route) => {
    const fileId = new URL(route.request().url()).pathname.slice(1);
    const stored = apiFixture.fixture.uploadedObjects.get(fileId);
    if (!stored) {
      await route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "missing" });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        "access-control-allow-origin": "*",
        "content-type": stored.contentType,
      },
      body: stored.bytes,
    });
  });
}

async function reservePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  server.close();
  await once(server, "close");
  return address.port;
}

async function waitForVite(child, url, getOutput) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Fleetvix dev server exited early.\n${getOutput()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The dev server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Fleetvix dev server did not start.\n${getOutput()}`);
}

test("authenticated owner and driver retain work, receipts, and private files across refresh", { timeout: 120_000 }, async () => {
  assert.ok(await import("node:fs/promises").then(({ access }) => access(browserExecutable).then(() => true, () => false)),
    `Chromium was not found at ${browserExecutable}; set FLEETVIX_TEST_CHROMIUM to its executable path.`);

  const port = await reservePort();
  const origin = `http://127.0.0.1:${port}`;
  let serverOutput = "";
  const child = spawn(resolve(appDirectory, "node_modules/.bin/vite"), [
    "--config", "vite.config.ts",
    "--host", "127.0.0.1",
    "--port", String(port),
  ], {
    cwd: appDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      BASE_PATH: "/",
      NODE_ENV: "development",
      VITE_SUPABASE_URL: "https://fleetvix-test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8").on("data", (chunk) => { serverOutput += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk) => { serverOutput += chunk; });

  let browser;
  try {
    await waitForVite(child, origin, () => serverOutput);
    browser = await chromium.launch({
      headless: true,
      executablePath: browserExecutable,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const apiFixture = createFixture();

    const ownerContext = await browser.newContext();
    await addAuthSession(ownerContext, ownerToken, ownerUserId);
    await addMockRoutes(ownerContext, apiFixture);
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(origin);
    await ownerPage.locator(".fm-app-shell").waitFor({ timeout: 20_000 });
    assert.doesNotMatch(await ownerPage.locator("body").innerText(), /Choose your Fleetvix workspace/,
      "an authenticated owner should restore directly into the existing workspace");

    const initialSaveFailure = ownerPage.getByRole("alert").filter({ hasText: "Cloud save failed" });
    await initialSaveFailure.waitFor({ timeout: 15_000 });
    await ownerPage.getByRole("button", { name: "Retry" }).click();
    await initialSaveFailure.waitFor({ state: "detached", timeout: 15_000 });
    assert.ok(apiFixture.fixture.ownerStateSaveAttempts >= 2, "the retry should send the failed owner save again");

    await ownerPage.evaluate(async (token) => {
      const api = await import("/src/lib/workspace.ts");
      const workspace = await api.getWorkspace(token);
      const state = structuredClone(workspace.state);
      state.logs.push({
        id: "owner-log-after-refresh",
        date: "2026-10-17",
        vehicleId: "test-vehicle",
        driverId: "",
        description: "Owner work entry after sign-in",
        hours: 6,
        amount: 8400,
        status: "Pending",
      });
      await api.saveOwnerWorkspace(token, state);

      const { createInvoiceHtml } = await import("/src/lib/invoice.ts");
      const receiptHtml = createInvoiceHtml({
        invoiceId: "TEST-RECEIPT-001",
        issuedAt: "2026-10-17",
        issuedTime: "10:00",
        businessName: "Test Fleet",
        companyName: "Test Fleet",
        ownerName: "Test Owner",
        phone: "9000000001",
        email: "",
        address: "",
        bankName: "",
        gstNumber: "",
        upiId: "",
        customerName: "Test Driver",
        customerPhone: "9000000000",
        customerCompany: "Driver payment",
        customerAddress: "",
        workStart: "2026-10-17",
        workEnd: "2026-10-17",
        serviceLocation: "Test Fleet",
        lines: [{ date: "2026-10-17", description: "Work entry", amount: 8400 }],
        total: 8400,
        balanceDue: 8400,
        status: "PENDING",
      });
      await api.sendDriverInvoice(token, "test-driver-user", "Persistence Receipt", receiptHtml);

      const ownerFile = new File(["owner-shared-document"], "owner-shared.pdf", { type: "application/pdf" });
      const ownerFilePath = await api.uploadWorkspaceFile(token, ownerFile);
      await api.sendDriverFile(token, "test-driver-member", {
        id: "owner-shared-file-client-id",
        name: ownerFile.name,
        type: ownerFile.type,
        dataUrl: ownerFilePath,
        uploadedAt: "2026-10-17",
      });
      return ownerFilePath;
    }, ownerToken);

    await ownerPage.reload();
    await ownerPage.locator(".fm-app-shell").waitFor({ timeout: 20_000 });
    const ownerAfterRefresh = await ownerPage.evaluate(async (token) => {
      const api = await import("/src/lib/workspace.ts");
      return api.getWorkspace(token);
    }, ownerToken);
    assert.equal(ownerAfterRefresh.role, "owner");
    assert.ok(ownerAfterRefresh.state.logs.some((log) => log.id === "owner-log-after-refresh"),
      "the owner's work-log change should be restored from the API after refresh");
    assert.ok(ownerAfterRefresh.invoices.some((invoice) => invoice.title === "Persistence Receipt"),
      "the generated receipt should be restored after refresh");
    assert.equal(ownerAfterRefresh.members[0].profile.sharedFiles[0].name, "owner-shared.pdf",
      "the owner-shared file should remain attached to the driver after refresh");

    const driverContext = await browser.newContext();
    await addAuthSession(driverContext, driverToken, driverUserId);
    await addMockRoutes(driverContext, apiFixture);
    const driverPage = await driverContext.newPage();
    await driverPage.goto(origin);
    await driverPage.locator(".fm-app-shell").waitFor({ timeout: 20_000 });
    assert.doesNotMatch(await driverPage.locator("body").innerText(), /Choose your Fleetvix workspace/,
      "an authenticated driver should restore directly into the joined workspace");
    const driverSaveFailure = driverPage.getByRole("alert").filter({ hasText: "Cloud save failed" });
    await driverSaveFailure.waitFor({ timeout: 15_000 });
    await driverPage.getByRole("button", { name: "Retry" }).click();
    await driverSaveFailure.waitFor({ state: "detached", timeout: 15_000 });
    assert.ok(apiFixture.fixture.driverStateSaveAttempts >= 2,
      "the retry should send the failed driver save again");

    const driverFilePath = await driverPage.evaluate(async (token) => {
      const api = await import("/src/lib/workspace.ts");
      const workspace = await api.getWorkspace(token);
      const profile = structuredClone(workspace.member.profile);
      const file = new File(["driver-license-document"], "driver-license.pdf", { type: "application/pdf" });
      const filePath = await api.uploadWorkspaceFile(token, file);
      profile.documents.push({
        id: "driver-document-client-id",
        name: file.name,
        type: file.type,
        dataUrl: filePath,
        uploadedAt: "2026-10-17",
      });
      await api.saveDriverProfile(token, profile);

      const state = structuredClone(workspace.state);
      state.logs.push({
        id: "driver-log-after-refresh",
        date: "2026-10-17",
        vehicleId: "test-vehicle",
        driverId: "test-driver-member",
        description: "Driver work entry after sign-in",
        hours: 8,
        amount: 1200,
        status: "Pending",
      });
      await api.saveDriverWorkspace(token, state);
      return filePath;
    }, driverToken);

    await driverPage.reload();
    await driverPage.locator(".fm-app-shell").waitFor({ timeout: 20_000 });
    const driverAfterRefresh = await driverPage.evaluate(async (token) => {
      const api = await import("/src/lib/workspace.ts");
      return api.getWorkspace(token);
    }, driverToken);
    assert.equal(driverAfterRefresh.role, "driver");
    assert.ok(driverAfterRefresh.state.logs.some((log) => log.id === "driver-log-after-refresh"),
      "the driver's work-log change should be restored after refresh");
    assert.ok(driverAfterRefresh.invoices.some((invoice) => invoice.title === "Persistence Receipt"),
      "the receipt should be available to its intended driver after refresh");
    assert.ok(driverAfterRefresh.member.profile.documents.some((file) => file.name === "driver-license.pdf"),
      "the driver's uploaded document should remain attached after refresh");
    assert.ok(driverAfterRefresh.member.profile.sharedFiles.some((file) => file.name === "owner-shared.pdf"),
      "the owner-shared file should remain available to the driver after refresh");

    await driverPage.goto(`${origin}/invoices`);
    await driverPage.locator(".fm-app-shell").waitFor({ timeout: 20_000 });
    await driverPage.getByText("Persistence Receipt").waitFor({ timeout: 10_000 });
    await driverPage.getByText("owner-shared.pdf").waitFor({ timeout: 10_000 });

    const fileDownloads = await driverPage.evaluate(async ({ token, paths }) => {
      const api = await import("/src/lib/workspace.ts");
      const documentBlob = await api.getWorkspaceFileBlob(token, paths.driverDocument);
      const sharedBlob = await api.getWorkspaceFileBlob(token, paths.sharedFile);
      const documentText = await documentBlob.text();
      const sharedText = await sharedBlob.text();
      let outsiderError = "";
      try {
        await api.getWorkspaceFileBlob(paths.outsiderToken, paths.driverDocument);
      } catch (error) {
        outsiderError = error instanceof Error ? error.message : String(error);
      }
      return { documentText, sharedText, outsiderError };
    }, {
      token: driverToken,
      paths: {
        driverDocument: driverFilePath,
        sharedFile: driverAfterRefresh.member.profile.sharedFiles[0].dataUrl,
        outsiderToken,
      },
    });
    assert.equal(fileDownloads.documentText, "driver-license-document");
    assert.equal(fileDownloads.sharedText, "owner-shared-document");
    assert.match(fileDownloads.outsiderError, /404|access/i,
      "an authenticated account outside the workspace must not download private files");

    await ownerPage.reload();
    await ownerPage.locator(".fm-app-shell").waitFor({ timeout: 20_000 });
    const finalOwnerState = await ownerPage.evaluate(async (token) => {
      const api = await import("/src/lib/workspace.ts");
      return api.getWorkspace(token);
    }, ownerToken);
    assert.equal(finalOwnerState.role, "owner");
    assert.ok(finalOwnerState.state.logs.some((log) => log.id === "driver-log-after-refresh"),
      "the owner's refreshed workspace should include the driver's saved work log");
    assert.ok(finalOwnerState.members[0].profile.documents.some((file) => file.name === "driver-license.pdf"),
      "the owner should be able to see the driver's uploaded document");
    const ownerDocumentText = await ownerPage.evaluate(async ({ token, filePath }) => {
      const api = await import("/src/lib/workspace.ts");
      return (await api.getWorkspaceFileBlob(token, filePath)).text();
    }, {
      token: ownerToken,
      filePath: finalOwnerState.members[0].profile.documents[0].dataUrl,
    });
    assert.equal(ownerDocumentText, "driver-license-document",
      "the owner should be able to download a driver's private document");

    await ownerPage.goto(`${origin}/logs`);
    await ownerPage.locator(".fm-app-shell").waitFor({ timeout: 20_000 });
    await ownerPage.getByRole("button", { name: /Logs Added/ }).click();
    await ownerPage.getByText("Owner work entry after sign-in").waitFor({ timeout: 10_000 });
    await ownerPage.getByText("Driver work entry after sign-in").waitFor({ timeout: 10_000 });

    await driverContext.close();
    await ownerContext.close();
  } finally {
    await browser?.close();
    child.kill("SIGTERM");
    if (child.exitCode === null) {
      await Promise.race([
        once(child, "exit"),
        new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000)),
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  }
});
