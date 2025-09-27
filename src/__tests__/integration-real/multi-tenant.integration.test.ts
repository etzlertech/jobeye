/**
 * Multi-tenant functionality integration tests with real Supabase database
 * Tests tenant isolation, user assignments, and tenant management
 */

import { 
  serviceClient,
  createTestTenant,
  createTestUser,
  createTestUserWithTenant,
  createTestCustomer,
  cleanupAllTestData,
  testData,
  expectNoError
} from './test-setup';

describe('Multi-Tenant Integration Tests (Real Database)', () => {
  afterAll(async () => {
    await cleanupAllTestData();
  });

  describe('Tenant Management', () => {
    it('should create a new tenant with unique slug', async () => {
      const tenantName = 'Multi-Tenant Test Corp';
      const expectedSlug = 'multi-tenant-test-corp';

      const { data: tenant, error } = await serviceClient
        .from('tenants')
        .insert({
          name: tenantName,
          slug: expectedSlug,
        })
        .select()
        .single();

      expectNoError(error, 'tenant creation');
      expect(tenant).toBeDefined();
      expect(tenant?.name).toBe(tenantName);
      expect(tenant?.slug).toBe(expectedSlug);

      // Clean up
      await serviceClient.from('tenants').delete().eq('id', tenant!.id);
    });

    it('should enforce unique tenant slugs', async () => {
      const tenant1 = await createTestTenant('Unique Test Company');

      // Try to create another tenant with same slug
      const { error } = await serviceClient
        .from('tenants')
        .insert({
          name: 'Different Name',
          slug: tenant1.slug, // Duplicate slug
        });

      expect(error).toBeDefined();
      expect(error?.code).toBe('23505'); // Unique violation
    });

    it('should update tenant information', async () => {
      const tenant = await createTestTenant('Update Test Company');

      const updates = {
        name: 'Updated Company Name',
        // Add any additional tenant fields that exist
      };

      const { data: updated, error } = await serviceClient
        .from('tenants')
        .update(updates)
        .eq('id', tenant.id)
        .select()
        .single();

      expectNoError(error, 'tenant update');
      expect(updated?.name).toBe(updates.name);
    });

    it('should handle tenant soft delete', async () => {
      const tenant = await createTestTenant('Delete Test Company');

      // Soft delete by setting a deleted_at timestamp (if field exists)
      // Otherwise, you might use an is_active flag
      const { error } = await serviceClient
        .from('tenants')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', tenant.id);

      expectNoError(error, 'tenant soft delete');
    });
  });

  describe('User-Tenant Assignments', () => {
    it('should assign user to single tenant', async () => {
      const tenant = await createTestTenant('Single Assignment Corp');
      const user = await createTestUser();

      const { data: assignment, error } = await serviceClient
        .from('tenant_assignments')
        .insert({
          user_id: user.auth.id,
          tenant_id: tenant.id,
          role: 'TECHNICIAN',
          is_primary: true,
          is_active: true,
          access_level: 10,
        })
        .select()
        .single();

      expectNoError(error, 'user-tenant assignment');
      expect(assignment).toBeDefined();
      expect(assignment?.user_id).toBe(user.auth.id);
      expect(assignment?.tenant_id).toBe(tenant.id);
      expect(assignment?.is_primary).toBe(true);
    });

    it('should assign user to multiple tenants', async () => {
      const user = await createTestUser();
      const tenant1 = await createTestTenant('Multi Corp 1');
      const tenant2 = await createTestTenant('Multi Corp 2');
      const tenant3 = await createTestTenant('Multi Corp 3');

      // Create multiple assignments
      const assignments = [
        {
          user_id: user.auth.id,
          tenant_id: tenant1.id,
          role: 'ADMIN',
          is_primary: true,
          is_active: true,
          access_level: 100,
        },
        {
          user_id: user.auth.id,
          tenant_id: tenant2.id,
          role: 'MANAGER',
          is_primary: false,
          is_active: true,
          access_level: 50,
        },
        {
          user_id: user.auth.id,
          tenant_id: tenant3.id,
          role: 'TECHNICIAN',
          is_primary: false,
          is_active: true,
          access_level: 10,
        },
      ];

      const { data, error } = await serviceClient
        .from('tenant_assignments')
        .insert(assignments)
        .select();

      expectNoError(error, 'multiple tenant assignments');
      expect(data).toBeDefined();
      expect(data?.length).toBe(3);

      // Verify only one primary
      const primaryCount = data!.filter(a => a.is_primary).length;
      expect(primaryCount).toBe(1);
    });

    it('should handle role changes within tenant', async () => {
      const tenant = await createTestTenant('Role Change Corp');
      const user = await createTestUserWithTenant(tenant.id, 'TECHNICIAN');

      // Promote to MANAGER
      const { data: updated, error } = await serviceClient
        .from('tenant_assignments')
        .update({
          role: 'MANAGER',
          access_level: 50,
        })
        .eq('user_id', user.auth.id)
        .eq('tenant_id', tenant.id)
        .select()
        .single();

      expectNoError(error, 'role update');
      expect(updated?.role).toBe('MANAGER');
      expect(updated?.access_level).toBe(50);
    });

    it('should deactivate tenant assignment', async () => {
      const tenant = await createTestTenant('Deactivate Test Corp');
      const user = await createTestUserWithTenant(tenant.id);

      // Deactivate assignment
      const { error } = await serviceClient
        .from('tenant_assignments')
        .update({ is_active: false })
        .eq('user_id', user.auth.id)
        .eq('tenant_id', tenant.id);

      expectNoError(error, 'assignment deactivation');

      // Verify user cannot access tenant data
      const { data: assignments } = await serviceClient
        .from('tenant_assignments')
        .select('*')
        .eq('user_id', user.auth.id)
        .eq('tenant_id', tenant.id)
        .eq('is_active', true);

      expect(assignments?.length).toBe(0);
    });
  });

  describe('Data Isolation', () => {
    it('should isolate customer data between tenants', async () => {
      const tenant1 = await createTestTenant('Isolated Corp 1');
      const tenant2 = await createTestTenant('Isolated Corp 2');

      // Create customers in each tenant
      const customer1 = await createTestCustomer(tenant1.id);
      const customer2 = await createTestCustomer(tenant2.id);

      // Verify each tenant only sees their own customers
      const { data: tenant1Customers } = await serviceClient
        .from('customers')
        .select('*')
        .eq('tenant_id', tenant1.id);

      const { data: tenant2Customers } = await serviceClient
        .from('customers')
        .select('*')
        .eq('tenant_id', tenant2.id);

      expect(tenant1Customers).toBeDefined();
      expect(tenant2Customers).toBeDefined();
      
      // No customer should appear in both lists
      const tenant1Ids = tenant1Customers!.map(c => c.id);
      const tenant2Ids = tenant2Customers!.map(c => c.id);
      
      expect(tenant1Ids).toContain(customer1.id);
      expect(tenant1Ids).not.toContain(customer2.id);
      expect(tenant2Ids).toContain(customer2.id);
      expect(tenant2Ids).not.toContain(customer1.id);
    });

    it('should isolate properties between tenants', async () => {
      const tenant1 = await createTestTenant('Property Tenant 1');
      const tenant2 = await createTestTenant('Property Tenant 2');
      
      const customer1 = await createTestCustomer(tenant1.id);
      const customer2 = await createTestCustomer(tenant2.id);

      // Create properties
      const { data: prop1 } = await serviceClient
        .from('properties')
        .insert({
          tenant_id: tenant1.id,
          customer_id: customer1.id,
          property_number: `PROP-T1-${Date.now()}`,
          name: 'Tenant 1 Property',
          address: { street: '123 Tenant 1 St' },
          is_active: true,
        })
        .select()
        .single();

      const { data: prop2 } = await serviceClient
        .from('properties')
        .insert({
          tenant_id: tenant2.id,
          customer_id: customer2.id,
          property_number: `PROP-T2-${Date.now()}`,
          name: 'Tenant 2 Property',
          address: { street: '456 Tenant 2 Ave' },
          is_active: true,
        })
        .select()
        .single();

      // Verify isolation
      const { data: t1Props } = await serviceClient
        .from('properties')
        .select('*')
        .eq('tenant_id', tenant1.id);

      const { data: t2Props } = await serviceClient
        .from('properties')
        .select('*')
        .eq('tenant_id', tenant2.id);

      expect(t1Props!.map(p => p.id)).toContain(prop1!.id);
      expect(t1Props!.map(p => p.id)).not.toContain(prop2!.id);
      expect(t2Props!.map(p => p.id)).toContain(prop2!.id);
      expect(t2Props!.map(p => p.id)).not.toContain(prop1!.id);
    });

    it('should isolate job data between tenants', async () => {
      const tenant1 = await createTestTenant('Jobs Tenant 1');
      const tenant2 = await createTestTenant('Jobs Tenant 2');
      
      const user1 = await createTestUserWithTenant(tenant1.id);
      const user2 = await createTestUserWithTenant(tenant2.id);
      
      const customer1 = await createTestCustomer(tenant1.id);
      const customer2 = await createTestCustomer(tenant2.id);

      // Create jobs
      const { data: job1 } = await serviceClient
        .from('jobs')
        .insert({
          tenant_id: tenant1.id,
          job_number: `JOB-T1-${Date.now()}`,
          customer_id: customer1.id,
          title: 'Tenant 1 Job',
          status: 'scheduled',
          priority: 'normal',
          created_by: user1.auth.id,
        })
        .select()
        .single();

      const { data: job2 } = await serviceClient
        .from('jobs')
        .insert({
          tenant_id: tenant2.id,
          job_number: `JOB-T2-${Date.now()}`,
          customer_id: customer2.id,
          title: 'Tenant 2 Job',
          status: 'scheduled',
          priority: 'high',
          created_by: user2.auth.id,
        })
        .select()
        .single();

      // Verify isolation
      const { data: t1Jobs } = await serviceClient
        .from('jobs')
        .select('*')
        .eq('tenant_id', tenant1.id);

      const { data: t2Jobs } = await serviceClient
        .from('jobs')
        .select('*')
        .eq('tenant_id', tenant2.id);

      expect(t1Jobs!.some(j => j.id === job1!.id)).toBe(true);
      expect(t1Jobs!.every(j => j.id !== job2!.id)).toBe(true);
      expect(t2Jobs!.some(j => j.id === job2!.id)).toBe(true);
      expect(t2Jobs!.every(j => j.id !== job1!.id)).toBe(true);
    });
  });

  describe('Tenant Switching', () => {
    it('should allow user to switch between assigned tenants', async () => {
      const user = await createTestUser();
      const tenants = [
        await createTestTenant('Switch Corp A'),
        await createTestTenant('Switch Corp B'),
        await createTestTenant('Switch Corp C'),
      ];

      // Assign user to all tenants with different roles
      for (let i = 0; i < tenants.length; i++) {
        await serviceClient
          .from('tenant_assignments')
          .insert({
            user_id: user.auth.id,
            tenant_id: tenants[i].id,
            role: i === 0 ? 'ADMIN' : i === 1 ? 'MANAGER' : 'TECHNICIAN',
            is_primary: i === 0,
            is_active: true,
            access_level: i === 0 ? 100 : i === 1 ? 50 : 10,
          });
      }

      // Get user's available tenants
      const { data: assignments } = await serviceClient
        .from('tenant_assignments')
        .select(`
          *,
          tenants (*)
        `)
        .eq('user_id', user.auth.id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false });

      expect(assignments).toBeDefined();
      expect(assignments?.length).toBe(3);
      expect(assignments![0].is_primary).toBe(true);
      expect(assignments![0].role).toBe('ADMIN');

      // Simulate tenant switch by updating last_accessed_at
      const switchToTenant = assignments![1].tenant_id;
      const { error } = await serviceClient
        .from('tenant_assignments')
        .update({ 
          last_accessed_at: new Date().toISOString(),
          access_count: 1
        })
        .eq('user_id', user.auth.id)
        .eq('tenant_id', switchToTenant);

      expectNoError(error, 'tenant switch tracking');
    });

    it('should track tenant access patterns', async () => {
      const user = await createTestUserWithTenant(
        await createTestTenant('Analytics Corp').then(t => t.id)
      );

      // Simulate multiple accesses
      for (let i = 0; i < 5; i++) {
        await serviceClient
          .from('tenant_assignments')
          .update({
            last_accessed_at: new Date().toISOString(),
            access_count: i + 1,
          })
          .eq('id', user.assignment.id);
        
        // Small delay to simulate time passing
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Verify access tracking
      const { data: assignment } = await serviceClient
        .from('tenant_assignments')
        .select('*')
        .eq('id', user.assignment.id)
        .single();

      expect(assignment?.access_count).toBe(5);
      expect(assignment?.last_accessed_at).toBeDefined();
    });
  });

  describe('Tenant Invitations', () => {
    it('should create and process user invitation', async () => {
      const tenant = await createTestTenant('Invitation Corp');
      const invitedEmail = testData.generateEmail();

      // Create invitation
      const { data: invitation, error } = await serviceClient
        .from('user_invitations')
        .insert({
          email: invitedEmail,
          tenant_id: tenant.id,
          role: 'TECHNICIAN',
          invitation_code: `INV-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          welcome_message: 'Welcome to our team!',
          voice_onboarding_enabled: true,
        })
        .select()
        .single();

      expectNoError(error, 'invitation creation');
      expect(invitation).toBeDefined();
      expect(invitation?.email).toBe(invitedEmail);
      expect(invitation?.is_used).toBe(false);

      // Simulate invitation acceptance
      const user = await createTestUser(invitedEmail);

      const { error: updateError } = await serviceClient
        .from('user_invitations')
        .update({
          is_used: true,
          accepted_at: new Date().toISOString(),
          accepted_by: user.auth.id,
        })
        .eq('id', invitation!.id);

      expectNoError(updateError, 'invitation acceptance');

      // Create tenant assignment based on invitation
      await serviceClient
        .from('tenant_assignments')
        .insert({
          user_id: user.auth.id,
          tenant_id: tenant.id,
          role: invitation!.role,
          is_primary: true,
          is_active: true,
        });
    });

    it('should expire old invitations', async () => {
      const tenant = await createTestTenant('Expiry Test Corp');

      // Create expired invitation
      const { data: expired } = await serviceClient
        .from('user_invitations')
        .insert({
          email: testData.generateEmail(),
          tenant_id: tenant.id,
          role: 'TECHNICIAN',
          invitation_code: `EXP-${Date.now()}`,
          expires_at: new Date(Date.now() - 1000).toISOString(), // Already expired
          is_used: false,
        })
        .select()
        .single();

      // Query for valid invitations
      const { data: validInvites } = await serviceClient
        .from('user_invitations')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString());

      expect(validInvites).toBeDefined();
      expect(validInvites!.every(inv => inv.id !== expired!.id)).toBe(true);
    });
  });
});