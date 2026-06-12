import 'dotenv/config';
import {
  ApiError,
  Client,
  ComponentsController,
  CreateEBBComponent,
  CreateMeteredComponent,
  CreateOrUpdateProductRequest,
  CreateProductFamilyRequest,
  Environment,
  IntervalUnit,
  PricingScheme,
  ProductFamiliesController,
  ProductsController,
} from '@maxio-com/advanced-billing-sdk';

const apiKey = process.env.MAXIO_API_KEY;
const siteSubdomain = process.env.MAXIO_SITE_SUBDOMAIN;
const familyHandle = process.env.MAXIO_DEFAULT_PRODUCT_FAMILY ?? 'metermate';
const ebbMetricId = parseInt(process.env.MAXIO_API_CALLS_METRIC_ID ?? '0', 10);

if (!apiKey || !siteSubdomain) {
  console.error('[seed] MAXIO_API_KEY and MAXIO_SITE_SUBDOMAIN must be set in .env');
  process.exit(1);
}

const client = new Client({
  basicAuthCredentials: { username: apiKey, password: 'x' },
  timeout: 60_000,
  environment: Environment.US,
  site: siteSubdomain,
});

const familiesCtrl = new ProductFamiliesController(client);
const productsCtrl = new ProductsController(client);
const componentsCtrl = new ComponentsController(client);

// ---------------------------------------------------------------------------
// Seed entry point
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  console.log(`[seed] Seeding MeterMate on site: ${siteSubdomain}`);

  const familyId = await ensureProductFamily(familyHandle);

  await upsertProduct(familyId, {
    name: 'Basic Plan',
    handle: 'basic',
    description: 'Basic consulting plan — $99/month flat retainer',
    priceInCents: BigInt(9900),
    interval: 1,
    intervalUnit: IntervalUnit.Month,
  });

  await upsertProduct(familyId, {
    name: 'Pro Plan',
    handle: 'pro',
    description: 'Pro consulting plan — $299/month flat retainer',
    priceInCents: BigInt(29900),
    interval: 1,
    intervalUnit: IntervalUnit.Month,
  });

  await upsertMeteredComponent(familyId, {
    name: 'Consulting Time',
    handle: 'consulting-minutes',
    unitName: 'minute',
    unitPrice: '2.00',
  });

  if (!ebbMetricId) {
    console.warn('[seed] Skipping api-calls EBB component — MAXIO_API_CALLS_METRIC_ID not set.');
    console.warn('[seed] Create an Event-Based Billing metric in the Maxio UI, then set MAXIO_API_CALLS_METRIC_ID=<id> and re-run.');
  } else {
    await upsertEbbComponent(familyId, {
      name: 'API Calls',
      handle: 'api-calls',
      unitName: 'event',
      unitPrice: '0.01',
      metricId: ebbMetricId,
    });
  }

  console.log('[seed] ✓ Complete. Run GET /api/products to verify.');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureProductFamily(handle: string): Promise<string> {
  const body: CreateProductFamilyRequest = {
    productFamily: {
      name: 'MeterMate',
      handle,
      description: 'MeterMate consulting & billing plans',
    },
  };

  try {
    const resp = await familiesCtrl.createProductFamily(body);
    const id = resp.result?.productFamily?.id;
    if (!id) throw new Error('No product family id returned');
    const familyId = String(id);
    console.log(`[seed] Created product family id=${familyId} handle=${handle}`);
    return familyId;
  } catch (err) {
    if (err instanceof ApiError) {
      const body = JSON.stringify(err.body ?? '');
      if (body.toLowerCase().includes('taken') || body.toLowerCase().includes('exists')) {
        console.log(`[seed] Product family "${handle}" already exists — using handle reference.`);
        return `handle:${handle}`;
      }
    }
    throw err;
  }
}

async function upsertProduct(
  familyId: string,
  opts: {
    name: string;
    handle: string;
    description: string;
    priceInCents: bigint;
    interval: number;
    intervalUnit: IntervalUnit;
  },
): Promise<void> {
  const body: CreateOrUpdateProductRequest = {
    product: {
      name: opts.name,
      handle: opts.handle,
      description: opts.description,
      priceInCents: opts.priceInCents,
      interval: opts.interval,
      intervalUnit: opts.intervalUnit,
      requireCreditCard: false,
    },
  };

  try {
    const resp = await productsCtrl.createProduct(familyId, body);
    console.log(`[seed] Created product "${opts.handle}" id=${resp.result?.product?.id}`);
  } catch (err) {
    if (err instanceof ApiError) {
      const bodyStr = JSON.stringify(err.body ?? '').toLowerCase();
      if (bodyStr.includes('taken') || bodyStr.includes('exists')) {
        console.log(`[seed] Product "${opts.handle}" already exists — skipping.`);
        return;
      }
    }
    console.error(`[seed] Failed to create product "${opts.handle}":`, err instanceof ApiError ? err.body : err);
  }
}

async function upsertMeteredComponent(
  familyId: string,
  opts: { name: string; handle: string; unitName: string; unitPrice: string },
): Promise<void> {
  const body: CreateMeteredComponent = {
    meteredComponent: {
      name: opts.name,
      handle: opts.handle,
      unitName: opts.unitName,
      pricingScheme: PricingScheme.PerUnit,
      taxable: false,
      prices: [{ startingQuantity: 1, unitPrice: opts.unitPrice }],
    },
  };

  try {
    const resp = await componentsCtrl.createMeteredComponent(familyId, body);
    console.log(`[seed] Created metered component "${opts.handle}" id=${resp.result?.component?.id}`);
  } catch (err) {
    if (err instanceof ApiError) {
      const bodyStr = JSON.stringify(err.body ?? '').toLowerCase();
      if (bodyStr.includes('taken') || bodyStr.includes('exists')) {
        console.log(`[seed] Metered component "${opts.handle}" already exists — skipping.`);
        return;
      }
    }
    console.error(`[seed] Failed to create metered component "${opts.handle}":`, err instanceof ApiError ? err.body : err);
  }
}

async function upsertEbbComponent(
  familyId: string,
  opts: { name: string; handle: string; unitName: string; unitPrice: string; metricId: number },
): Promise<void> {
  const body: CreateEBBComponent = {
    eventBasedComponent: {
      name: opts.name,
      handle: opts.handle,
      unitName: opts.unitName,
      pricingScheme: PricingScheme.PerUnit,
      eventBasedBillingMetricId: opts.metricId,
      taxable: false,
      prices: [{ startingQuantity: 1, unitPrice: opts.unitPrice }],
    },
  };

  try {
    const resp = await componentsCtrl.createEventBasedComponent(familyId, body);
    console.log(`[seed] Created EBB component "${opts.handle}" id=${resp.result?.component?.id}`);
  } catch (err) {
    if (err instanceof ApiError) {
      const bodyStr = JSON.stringify(err.body ?? '').toLowerCase();
      if (bodyStr.includes('taken') || bodyStr.includes('exists')) {
        console.log(`[seed] EBB component "${opts.handle}" already exists — skipping.`);
        return;
      }
    }
    console.error(`[seed] Failed to create EBB component "${opts.handle}":`, err instanceof ApiError ? err.body : err);
  }
}

seed().catch((err) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
