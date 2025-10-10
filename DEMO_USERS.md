# 🎭 Demo Users - Live CRUD Operations

## Demo User Credentials

### 👩‍💼 Supervisor Demo
- **Email**: `super@tophand.tech`
- **Password**: `demo123`
- **Role**: Supervisor
- **Access**: Full supervisor dashboard with job creation, customer management, crew oversight
- **Tenant**: `demo-tenant-12345` (isolated demo data)

### 👨‍🔧 Crew Demo
- **Email**: `crew@tophand.tech`
- **Password**: `demo123`
- **Role**: Crew
- **Access**: Crew dashboard with job execution, equipment verification, voice control
- **Tenant**: `demo-tenant-12345` (isolated demo data)

### 🛠️ Admin Demo
- **Email**: `admin@tophand.tech`
- **Password**: `demo123`
- **Role**: Admin
- **Access**: System administration, configuration workflows
- **Tenant**: `demo-tenant-12345` (isolated demo data)

## Live CRUD Operations

✅ **Real Database**: Demo users perform actual CRUD operations against Supabase
✅ **Data Isolation**: All demo data is isolated to `demo-tenant-12345` tenant
✅ **Full Functionality**: Create, read, update, delete customers, jobs, etc.
✅ **Authentication**: Real Supabase Auth integration (no mock mode)
✅ **Security**: RLS policies enforced for tenant isolation

## Usage

### Manual Login
1. Go to: https://jobeye-production.up.railway.app/sign-in
2. Enter demo credentials manually
3. Sign in normally

## Benefits

- **No Mock Data**: All operations use real Supabase database
- **Production Environment**: Same authentication flow as real users
- **Safe Testing**: Demo data isolated from production data
- **Easy Access**: Simple credentials for demonstrations
- **Full Features**: Access to all application functionality

## Database Schema

Demo users create real database records:
- **Customers**: `tenant_id: "demo-tenant-12345"`
- **Jobs**: `tenant_id: "demo-tenant-12345"`
- **Properties**: `tenant_id: "demo-tenant-12345"`
- All other entities isolated by tenant

## Verification

To verify demo operations in database:
```typescript
// Check demo customer records
const { data } = await supabase
  .from('customers')
  .select('*')
  .eq('tenant_id', 'demo-tenant-12345');
```

Created: 2025-10-02
Updated: 2025-10-02
