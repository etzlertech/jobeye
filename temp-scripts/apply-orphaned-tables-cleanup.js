#!/usr/bin/env npx tsx
"use strict";
/**
 * Apply the orphaned tables cleanup migration using exec_sql RPC
 * Ensures each statement in the migration runs sequentially
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var supabase_js_1 = require("@supabase/supabase-js");
var dotenv_1 = __importDefault(require("dotenv"));
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var chalk_1 = __importDefault(require("chalk"));
dotenv_1.default.config({ path: '.env.local' });
var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
var supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}
var migrationPath = path_1.default.join(__dirname, '..', 'supabase', 'migrations', '060_remove_orphaned_tables.sql');
if (!fs_1.default.existsSync(migrationPath)) {
    console.error('Migration file 060_remove_orphaned_tables.sql not found');
    process.exit(1);
}
var client = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
function parseStatements(sql) {
    var statements = [];
    var buffer = '';
    var inDollarQuote = false;
    var dollarTag = '';
    var counter = 0;
    for (var _i = 0, _a = sql.split('\n'); _i < _a.length; _i++) {
        var line = _a[_i];
        var trimmed = line.trim();
        var dollarMatch = trimmed.match(/\$(\w*)\$/);
        if (dollarMatch) {
            if (!inDollarQuote) {
                inDollarQuote = true;
                dollarTag = dollarMatch[0];
            }
            else if (trimmed.includes(dollarTag)) {
                inDollarQuote = false;
                dollarTag = '';
            }
        }
        buffer += line + '\n';
        if (!inDollarQuote && trimmed.endsWith(';')) {
            var statement = buffer.trim();
            if (statement.length > 0 && !statement.startsWith('--')) {
                statements.push({ index: ++counter, sql: statement });
            }
            buffer = '';
        }
    }
    if (buffer.trim().length > 0) {
        statements.push({ index: ++counter, sql: buffer.trim() });
    }
    return statements;
}
function applyStatements(items) {
    return __awaiter(this, void 0, void 0, function () {
        var success, failure, _i, items_1, item, preview, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    success = 0;
                    failure = 0;
                    _i = 0, items_1 = items;
                    _a.label = 1;
                case 1:
                    if (!(_i < items_1.length)) return [3 /*break*/, 4];
                    item = items_1[_i];
                    preview = item.sql.replace(/\s+/g, ' ').slice(0, 60);
                    console.log(chalk_1.default.blue("[".concat(item.index, "/").concat(items.length, "] ").concat(preview, "...")));
                    return [4 /*yield*/, client.rpc('exec_sql', { sql: item.sql })];
                case 2:
                    error = (_a.sent()).error;
                    if (error) {
                        failure += 1;
                        console.log(chalk_1.default.red("   Failed: ".concat(error.message)));
                    }
                    else {
                        success += 1;
                        console.log(chalk_1.default.green('   Applied'));
                    }
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log('\nSummary');
                    console.log("  Successful statements: ".concat(success));
                    console.log("  Failed statements: ".concat(failure));
                    if (failure > 0) {
                        console.log(chalk_1.default.yellow('\nSome statements failed. Review Supabase logs or run manually.'));
                        process.exit(1);
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function verifyRemoval() {
    return __awaiter(this, void 0, void 0, function () {
        var tables, _i, tables_1, table, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tables = [
                        'table_inventory',
                        'migration_tracking',
                        'background_filter_preferences',
                        'offline_sync_queue',
                        'service_history',
                        'time_entries',
                        'load_verifications',
                        'route_stops',
                        'routes'
                    ];
                    console.log('\nVerification');
                    _i = 0, tables_1 = tables;
                    _a.label = 1;
                case 1:
                    if (!(_i < tables_1.length)) return [3 /*break*/, 4];
                    table = tables_1[_i];
                    return [4 /*yield*/, client
                            .from(table)
                            .select('id')
                            .limit(1)];
                case 2:
                    error = (_a.sent()).error;
                    if (error && error.message.includes('does not exist')) {
                        console.log(chalk_1.default.green("  ".concat(table, ": removed")));
                    }
                    else if (error) {
                        console.log(chalk_1.default.yellow("  ".concat(table, ": verification error - ").concat(error.message)));
                    }
                    else {
                        console.log(chalk_1.default.red("  ".concat(table, ": still present")));
                    }
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var sql, statements;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.bold('Applying orphaned tables cleanup migration\n'));
                    sql = fs_1.default.readFileSync(migrationPath, 'utf8');
                    statements = parseStatements(sql);
                    if (statements.length === 0) {
                        console.log('No statements found in migration file.');
                        return [2 /*return*/];
                    }
                    console.log("Found ".concat(statements.length, " statements"));
                    return [4 /*yield*/, applyStatements(statements)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, verifyRemoval()];
                case 2:
                    _a.sent();
                    console.log('\nNext steps:');
                    console.log('  npm run generate:types');
                    console.log('  npx tsx scripts/get-all-tables-direct.ts');
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (error) {
    console.error(error);
    process.exit(1);
});
