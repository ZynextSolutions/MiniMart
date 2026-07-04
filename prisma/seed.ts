import {
  PrismaClient,
  AccountSubtype,
  AccountType,
  DocumentStatus,
  MovementType,
  PaymentMethod,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { PERMISSION_DEFINITIONS } from "../src/lib/permissions/permissions";
import { ROLE_DESCRIPTIONS, ROLE_PERMISSION_MAP, SYSTEM_ROLES } from "../src/lib/permissions/roles";
import {
  modulesForPlanSlug,
  PLATFORM_MODULES,
  moduleFlagKey,
} from "../src/platform/modules/platform-modules";

const prisma = new PrismaClient();

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const BRANCH_ID = "00000000-0000-0000-0000-000000000002";
const WAREHOUSE_ID = "00000000-0000-0000-0000-000000000003";
const REGISTER_ID = "00000000-0000-0000-0000-000000000004";
const VAT_ID = "00000000-0000-0000-0000-000000000010";
const FY_ID = "00000000-0000-0000-0000-000000000011";
const STARTER_PLAN_ID = "00000000-0000-0000-0000-000000000020";
const PRO_PLAN_ID = "00000000-0000-0000-0000-000000000021";
const PLATFORM_USER_ID = "00000000-0000-0000-0000-000000000030";

const UNSPLASH = {
  category: [
    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1604719312566-8912e9c8a213?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1506617564039-2f3b650b7010?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
  ],
  brand: [
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=1200&q=80",
  ],
  product: [
    "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1590080875852-ba44f83ff2e2?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1577234286642-fc512a5f8f11?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=1200&q=80",
  ],
};

const CHART_OF_ACCOUNTS = [
  { code: "1000", name: "Assets", type: AccountType.ASSET, subtype: AccountSubtype.OTHER, normalBalance: "DEBIT", isSystem: true },
  { code: "1100", name: "Cash on Hand", type: AccountType.ASSET, subtype: AccountSubtype.CASH, normalBalance: "DEBIT", isSystem: true },
  { code: "1110", name: "Petty Cash", type: AccountType.ASSET, subtype: AccountSubtype.PETTY_CASH, normalBalance: "DEBIT", isSystem: true },
  { code: "1200", name: "Bank Accounts", type: AccountType.ASSET, subtype: AccountSubtype.BANK, normalBalance: "DEBIT", isSystem: true },
  { code: "1300", name: "Accounts Receivable", type: AccountType.ASSET, subtype: AccountSubtype.ACCOUNTS_RECEIVABLE, normalBalance: "DEBIT", isSystem: true },
  { code: "1400", name: "Inventory", type: AccountType.ASSET, subtype: AccountSubtype.INVENTORY, normalBalance: "DEBIT", isSystem: true },
  { code: "1500", name: "Fixed Assets", type: AccountType.ASSET, subtype: AccountSubtype.FIXED_ASSET, normalBalance: "DEBIT", isSystem: true },
  { code: "1510", name: "Accumulated Depreciation", type: AccountType.ASSET, subtype: AccountSubtype.ACCUMULATED_DEPRECIATION, normalBalance: "CREDIT", isSystem: true },
  { code: "2000", name: "Liabilities", type: AccountType.LIABILITY, subtype: AccountSubtype.OTHER, normalBalance: "CREDIT", isSystem: true },
  { code: "2100", name: "Accounts Payable", type: AccountType.LIABILITY, subtype: AccountSubtype.ACCOUNTS_PAYABLE, normalBalance: "CREDIT", isSystem: true },
  { code: "2200", name: "Sales Tax Payable", type: AccountType.LIABILITY, subtype: AccountSubtype.SALES_TAX_PAYABLE, normalBalance: "CREDIT", isSystem: true },
  { code: "2300", name: "Gift Card Liability", type: AccountType.LIABILITY, subtype: AccountSubtype.OTHER, normalBalance: "CREDIT", isSystem: true },
  { code: "3000", name: "Equity", type: AccountType.EQUITY, subtype: AccountSubtype.OTHER, normalBalance: "CREDIT", isSystem: true },
  { code: "3100", name: "Retained Earnings", type: AccountType.EQUITY, subtype: AccountSubtype.RETAINED_EARNINGS, normalBalance: "CREDIT", isSystem: true },
  { code: "4000", name: "Revenue", type: AccountType.REVENUE, subtype: AccountSubtype.OTHER, normalBalance: "CREDIT", isSystem: true },
  { code: "4100", name: "Sales Revenue", type: AccountType.REVENUE, subtype: AccountSubtype.SALES_REVENUE, normalBalance: "CREDIT", isSystem: true },
  { code: "4200", name: "Other Income", type: AccountType.REVENUE, subtype: AccountSubtype.OTHER, normalBalance: "CREDIT", isSystem: true },
  { code: "5000", name: "Expenses", type: AccountType.EXPENSE, subtype: AccountSubtype.OTHER, normalBalance: "DEBIT", isSystem: true },
  { code: "5100", name: "Cost of Goods Sold", type: AccountType.EXPENSE, subtype: AccountSubtype.COGS, normalBalance: "DEBIT", isSystem: true },
  { code: "5200", name: "Operating Expenses", type: AccountType.EXPENSE, subtype: AccountSubtype.OTHER, normalBalance: "DEBIT", isSystem: true },
];

function toDateOnly(d: Date) {
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function randomFrom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function numberFromCode(code: string, fallback = 0): number {
  const parsed = Number(code.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function seedSecurityAndAuth() {
  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: { currency: "MMK", timezone: "Asia/Yangon", country: "MM", slug: "mini-mart", status: "ACTIVE" },
    create: {
      id: ORG_ID,
      name: "Mini Mart",
      slug: "mini-mart",
      legalName: "Mini Mart Co., Ltd.",
      email: "info@minimart.com",
      phone: "02-123-4567",
      address: "123 Sukhumvit Road",
      city: "Bangkok",
      country: "MM",
      currency: "MMK",
      timezone: "Asia/Yangon",
      status: "ACTIVE",
    },
  });

  const branch = await prisma.branch.upsert({
    where: { id: BRANCH_ID },
    update: {},
    create: {
      id: BRANCH_ID,
      organizationId: org.id,
      code: "HQ",
      name: "Head Office",
      address: "Downtown Yangon",
      isDefault: true,
      isActive: true,
    },
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { id: WAREHOUSE_ID },
    update: {},
    create: {
      id: WAREHOUSE_ID,
      organizationId: org.id,
      branchId: branch.id,
      code: "WH-01",
      name: "Main Warehouse",
      isDefault: true,
      isActive: true,
    },
  });

  const cashRegister = await prisma.cashRegister.upsert({
    where: { id: REGISTER_ID },
    update: {},
    create: {
      id: REGISTER_ID,
      branchId: branch.id,
      code: "REG-01",
      name: "Register 1",
      isActive: true,
    },
  });

  for (const perm of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: perm,
    });
  }

  const allPermissions = await prisma.permission.findMany();
  const permissionMap = new Map(allPermissions.map((p) => [p.code, p.id]));
  const roles: Record<string, string> = {};

  for (const [roleName, description] of Object.entries(ROLE_DESCRIPTIONS)) {
    const role = await prisma.role.upsert({
      where: { organizationId_name: { organizationId: org.id, name: roleName } },
      update: { description },
      create: { organizationId: org.id, name: roleName, description, isSystem: true },
    });
    roles[roleName] = role.id;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    const permCodes = ROLE_PERMISSION_MAP[roleName as keyof typeof ROLE_PERMISSION_MAP];
    for (const code of permCodes) {
      const permissionId = permissionMap.get(code);
      if (permissionId) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId } });
      }
    }
  }

  const passwordHash = await bcrypt.hash("Admin@123", 12);
  const users = [
    { email: "admin@minimart.com", firstName: "System", lastName: "Admin", role: SYSTEM_ROLES.OWNER },
    { email: "manager@minimart.com", firstName: "Store", lastName: "Manager", role: SYSTEM_ROLES.MANAGER },
    { email: "cashier@minimart.com", firstName: "Front", lastName: "Cashier", role: SYSTEM_ROLES.CASHIER },
  ] as const;

  const userMap: Record<string, string> = {};
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { organizationId_email: { organizationId: org.id, email: u.email } },
      update: { firstName: u.firstName, lastName: u.lastName, isActive: true },
      create: {
        organizationId: org.id,
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        isActive: true,
      },
    });
    userMap[u.email] = user.id;

    await prisma.userBranchRole.upsert({
      where: {
        userId_branchId_roleId: {
          userId: user.id,
          branchId: branch.id,
          roleId: roles[u.role],
        },
      },
      update: {},
      create: {
        userId: user.id,
        branchId: branch.id,
        roleId: roles[u.role],
      },
    });
  }

  return { org, branch, warehouse, cashRegister, userMap };
}

async function seedPlatformLayer(orgId: string) {
  const starterModules = modulesForPlanSlug("starter");
  const starterPlan = await prisma.plan.upsert({
    where: { id: STARTER_PLAN_ID },
    update: {
      currency: "MMK",
      limits: {
        maxBranches: 1,
        maxUsers: 3,
        maxProducts: 100,
        maxWarehouses: 1,
        modules: starterModules,
      },
    },
    create: {
      id: STARTER_PLAN_ID,
      name: "Starter",
      slug: "starter",
      description: "For small businesses getting started",
      price: 0,
      currency: "MMK",
      billingInterval: "MONTHLY",
      trialDays: 14,
      limits: {
        maxBranches: 1,
        maxUsers: 3,
        maxProducts: 100,
        maxWarehouses: 1,
        modules: starterModules,
      },
      features: [],
      isActive: true,
      sortOrder: 1,
    },
  });

  const proModules = modulesForPlanSlug("professional");
  await prisma.plan.upsert({
    where: { id: PRO_PLAN_ID },
    update: {
      currency: "MMK",
      limits: {
        maxBranches: 5,
        maxUsers: 20,
        maxProducts: 5000,
        maxWarehouses: 10,
        modules: proModules,
      },
    },
    create: {
      id: PRO_PLAN_ID,
      name: "Professional",
      slug: "professional",
      description: "For growing businesses with multiple branches",
      price: 49,
      currency: "MMK",
      billingInterval: "MONTHLY",
      trialDays: 14,
      limits: {
        maxBranches: 5,
        maxUsers: 20,
        maxProducts: 5000,
        maxWarehouses: 10,
        modules: proModules,
      },
      features: [],
      isActive: true,
      sortOrder: 2,
    },
  });

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  const subscription = await prisma.subscription.upsert({
    where: { organizationId: orgId },
    update: { planId: starterPlan.id, status: "ACTIVE" },
    create: {
      organizationId: orgId,
      planId: starterPlan.id,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  await prisma.subscriptionEvent.create({
    data: {
      subscriptionId: subscription.id,
      status: "ACTIVE",
      note: "Seed subscription",
    },
  });

  const platformAdminPassword = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!platformAdminPassword) {
    console.warn(
      "PLATFORM_ADMIN_PASSWORD not set; platform admin password will not be created or rotated.",
    );
  }

  const platformPasswordHash = platformAdminPassword
    ? await bcrypt.hash(platformAdminPassword, 12)
    : undefined;

  await prisma.platformUser.upsert({
    where: { id: PLATFORM_USER_ID },
    update: {
      email: "superadmin@platform.com",
      ...(platformPasswordHash ? { passwordHash: platformPasswordHash } : {}),
      isActive: true,
    },
    create: {
      id: PLATFORM_USER_ID,
      email: "superadmin@platform.com",
      passwordHash:
        platformPasswordHash ??
        (await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12)),
      firstName: "Super",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  for (const mod of PLATFORM_MODULES) {
    await prisma.featureFlag.upsert({
      where: { key: moduleFlagKey(mod.key) },
      update: { name: mod.label, description: mod.description },
      create: {
        key: moduleFlagKey(mod.key),
        name: mod.label,
        description: mod.description,
        isEnabled: true,
      },
    });
  }

  const flags = [
    { key: "pos.offline", name: "Offline POS (legacy)", description: "Use module.offline_pos instead", isEnabled: false },
    { key: "reports.export", name: "Report Export", description: "PDF and Excel export", isEnabled: true },
    { key: "api.access", name: "API Access (legacy)", description: "Use module.api instead", isEnabled: false },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { name: flag.name, description: flag.description },
      create: flag,
    });
  }
}

async function seedAccountingMaster(orgId: string) {
  await prisma.taxRate.upsert({
    where: { id: VAT_ID },
    update: { rate: 0.05, name: "Commercial Tax 5%", isDefault: true, isActive: true },
    create: {
      id: VAT_ID,
      organizationId: orgId,
      name: "Commercial Tax 5%",
      rate: 0.05,
      isDefault: true,
      isActive: true,
    },
  });

  const currentYear = new Date().getFullYear();
  const fiscalYear = await prisma.fiscalYear.upsert({
    where: { id: FY_ID },
    update: { startDate: new Date(`${currentYear}-01-01`), endDate: new Date(`${currentYear}-12-31`), isClosed: false },
    create: {
      id: FY_ID,
      organizationId: orgId,
      name: `FY ${currentYear}`,
      startDate: new Date(`${currentYear}-01-01`),
      endDate: new Date(`${currentYear}-12-31`),
      isClosed: false,
    },
  });

  for (let month = 0; month < 12; month++) {
    const startDate = new Date(currentYear, month, 1);
    const endDate = new Date(currentYear, month + 1, 0);
    const monthName = startDate.toLocaleString("en", { month: "long" });
    const periodId = `00000000-0000-4000-8000-${String(month + 1).padStart(12, "0")}`;

    await prisma.accountingPeriod.upsert({
      where: { id: periodId },
      update: { startDate, endDate, name: `${monthName} ${currentYear}`, isClosed: false },
      create: { id: periodId, fiscalYearId: fiscalYear.id, name: `${monthName} ${currentYear}`, startDate, endDate, isClosed: false },
    });
  }

  for (const account of CHART_OF_ACCOUNTS) {
    await prisma.account.upsert({
      where: { organizationId_code: { organizationId: orgId, code: account.code } },
      update: {
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        normalBalance: account.normalBalance,
        isSystem: account.isSystem,
      },
      create: {
        organizationId: orgId,
        code: account.code,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        normalBalance: account.normalBalance,
        isSystem: account.isSystem,
        isActive: true,
      },
    });
  }

  const parentMap: Record<string, string> = {
    "1100": "1000",
    "1110": "1000",
    "1200": "1000",
    "1300": "1000",
    "1400": "1000",
    "1500": "1000",
    "1510": "1500",
    "2100": "2000",
    "2200": "2000",
    "2300": "2000",
    "3100": "3000",
    "4100": "4000",
    "4200": "4000",
    "5100": "5000",
    "5200": "5000",
  };

  const accounts = await prisma.account.findMany({ where: { organizationId: orgId }, select: { id: true, code: true } });
  const codeToId = new Map(accounts.map((a) => [a.code, a.id]));
  for (const [child, parent] of Object.entries(parentMap)) {
    const childId = codeToId.get(child);
    const parentId = codeToId.get(parent);
    if (childId && parentId) {
      await prisma.account.update({ where: { id: childId }, data: { parentId } });
    }
  }

  await prisma.setting.upsert({
    where: { organizationId_key: { organizationId: orgId, key: "account_mapping" } },
    update: {
      value: {
        cash: "1100",
        bank: "1200",
        accountsReceivable: "1300",
        inventory: "1400",
        accountsPayable: "2100",
        salesTaxPayable: "2200",
        salesRevenue: "4100",
        cogs: "5100",
        giftCardLiability: "2300",
        cardClearing: "1200",
      },
    },
    create: {
      organizationId: orgId,
      key: "account_mapping",
      value: {
        cash: "1100",
        bank: "1200",
        accountsReceivable: "1300",
        inventory: "1400",
        accountsPayable: "2100",
        salesTaxPayable: "2200",
        salesRevenue: "4100",
        cogs: "5100",
        giftCardLiability: "2300",
        cardClearing: "1200",
      },
    },
  });
}

async function seedMasterData(orgId: string) {
  const units = [
    { name: "Piece", abbreviation: "pcs" },
    { name: "Box", abbreviation: "box" },
    { name: "Kilogram", abbreviation: "kg" },
    { name: "Liter", abbreviation: "L" },
  ];

  for (const unit of units) {
    await prisma.unit.upsert({
      where: { organizationId_abbreviation: { organizationId: orgId, abbreviation: unit.abbreviation } },
      update: { name: unit.name, isActive: true },
      create: { organizationId: orgId, name: unit.name, abbreviation: unit.abbreviation, isActive: true },
    });
  }

  const categories = [
    { name: "Beverages", slug: "beverages" },
    { name: "Snacks", slug: "snacks" },
    { name: "Household", slug: "household" },
    { name: "Fresh Foods", slug: "fresh-foods" },
  ];
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    await prisma.productCategory.upsert({
      where: { organizationId_slug: { organizationId: orgId, slug: c.slug } },
      update: { name: c.name, isActive: true, imageUrl: UNSPLASH.category[i % UNSPLASH.category.length] },
      create: {
        organizationId: orgId,
        name: c.name,
        slug: c.slug,
        isActive: true,
        imageUrl: UNSPLASH.category[i % UNSPLASH.category.length],
      },
    });
  }

  const brands = [
    { name: "Golden Choice", slug: "golden-choice" },
    { name: "Daily Plus", slug: "daily-plus" },
    { name: "Fresh Way", slug: "fresh-way" },
    { name: "Home Pro", slug: "home-pro" },
  ];
  for (let i = 0; i < brands.length; i++) {
    const b = brands[i];
    await prisma.productBrand.upsert({
      where: { organizationId_slug: { organizationId: orgId, slug: b.slug } },
      update: { name: b.name, isActive: true, logoUrl: UNSPLASH.brand[i % UNSPLASH.brand.length] },
      create: {
        organizationId: orgId,
        name: b.name,
        slug: b.slug,
        isActive: true,
        logoUrl: UNSPLASH.brand[i % UNSPLASH.brand.length],
      },
    });
  }

  const suppliers = [
    { code: "SUP-001", name: "Yangon FMCG Supply", paymentTerms: 30, creditLimit: 5_000_000 },
    { code: "SUP-002", name: "Delta Beverage Trading", paymentTerms: 21, creditLimit: 3_000_000 },
    { code: "SUP-003", name: "Mandalay Fresh Produce", paymentTerms: 14, creditLimit: 2_000_000 },
  ];
  for (const s of suppliers) {
    await prisma.supplier.upsert({
      where: { organizationId_code: { organizationId: orgId, code: s.code } },
      update: { name: s.name, paymentTerms: s.paymentTerms, creditLimit: s.creditLimit, isActive: true },
      create: {
        organizationId: orgId,
        code: s.code,
        name: s.name,
        paymentTerms: s.paymentTerms,
        creditLimit: s.creditLimit,
        isActive: true,
      },
    });
  }

  const customers = [
    { code: "CUS-001", name: "Aung Min", membershipTier: "GOLD", creditLimit: 500_000 },
    { code: "CUS-002", name: "May Thandar", membershipTier: "SILVER", creditLimit: 250_000 },
    { code: "CUS-003", name: "Ko Ko Family Store", membershipTier: "WHOLESALE", creditLimit: 1_000_000 },
    { code: "CUS-004", name: "Walk-in Retail", membershipTier: "REGULAR", creditLimit: 0 },
  ];
  for (const c of customers) {
    await prisma.customer.upsert({
      where: { organizationId_code: { organizationId: orgId, code: c.code } },
      update: { name: c.name, membershipTier: c.membershipTier, creditLimit: c.creditLimit, isActive: true },
      create: {
        organizationId: orgId,
        code: c.code,
        name: c.name,
        membershipTier: c.membershipTier,
        creditLimit: c.creditLimit,
        isActive: true,
      },
    });
  }
}

async function seedCatalogAndInventory(orgId: string, warehouseId: string, taxRateId: string) {
  const categories = await prisma.productCategory.findMany({ where: { organizationId: orgId, deletedAt: null } });
  const brands = await prisma.productBrand.findMany({ where: { organizationId: orgId, deletedAt: null } });
  const units = await prisma.unit.findMany({ where: { organizationId: orgId, deletedAt: null } });
  const suppliers = await prisma.supplier.findMany({ where: { organizationId: orgId, deletedAt: null } });

  const products = [
    { sku: "P-1001", name: "Premium Rice 5kg", categorySlug: "fresh-foods", unit: "box", costPrice: 18000, sellingPrice: 22000, reorderLevel: 15, trackBatch: true, trackExpiry: true },
    { sku: "P-1002", name: "Sunflower Cooking Oil 1L", categorySlug: "fresh-foods", unit: "L", costPrice: 4200, sellingPrice: 5000, reorderLevel: 24, trackBatch: true, trackExpiry: true },
    { sku: "P-1003", name: "Cola Drink 500ml", categorySlug: "beverages", unit: "pcs", costPrice: 900, sellingPrice: 1200, reorderLevel: 80, trackBatch: true, trackExpiry: true },
    { sku: "P-1004", name: "Orange Juice 1L", categorySlug: "beverages", unit: "L", costPrice: 2500, sellingPrice: 3200, reorderLevel: 35, trackBatch: true, trackExpiry: true },
    { sku: "P-1005", name: "Potato Chips 80g", categorySlug: "snacks", unit: "pcs", costPrice: 700, sellingPrice: 1000, reorderLevel: 100, trackBatch: true, trackExpiry: true },
    { sku: "P-1006", name: "Instant Noodles Pack", categorySlug: "snacks", unit: "box", costPrice: 420, sellingPrice: 650, reorderLevel: 120, trackBatch: true, trackExpiry: true },
    { sku: "P-1007", name: "Dishwashing Liquid 750ml", categorySlug: "household", unit: "pcs", costPrice: 1800, sellingPrice: 2400, reorderLevel: 40, trackBatch: false, trackExpiry: false },
    { sku: "P-1008", name: "Laundry Detergent 1kg", categorySlug: "household", unit: "kg", costPrice: 3200, sellingPrice: 4200, reorderLevel: 30, trackBatch: false, trackExpiry: false },
  ];

  const createdVariants: Array<{ id: string; productId: string; sku: string; name: string; costPrice: number; sellingPrice: number; reorderLevel: number }> = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const category = categories.find((c) => c.slug === p.categorySlug) ?? categories[0];
    const unit = units.find((u) => u.abbreviation === p.unit) ?? units[0];
    const supplier = randomFrom(suppliers);
    const brand = brands[i % brands.length];

    const product = await prisma.product.upsert({
      where: { organizationId_sku: { organizationId: orgId, sku: p.sku } },
      update: {
        name: p.name,
        categoryId: category.id,
        brandId: brand.id,
        unitId: unit.id,
        supplierId: supplier.id,
        taxRateId,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        reorderLevel: p.reorderLevel,
        minStock: Math.floor(p.reorderLevel * 0.6),
        trackBatch: p.trackBatch,
        trackExpiry: p.trackExpiry,
        isActive: true,
      },
      create: {
        organizationId: orgId,
        categoryId: category.id,
        brandId: brand.id,
        unitId: unit.id,
        supplierId: supplier.id,
        taxRateId,
        sku: p.sku,
        name: p.name,
        description: `Sample product for ${category.name}`,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        wholesalePrice: Math.round(p.sellingPrice * 0.92),
        reorderLevel: p.reorderLevel,
        minStock: Math.floor(p.reorderLevel * 0.6),
        trackBatch: p.trackBatch,
        trackExpiry: p.trackExpiry,
        isActive: true,
      },
    });

    const variant = await prisma.productVariant.upsert({
      where: { productId_sku: { productId: product.id, sku: `${p.sku}-STD` } },
      update: {
        name: `${p.name} Standard`,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        wholesalePrice: Math.round(p.sellingPrice * 0.92),
        isActive: true,
      },
      create: {
        productId: product.id,
        sku: `${p.sku}-STD`,
        name: `${p.name} Standard`,
        attributes: {},
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        wholesalePrice: Math.round(p.sellingPrice * 0.92),
        isActive: true,
      },
    });
    createdVariants.push({
      id: variant.id,
      productId: product.id,
      sku: variant.sku,
      name: variant.name,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      reorderLevel: p.reorderLevel,
    });

    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: UNSPLASH.product[i % UNSPLASH.product.length],
        publicId: `unsplash/${p.sku.toLowerCase()}`,
        alt: p.name,
        isPrimary: true,
      },
    });

    const barcodeCode = `${numberFromCode(p.sku, i + 1).toString().padStart(12, "0")}8`;
    await prisma.productBarcode.upsert({
      where: {
        organizationId_code: { organizationId: orgId, code: barcodeCode },
      },
      update: { productId: product.id, variantId: variant.id, isPrimary: true },
      create: {
        organizationId: orgId,
        productId: product.id,
        variantId: variant.id,
        code: barcodeCode,
        type: "EAN13",
        isPrimary: true,
      },
    });

    await prisma.productPrice.deleteMany({ where: { productId: product.id } });
    await prisma.productPrice.createMany({
      data: [
        { productId: product.id, priceType: "RETAIL", price: p.sellingPrice, minQty: 1 },
        { productId: product.id, priceType: "WHOLESALE", price: Math.round(p.sellingPrice * 0.92), minQty: 12 },
      ],
    });
  }

  await prisma.stockLevel.deleteMany({ where: { warehouseId } });
  for (const [idx, variant] of createdVariants.entries()) {
    const qty = idx % 3 === 0 ? variant.reorderLevel - 2 : variant.reorderLevel + 15 + idx * 5;
    await prisma.stockLevel.create({
      data: {
        warehouseId,
        variantId: variant.id,
        quantity: qty,
        reservedQty: 0,
        avgCost: variant.costPrice,
        costingMethod: "WEIGHTED_AVERAGE",
      },
    });
  }

  await prisma.productBatch.deleteMany({
    where: {
      variantId: { in: createdVariants.map((v) => v.id) },
    },
  });

  const today = toDateOnly(new Date());
  for (const [idx, variant] of createdVariants.entries()) {
    const expiryDate = new Date(today);
    expiryDate.setDate(today.getDate() + (idx % 4 === 0 ? 10 : 45 + idx * 3));
    await prisma.productBatch.create({
      data: {
        variantId: variant.id,
        batchNumber: `BATCH-${variant.sku.slice(-4)}-${idx + 1}`,
        costPrice: variant.costPrice,
        quantity: 100,
        remainingQty: 60 + idx * 2,
        receivedAt: today,
        expiryDate,
      },
    });
  }

  await prisma.inventoryMovement.deleteMany({ where: { organizationId: orgId } });
  await prisma.inventoryLedger.deleteMany({
    where: { warehouseId },
  });

  for (let i = 0; i < 3; i++) {
    const m = await prisma.inventoryMovement.create({
      data: {
        organizationId: orgId,
        branchId: BRANCH_ID,
        warehouseId,
        movementNumber: `IM-${new Date().getFullYear()}-${String(i + 1).padStart(4, "0")}`,
        movementType: i === 0 ? MovementType.STOCK_IN : i === 1 ? MovementType.SALE : MovementType.ADJUSTMENT_OUT,
        movementDate: new Date(),
        referenceType: i === 0 ? "GoodsReceipt" : i === 1 ? "Sale" : "Adjustment",
        status: DocumentStatus.COMPLETED,
        notes: "Sample movement",
      },
    });

    const variant = createdVariants[i];
    await prisma.inventoryMovementLine.create({
      data: {
        movementId: m.id,
        variantId: variant.id,
        quantity: i === 0 ? 40 : 8,
        unitCost: variant.costPrice,
        totalCost: (i === 0 ? 40 : 8) * variant.costPrice,
      },
    });

    await prisma.inventoryLedger.create({
      data: {
        warehouseId,
        variantId: variant.id,
        movementType: i === 0 ? MovementType.STOCK_IN : MovementType.SALE,
        quantity: i === 0 ? 40 : -8,
        balanceAfter: i === 0 ? 40 : 32,
        unitCost: variant.costPrice,
        referenceType: i === 0 ? "GoodsReceipt" : "Sale",
        referenceId: m.id,
      },
    });
  }

  const stockCount = await prisma.stockCount.create({
    data: {
      warehouseId,
      countNumber: `SC-${new Date().getFullYear()}-0001`,
      countDate: today,
      status: DocumentStatus.COMPLETED,
      notes: "Monthly sample stock count",
    },
  });
  await prisma.stockCountLine.createMany({
    data: createdVariants.slice(0, 3).map((v, i) => ({
      stockCountId: stockCount.id,
      variantId: v.id,
      systemQty: 50 + i * 10,
      countedQty: 49 + i * 10,
      variance: -1,
    })),
  });

  return { variants: createdVariants };
}

async function seedPurchasingAndSales(
  orgId: string,
  branchId: string,
  warehouseId: string,
  registerId: string,
  taxRateId: string,
  userMap: Record<string, string>,
  variants: Array<{ id: string; productId: string; sku: string; name: string; costPrice: number; sellingPrice: number }>,
) {
  const supplier = await prisma.supplier.findFirstOrThrow({ where: { organizationId: orgId, code: "SUP-001" } });
  const customers = await prisma.customer.findMany({ where: { organizationId: orgId } });
  const cashierId = userMap["cashier@minimart.com"];

  await prisma.purchaseRequest.deleteMany({ where: { organizationId: orgId } });
  const pr = await prisma.purchaseRequest.create({
    data: {
      organizationId: orgId,
      requestNumber: `PR-${new Date().getFullYear()}-0001`,
      requestDate: toDateOnly(new Date()),
      status: DocumentStatus.APPROVED,
      notes: "Monthly replenishment request",
      createdById: userMap["manager@minimart.com"],
    },
  });
  await prisma.purchaseRequestLine.createMany({
    data: variants.slice(0, 3).map((v) => ({
      purchaseRequestId: pr.id,
      variantId: v.id,
      quantity: 120,
      estimatedCost: v.costPrice,
    })),
  });

  await prisma.purchaseOrder.deleteMany({ where: { organizationId: orgId } });
  const po = await prisma.purchaseOrder.create({
    data: {
      organizationId: orgId,
      branchId,
      supplierId: supplier.id,
      orderNumber: `PO-${new Date().getFullYear()}-0001`,
      orderDate: toDateOnly(new Date()),
      expectedDate: toDateOnly(new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)),
      status: DocumentStatus.COMPLETED,
      subtotal: 2_400_000,
      taxAmount: 120_000,
      totalAmount: 2_520_000,
      notes: "Sample PO for seed data",
      createdById: userMap["manager@minimart.com"],
    },
  });
  await prisma.purchaseOrderLine.createMany({
    data: variants.slice(0, 3).map((v) => ({
      purchaseOrderId: po.id,
      variantId: v.id,
      quantity: 120,
      receivedQty: 120,
      unitCost: v.costPrice,
      taxAmount: v.costPrice * 120 * 0.05,
      lineTotal: v.costPrice * 120 * 1.05,
    })),
  });

  await prisma.goodsReceipt.deleteMany({ where: { organizationId: orgId } });
  const grn = await prisma.goodsReceipt.create({
    data: {
      organizationId: orgId,
      purchaseOrderId: po.id,
      warehouseId,
      receiptNumber: `GRN-${new Date().getFullYear()}-0001`,
      receiptDate: toDateOnly(new Date()),
      status: DocumentStatus.COMPLETED,
      notes: "Received in good condition",
      createdById: userMap["manager@minimart.com"],
    },
  });
  await prisma.goodsReceiptLine.createMany({
    data: variants.slice(0, 3).map((v, i) => ({
      goodsReceiptId: grn.id,
      variantId: v.id,
      quantity: 120,
      unitCost: v.costPrice,
      batchNumber: `POB-${i + 1}`,
      expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * (60 + i * 20)),
    })),
  });

  await prisma.supplierInvoice.deleteMany({ where: { organizationId: orgId } });
  const si = await prisma.supplierInvoice.create({
    data: {
      organizationId: orgId,
      supplierId: supplier.id,
      invoiceNumber: `INV-${new Date().getFullYear()}-SUP-0001`,
      supplierRef: "REF-8821",
      invoiceDate: toDateOnly(new Date()),
      dueDate: toDateOnly(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)),
      status: DocumentStatus.PENDING,
      subtotal: 2_400_000,
      taxAmount: 120_000,
      totalAmount: 2_520_000,
      paidAmount: 500_000,
      createdById: userMap["manager@minimart.com"],
    },
  });
  await prisma.supplierInvoiceLine.createMany({
    data: variants.slice(0, 3).map((v) => ({
      supplierInvoiceId: si.id,
      variantId: v.id,
      quantity: 120,
      unitCost: v.costPrice,
      taxAmount: v.costPrice * 120 * 0.05,
      lineTotal: v.costPrice * 120 * 1.05,
    })),
  });

  await prisma.supplierLedger.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.supplierLedger.createMany({
    data: [
      {
        supplierId: supplier.id,
        entryDate: toDateOnly(new Date()),
        description: "Supplier invoice posted",
        debit: 2_520_000,
        credit: 0,
        balance: 2_520_000,
        referenceType: "SupplierInvoice",
        referenceId: si.id,
      },
      {
        supplierId: supplier.id,
        entryDate: toDateOnly(new Date()),
        description: "Partial payment",
        debit: 0,
        credit: 500_000,
        balance: 2_020_000,
        referenceType: "SupplierPayment",
        referenceId: si.id,
      },
    ],
  });

  await prisma.sale.deleteMany({ where: { organizationId: orgId } });
  await prisma.cashRegisterSession.deleteMany({ where: { cashRegisterId: registerId } });
  const session = await prisma.cashRegisterSession.create({
    data: {
      cashRegisterId: registerId,
      openedById: cashierId,
      closedById: cashierId,
      status: "CLOSED",
      openingBalance: 150_000,
      closingBalance: 1_040_000,
      expectedCash: 1_020_000,
      variance: 20_000,
      openedAt: new Date(Date.now() - 1000 * 60 * 60 * 10),
      closedAt: new Date(Date.now() - 1000 * 60 * 60 * 1),
    },
  });

  for (let i = 0; i < 6; i++) {
    const customer = i % 3 === 0 ? customers[0] : i % 3 === 1 ? customers[1] : null;
    const lineA = variants[i % variants.length];
    const lineB = variants[(i + 1) % variants.length];
    const qtyA = 2 + (i % 3);
    const qtyB = 1 + (i % 2);
    const sub = qtyA * lineA.sellingPrice + qtyB * lineB.sellingPrice;
    const discount = i % 2 === 0 ? Math.round(sub * 0.03) : 0;
    const tax = Math.round((sub - discount) * 0.05);
    const total = sub - discount + tax;
    const paid = i % 4 === 0 ? total : total + 500;
    const change = paid - total;
    const saleDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * i);

    const sale = await prisma.sale.create({
      data: {
        organizationId: orgId,
        branchId,
        invoiceNumber: `S-${new Date().getFullYear()}-${String(i + 1).padStart(5, "0")}`,
        saleType: "SALE",
        saleDate,
        customerId: customer?.id,
        cashierId,
        cashRegisterId: registerId,
        sessionId: session.id,
        status: DocumentStatus.COMPLETED,
        subtotal: sub,
        discountAmount: discount,
        taxAmount: tax,
        grandTotal: total,
        amountPaid: paid,
        changeAmount: change,
      },
    });

    await prisma.saleLine.createMany({
      data: [
        {
          saleId: sale.id,
          variantId: lineA.id,
          productName: lineA.name,
          sku: lineA.sku,
          quantity: qtyA,
          unitPrice: lineA.sellingPrice,
          discountAmount: 0,
          taxRateId,
          taxAmount: Math.round(qtyA * lineA.sellingPrice * 0.05),
          lineTotal: Math.round(qtyA * lineA.sellingPrice * 1.05),
          costPrice: lineA.costPrice,
        },
        {
          saleId: sale.id,
          variantId: lineB.id,
          productName: lineB.name,
          sku: lineB.sku,
          quantity: qtyB,
          unitPrice: lineB.sellingPrice,
          discountAmount: 0,
          taxRateId,
          taxAmount: Math.round(qtyB * lineB.sellingPrice * 0.05),
          lineTotal: Math.round(qtyB * lineB.sellingPrice * 1.05),
          costPrice: lineB.costPrice,
        },
      ],
    });

    await prisma.payment.create({
      data: {
        saleId: sale.id,
        method: i % 2 === 0 ? PaymentMethod.CASH : PaymentMethod.QR,
        amount: total,
      },
    });
  }

  await prisma.saleHold.deleteMany({ where: { organizationId: orgId } });
  await prisma.saleHold.create({
    data: {
      organizationId: orgId,
      branchId,
      holdNumber: `HOLD-${new Date().getFullYear()}-0001`,
      cashierId,
      cartData: {
        lines: [{ variantId: variants[0].id, qty: 3 }],
      },
      customerId: customers[2]?.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });

  await prisma.promotion.deleteMany({ where: { organizationId: orgId } });
  await prisma.coupon.deleteMany({ where: { organizationId: orgId } });
  await prisma.promotion.create({
    data: {
      organizationId: orgId,
      name: "Weekend 5% Off",
      code: "WKND5",
      discountType: "PERCENTAGE",
      discountValue: 5,
      minPurchase: 50000,
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
      isActive: true,
    },
  });
  await prisma.coupon.create({
    data: {
      organizationId: orgId,
      code: "WELCOME10",
      discountType: "PERCENTAGE",
      discountValue: 10,
      maxUses: 100,
      usedCount: 14,
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90),
      isActive: true,
    },
  });

  await prisma.giftCard.deleteMany({});
  await prisma.giftCard.createMany({
    data: [
      {
        customerId: customers[0]?.id,
        code: "GC-10001",
        balance: 80_000,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180),
        isActive: true,
      },
      {
        customerId: customers[1]?.id,
        code: "GC-10002",
        balance: 45_000,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120),
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.customerLedger.deleteMany({
    where: { customerId: { in: customers.map((c) => c.id) } },
  });
  if (customers[2]) {
    await prisma.customerLedger.createMany({
      data: [
        {
          customerId: customers[2].id,
          entryDate: toDateOnly(new Date()),
          description: "Credit sale invoice",
          debit: 180_000,
          credit: 0,
          balance: 180_000,
          referenceType: "Sale",
        },
        {
          customerId: customers[2].id,
          entryDate: toDateOnly(new Date()),
          description: "Customer payment",
          debit: 0,
          credit: 70_000,
          balance: 110_000,
          referenceType: "Receipt",
        },
      ],
    });
  }
}

async function seedAccountingOperations(orgId: string, branchId: string, userMap: Record<string, string>) {
  const accounts = await prisma.account.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: { id: true, code: true },
  });
  const accountByCode = new Map(accounts.map((a) => [a.code, a.id]));

  const expenseAccountId = accountByCode.get("5200");
  const incomeAccountId = accountByCode.get("4200");
  const bankRootAccountId = accountByCode.get("1200");
  const currentPeriod = await prisma.accountingPeriod.findFirst({
    where: { fiscalYearId: FY_ID, isClosed: false },
    orderBy: { startDate: "asc" },
  });

  if (!expenseAccountId || !incomeAccountId || !bankRootAccountId || !currentPeriod) return;

  await prisma.expense.deleteMany({ where: { organizationId: orgId } });
  await prisma.income.deleteMany({ where: { organizationId: orgId } });
  await prisma.bankTransaction.deleteMany({});
  await prisma.bankAccount.deleteMany({});
  await prisma.journalEntry.deleteMany({ where: { organizationId: orgId } });

  const bank = await prisma.bankAccount.create({
    data: {
      accountId: bankRootAccountId,
      bankName: "AYA Bank",
      accountNumber: "0012345678901",
      accountName: "Mini Mart Main",
      currency: "MMK",
      isActive: true,
    },
  });

  await prisma.bankTransaction.createMany({
    data: [
      {
        bankAccountId: bank.id,
        transactionDate: toDateOnly(new Date()),
        description: "Initial deposit",
        debit: 2_000_000,
        credit: 0,
        balance: 2_000_000,
      },
      {
        bankAccountId: bank.id,
        transactionDate: toDateOnly(new Date()),
        description: "Supplier payment",
        debit: 0,
        credit: 500_000,
        balance: 1_500_000,
      },
    ],
  });

  await prisma.expense.createMany({
    data: [
      {
        organizationId: orgId,
        branchId,
        expenseNumber: `EXP-${new Date().getFullYear()}-0001`,
        expenseDate: toDateOnly(new Date()),
        accountId: expenseAccountId,
        amount: 120_000,
        description: "Electricity bill",
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        status: DocumentStatus.COMPLETED,
        createdById: userMap["manager@minimart.com"],
      },
      {
        organizationId: orgId,
        branchId,
        expenseNumber: `EXP-${new Date().getFullYear()}-0002`,
        expenseDate: toDateOnly(new Date()),
        accountId: expenseAccountId,
        amount: 65_000,
        description: "Internet service",
        paymentMethod: PaymentMethod.CASH,
        status: DocumentStatus.COMPLETED,
        createdById: userMap["manager@minimart.com"],
      },
    ],
  });

  await prisma.income.create({
    data: {
      organizationId: orgId,
      incomeNumber: `INC-${new Date().getFullYear()}-0001`,
      incomeDate: toDateOnly(new Date()),
      accountId: incomeAccountId,
      amount: 350_000,
      description: "Display rental income",
      createdById: userMap["manager@minimart.com"],
    },
  });

  const journal = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      branchId,
      fiscalYearId: FY_ID,
      periodId: currentPeriod.id,
      entryNumber: `JE-${new Date().getFullYear()}-0001`,
      entryDate: toDateOnly(new Date()),
      description: "Manual adjustment entry",
      status: DocumentStatus.COMPLETED,
      isAutoPosted: false,
      createdById: userMap["manager@minimart.com"],
    },
  });

  await prisma.journalLine.createMany({
    data: [
      {
        journalEntryId: journal.id,
        accountId: expenseAccountId,
        description: "Accrued utilities",
        debit: 80_000,
        credit: 0,
        lineOrder: 1,
      },
      {
        journalEntryId: journal.id,
        accountId: bankRootAccountId,
        description: "Cash/bank adjustment",
        debit: 0,
        credit: 80_000,
        lineOrder: 2,
      },
    ],
  });
}

async function seedNotificationsAndAudit(userMap: Record<string, string>) {
  await prisma.notification.deleteMany({
    where: {
      userId: { in: Object.values(userMap) },
    },
  });

  const now = Date.now();
  await prisma.notification.createMany({
    data: [
      {
        userId: userMap["admin@minimart.com"],
        type: "LOW_STOCK",
        title: "Low Stock Alert",
        message: "Premium Rice 5kg is below reorder level.",
        data: { href: "/inventory" },
        createdAt: new Date(now - 1000 * 60 * 15),
      },
      {
        userId: userMap["manager@minimart.com"],
        type: "EXPIRY_WARNING",
        title: "Expiring Product",
        message: "A beverage batch will expire in 10 days.",
        data: { href: "/inventory" },
        createdAt: new Date(now - 1000 * 60 * 30),
      },
      {
        userId: userMap["manager@minimart.com"],
        type: "NEW_PURCHASE_ARRIVAL",
        title: "New Purchase Arrival",
        message: "GRN-2026-001 received at Main Warehouse (5 lines)",
        data: { href: "/purchasing/receiving" },
        createdAt: new Date(now - 1000 * 60 * 45),
      },
      {
        userId: userMap["admin@minimart.com"],
        type: "DAILY_SALES_SUMMARY",
        title: "Daily Sales Summary",
        message: "Today: 42 sales, total 1,250,000.00",
        data: { href: "/reports/sales" },
        createdAt: new Date(now - 1000 * 60 * 60),
      },
      {
        userId: userMap["cashier@minimart.com"],
        type: "CASH_DRAWER_NOT_CLOSED",
        title: "Cash Drawer Not Closed",
        message: "REG-01 — Front Counter has been open since yesterday",
        data: { href: "/cash-register" },
        createdAt: new Date(now - 1000 * 60 * 20),
      },
      {
        userId: userMap["manager@minimart.com"],
        type: "LARGE_DISCOUNT",
        title: "Large Discount Applied",
        message: "Sale INV-2026-010 has a 30.0% discount",
        data: { href: "/reports/sales" },
        createdAt: new Date(now - 1000 * 60 * 10),
      },
      {
        userId: userMap["admin@minimart.com"],
        type: "SUSPICIOUS_TRANSACTION",
        title: "Suspicious Transaction",
        message: "Return refund is 75% of original sale — INV-2026-008",
        data: { href: "/reports/sales" },
        createdAt: new Date(now - 1000 * 60 * 5),
      },
      {
        userId: userMap["cashier@minimart.com"],
        type: "SYSTEM",
        title: "Seed data ready",
        message: "Demo data has been loaded successfully.",
        data: { href: "/" },
        createdAt: new Date(now - 1000 * 60 * 2),
      },
    ],
  });
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW !== "true") {
    console.error(
      "Refusing to run seed in production. Set SEED_ALLOW=true only for intentional staging resets.",
    );
    process.exit(1);
  }

  console.log("Seeding database with full sample data...");

  const { org, branch, warehouse, cashRegister, userMap } = await seedSecurityAndAuth();
  await seedPlatformLayer(org.id);
  await seedAccountingMaster(org.id);
  await seedMasterData(org.id);
  const { variants } = await seedCatalogAndInventory(org.id, warehouse.id, VAT_ID);
  await seedPurchasingAndSales(org.id, branch.id, warehouse.id, cashRegister.id, VAT_ID, userMap, variants);
  await seedAccountingOperations(org.id, branch.id, userMap);
  await seedNotificationsAndAudit(userMap);

  console.log("Seed completed");
  console.log(`Organization: ${org.name}`);
  console.log(`Branch: ${branch.name}`);
  console.log(`Warehouse: ${warehouse.name}`);
  console.log("Users:");
  console.log("  admin@minimart.com / Admin@123");
  console.log("  manager@minimart.com / Admin@123");
  console.log("  cashier@minimart.com / Admin@123");
  console.log("Platform admin:");
  console.log("  superadmin@platform.com / Platform@123");
  console.log("Unsplash images are used for category/brand/product sample images.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
