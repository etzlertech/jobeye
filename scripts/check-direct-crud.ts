#\!/usr/bin/env npx tsx
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL\!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY\!;

async function checkSchema() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log("🏗️ Testing direct CRUD operations...\n");

  // Test direct customer creation
  const testCustomer = {
    name: "Direct API Test Customer",
    email: "direct.api@test.com",
    phone: "(555) 999-9999",
    address: "123 API Test Street"
  };

  const { data: createResult, error: createError } = await client
    .from("customers")
    .insert(testCustomer)
    .select();

  if (createError) {
    console.error("❌ Direct create failed:", createError);
  } else {
    console.log("✅ Direct create successful:", createResult);
  }
}

checkSchema().catch(console.error);
