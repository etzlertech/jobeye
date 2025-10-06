/**
 * @file Integration test for ESLint cleanup rules
 */

import { ESLint } from "eslint";
import path from "path";

const cleanupPlugin = require(path.join(process.cwd(), "packages", "eslint-plugin-cleanup"));

function createEslint(): ESLint {
  return new ESLint({
    overrideConfigFile: false,
    overrideConfig: {
      plugins: {
        cleanup: cleanupPlugin,
      },
      rules: {
        "cleanup/no-company-id": "error",
        "cleanup/repository-class-pattern": "error",
      },
    },
  });
}

describe("ESLint Cleanup Rules Integration", () => {
  it("detects company_id violations", async () => {
    const eslint = createEslint();
    const code = [
      "interface User {",
      "  id: string;",
      "  company_id: string; // violation",
      "}",
      "",
      "export function getUsers(company_id: string) { // violation",
      "  const query = {",
      "    where: { company_id }, // violation",
      "  };",
      "",
      "  return database.users.filter((u) => u.company_id === company_id); // violation",
      "}",
      "",
      "export function getByTenant(tenant_id: string) {",
      "  return database.users.filter((u) => u.tenant_id === tenant_id);",
      "}",
    ].join("\n");

    const [result] = await eslint.lintText(code, { filePath: "company.ts" });
    const tenantErrors = result.messages.filter((message) => message.ruleId === "cleanup/no-company-id");
    expect(tenantErrors.length).toBeGreaterThan(0);
  });

  it("detects functional repository patterns", async () => {
    const eslint = createEslint();
    const code = [
      "import { createClient } from \"@supabase/supabase-js\";",
      "",
      "export function createUser(data: any) { // violation",
      "  const client = createClient(url, key);",
      "  return client.from(\"users\").insert(data);",
      "}",
      "",
      "export function findUserById(id: string) { // violation",
      "  const client = createClient(url, key);",
      "  return client.from(\"users\").select('*').eq('id', id).single();",
      "}",
    ].join("\n");

    const [result] = await eslint.lintText(code, { filePath: "repository.ts" });
    const repoErrors = result.messages.filter((message) => message.ruleId === "cleanup/repository-class-pattern");
    expect(repoErrors.length).toBeGreaterThan(0);
  });

  it("allows valid class-based repositories", async () => {
    const eslint = createEslint();
    const code = [
      "class BaseRepository {",
      "  constructor(public client: any, public tableName: string) {}",
      "}",
      "",
      "export class UserRepository extends BaseRepository {",
      "  constructor(client: any) {",
      "    super(client, \"users\");",
      "  }",
      "",
      "  async findByTenantId(tenant_id: string) {",
      "    return this.client.from(this.tableName).select('*').eq('tenant_id', tenant_id);",
      "  }",
      "}",
    ].join("\n");

    const [result] = await eslint.lintText(code, { filePath: "valid.ts" });
    expect(result.errorCount).toBe(0);
  });
});
