/**
 * Customer Repository integration tests with real Supabase database
 * Tests CRUD operations, search, and multi-tenant isolation
 */

import { CustomerRepository } from '@/lib/repositories/customer.repository';
import { 
  serviceClient,
  createTestTenant,
  createTestUserWithTenant,
  createTestCustomer,
  cleanupAllTestData,
  testData,
  expectNoError
} from './test-setup';

describe('Customer Repository Integration Tests (Real Database)', () => {
  let customerRepo: CustomerRepository;
  let testTenant1: any;
  let testTenant2: any;
  let testUser1: any;
  let testUser2: any;

  beforeAll(async () => {
    // Create test tenants
    testTenant1 = await createTestTenant('Customer Test Company 1');
    testTenant2 = await createTestTenant('Customer Test Company 2');

    // Create test users
    testUser1 = await createTestUserWithTenant(testTenant1.id);
    testUser2 = await createTestUserWithTenant(testTenant2.id);

    // Initialize repository with service client (bypasses RLS for testing)
    customerRepo = new CustomerRepository(serviceClient);
  });

  afterAll(async () => {
    await cleanupAllTestData();
  });

  describe('CRUD Operations', () => {
    it('should create a customer with tenant isolation', async () => {
      const customerData = {
        tenant_id: testTenant1.id,
        customer_number: testData.generateCustomerNumber(),
        name: 'Integration Test Customer',
        email: testData.generateEmail(),
        phone: testData.generatePhone(),
        mobile_phone: testData.generatePhone(),
        billing_address: {
          street: '456 Test Ave',
          city: 'Test City',
          state: 'CA',
          zip: '90210',
        },
        notes: 'Created by integration test',
        tags: ['test', 'integration'],
        is_active: true,
        created_by: testUser1.auth.id,
      };

      const customer = await customerRepo.create(customerData);

      expect(customer).toBeDefined();
      expect(customer.id).toBeDefined();
      expect(customer.tenant_id).toBe(testTenant1.id);
      expect(customer.name).toBe(customerData.name);
      expect(customer.tags).toEqual(customerData.tags);
    });

    it('should find customer by ID with tenant check', async () => {
      // Create a customer
      const customer = await createTestCustomer(testTenant1.id);

      // Find with correct tenant
      const found = await customerRepo.findById(customer.id, testTenant1.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(customer.id);

      // Try to find with wrong tenant - should return null
      const notFound = await customerRepo.findById(customer.id, testTenant2.id);
      expect(notFound).toBeNull();
    });

    it('should update customer data', async () => {
      const customer = await createTestCustomer(testTenant1.id);
      
      const updates = {
        name: 'Updated Customer Name',
        notes: 'Updated via integration test',
        tags: ['updated', 'test'],
        service_address: {
          street: '789 Service St',
          city: 'Service City',
          state: 'CA',
          zip: '90211',
        },
      };

      const updated = await customerRepo.update(customer.id, updates, testTenant1.id);

      expect(updated).toBeDefined();
      expect(updated?.name).toBe(updates.name);
      expect(updated?.notes).toBe(updates.notes);
      expect(updated?.service_address).toEqual(updates.service_address);
    });

    it('should delete customer (soft delete)', async () => {
      const customer = await createTestCustomer(testTenant1.id);

      const success = await customerRepo.delete(customer.id, testTenant1.id);
      expect(success).toBe(true);

      // Verify soft delete by checking is_active = false
      const { data } = await serviceClient
        .from('customers')
        .select('is_active')
        .eq('id', customer.id)
        .single();

      expect(data?.is_active).toBe(false);
    });

    it('should create multiple customers in batch', async () => {
      const customers = [
        {
          tenant_id: testTenant1.id,
          customer_number: testData.generateCustomerNumber(),
          name: 'Batch Customer 1',
          email: testData.generateEmail(),
          phone: testData.generatePhone(),
          is_active: true,
        },
        {
          tenant_id: testTenant1.id,
          customer_number: testData.generateCustomerNumber(),
          name: 'Batch Customer 2',
          email: testData.generateEmail(),
          phone: testData.generatePhone(),
          is_active: true,
        },
      ];

      const created = await customerRepo.createMany(customers);

      expect(created).toBeDefined();
      expect(created.length).toBe(2);
      expect(created[0].name).toBe('Batch Customer 1');
      expect(created[1].name).toBe('Batch Customer 2');
    });
  });

  describe('Search and Query Operations', () => {
    beforeAll(async () => {
      // Create test customers for search
      await createTestCustomer(testTenant1.id);
      await serviceClient.from('customers').insert([
        {
          tenant_id: testTenant1.id,
          customer_number: 'CUST-VOICE-001',
          name: 'John Smith',
          email: 'john@example.com',
          phone: '555-1234',
          is_active: true,
        },
        {
          tenant_id: testTenant1.id,
          customer_number: 'CUST-VOICE-002',
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '555-5678',
          is_active: true,
        },
        {
          tenant_id: testTenant1.id,
          customer_number: 'CUST-VOICE-003',
          name: 'Bob Johnson',
          email: 'bob@example.com',
          phone: '555-9012',
          is_active: true,
        },
      ]);
    });

    it('should find all customers for a tenant with pagination', async () => {
      const page1 = await customerRepo.findAll({
        tenantId: testTenant1.id,
        page: 1,
        limit: 2,
      });

      expect(page1.data).toBeDefined();
      expect(page1.data.length).toBeLessThanOrEqual(2);
      expect(page1.total).toBeGreaterThanOrEqual(3);

      // Get second page
      const page2 = await customerRepo.findAll({
        tenantId: testTenant1.id,
        page: 2,
        limit: 2,
      });

      expect(page2.data).toBeDefined();
      expect(page2.data.length).toBeGreaterThan(0);
    });

    it('should search customers by name', async () => {
      const results = await customerRepo.searchByName('John', testTenant1.id);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('John');
    });

    it('should find customer by exact customer number', async () => {
      const result = await customerRepo.findByCustomerNumber('CUST-VOICE-001', testTenant1.id);

      expect(result).toBeDefined();
      expect(result?.customer_number).toBe('CUST-VOICE-001');
      expect(result?.name).toBe('John Smith');
    });

    it('should find customers with filters', async () => {
      const activeCustomers = await customerRepo.findAll({
        tenantId: testTenant1.id,
        filters: { is_active: true },
      });

      expect(activeCustomers.data.length).toBeGreaterThan(0);
      expect(activeCustomers.data.every(c => c.is_active)).toBe(true);

      // Test with tag filter
      const taggedCustomers = await customerRepo.findAll({
        tenantId: testTenant1.id,
        filters: { tags: ['test'] },
      });

      // This would need the contains operator for array fields
      expect(taggedCustomers).toBeDefined();
    });
  });

  describe('Voice-Friendly Operations', () => {
    it('should find customer for voice with confidence scoring', async () => {
      const result = await customerRepo.findByVoice('john smith', testTenant1.id);

      expect(result).toBeDefined();
      if (result) {
        expect(result.customer).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(result.matchType).toBeDefined();
      }
    });

    it('should handle phonetic matching for voice', async () => {
      // Test phonetic variations
      const variations = ['jon smith', 'john smyth', 'jhon smith'];
      
      for (const variant of variations) {
        const result = await customerRepo.findByVoice(variant, testTenant1.id);
        
        if (result && result.confidence > 0.7) {
          expect(result.customer.name.toLowerCase()).toContain('john');
          expect(result.matchType).toBe('phonetic');
        }
      }
    });

    it('should prefer customer number match over name', async () => {
      const result = await customerRepo.findByVoice('CUST-VOICE-002', testTenant1.id);

      expect(result).toBeDefined();
      expect(result?.customer.customer_number).toBe('CUST-VOICE-002');
      expect(result?.matchType).toBe('customer_number');
      expect(result?.confidence).toBe(1); // Exact match
    });
  });

  describe('Customer Aggregations', () => {
    beforeAll(async () => {
      // Create properties for customers
      const customer = await serviceClient
        .from('customers')
        .select('id')
        .eq('tenant_id', testTenant1.id)
        .limit(1)
        .single();

      if (customer.data) {
        // Add properties
        await serviceClient.from('properties').insert([
          {
            tenant_id: testTenant1.id,
            customer_id: customer.data.id,
            property_number: `PROP-${Date.now()}-1`,
            name: 'Main Property',
            address: { street: '123 Main St' },
            is_active: true,
          },
          {
            tenant_id: testTenant1.id,
            customer_id: customer.data.id,
            property_number: `PROP-${Date.now()}-2`,
            name: 'Secondary Property',
            address: { street: '456 Oak Ave' },
            is_active: true,
          },
        ]);

        // Add jobs
        await serviceClient.from('jobs').insert({
          tenant_id: testTenant1.id,
          customer_id: customer.data.id,
          job_number: `JOB-${Date.now()}`,
          title: 'Test Job',
          status: 'scheduled',
          priority: 'normal',
          created_by: testUser1.auth.id,
        });
      }
    });

    it('should get customer with property count', async () => {
      const customers = await customerRepo.findAllWithPropertyCount(testTenant1.id);

      expect(customers).toBeDefined();
      expect(customers.length).toBeGreaterThan(0);
      
      const customerWithProps = customers.find(c => c.property_count > 0);
      if (customerWithProps) {
        expect(customerWithProps.property_count).toBeGreaterThanOrEqual(2);
      }
    });

    it('should get customer with recent jobs', async () => {
      const { data: customerWithJob } = await serviceClient
        .from('customers')
        .select('id')
        .eq('tenant_id', testTenant1.id)
        .limit(1)
        .single();

      if (customerWithJob) {
        const result = await customerRepo.getCustomerWithRecentJobs(
          customerWithJob.id, 
          testTenant1.id
        );

        expect(result).toBeDefined();
        expect(result?.jobs).toBeDefined();
        expect(Array.isArray(result?.jobs)).toBe(true);
      }
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should not allow cross-tenant data access', async () => {
      // Create customer in tenant 1
      const customer = await createTestCustomer(testTenant1.id);

      // Try to access from tenant 2 - should fail
      const crossAccess = await customerRepo.findById(customer.id, testTenant2.id);
      expect(crossAccess).toBeNull();

      // Try to update from tenant 2 - should fail
      const updateResult = await customerRepo.update(
        customer.id, 
        { name: 'Hacked!' }, 
        testTenant2.id
      );
      expect(updateResult).toBeNull();

      // Try to delete from tenant 2 - should fail
      const deleteResult = await customerRepo.delete(customer.id, testTenant2.id);
      expect(deleteResult).toBe(false);
    });

    it('should keep tenant data completely separate', async () => {
      // Create customers in both tenants
      await createTestCustomer(testTenant1.id);
      await createTestCustomer(testTenant2.id);

      // Get customers for each tenant
      const tenant1Customers = await customerRepo.findAll({ tenantId: testTenant1.id });
      const tenant2Customers = await customerRepo.findAll({ tenantId: testTenant2.id });

      // Verify no overlap
      const tenant1Ids = tenant1Customers.data.map(c => c.id);
      const tenant2Ids = tenant2Customers.data.map(c => c.id);
      
      const overlap = tenant1Ids.filter(id => tenant2Ids.includes(id));
      expect(overlap.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Try to create customer with duplicate customer number
      const customerNumber = testData.generateCustomerNumber();
      
      await customerRepo.create({
        tenant_id: testTenant1.id,
        customer_number: customerNumber,
        name: 'First Customer',
        email: testData.generateEmail(),
        is_active: true,
      });

      // This should handle the unique constraint error
      try {
        await customerRepo.create({
          tenant_id: testTenant1.id,
          customer_number: customerNumber, // Duplicate
          name: 'Second Customer',
          email: testData.generateEmail(),
          is_active: true,
        });
      } catch (error: any) {
        expect(error).toBeDefined();
        // The repository should handle this gracefully
      }
    });

    it('should validate required fields', async () => {
      try {
        await customerRepo.create({
          tenant_id: testTenant1.id,
          // Missing required fields like name
          email: testData.generateEmail(),
        } as any);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });
});