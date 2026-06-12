import { Router } from 'express';
import { ProductsController, SitesController } from '@maxio-com/advanced-billing-sdk';
import { getMaxioClient } from '../maxioClient';
import { verifySlackAuth } from '../services/slackService';
import { sessionStore } from '../stores/sessionStore';
import { transactionStore } from '../stores/transactionStore';
import { config, CONSULTANTS } from '../config';
import type { ProductCacheEntry } from '../types';

const router = Router();

// ---------------------------------------------------------------------------
// Products cache — loaded once at boot, refreshed on demand
// ---------------------------------------------------------------------------

let cachedProducts: ProductCacheEntry[] = [];
let productCacheLoadedAt = 0;

async function loadProductsCache(): Promise<void> {
  if (!config.maxio.apiKey || !config.maxio.siteSubdomain) return;
  try {
    const productsCtrl = new ProductsController(getMaxioClient());
    const resp = await productsCtrl.listProducts({ page: 1, perPage: 50 });
    if (resp.result) {
      cachedProducts = resp.result
        .filter(pr => pr.product != null)
        .map(pr => {
          const p = pr.product!;
          return {
            handle: p.handle ?? '',
            name: p.name ?? '',
            priceInCents: Number(p.priceInCents ?? 0),
            intervalUnit: String(p.intervalUnit ?? 'month'),
          };
        })
        .filter(p => p.handle !== '');
      productCacheLoadedAt = Date.now();
      console.log(`[meta] Loaded ${cachedProducts.length} product(s) from Maxio.`);
    }
  } catch (err) {
    console.warn('[meta] Could not load products from Maxio:', err instanceof Error ? err.message : err);
  }
}

// Kick off product cache load at startup (non-blocking)
loadProductsCache().catch(() => null);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get('/health', async (_req, res) => {
  let maxioSite: string | null = null;
  let slackOk = false;

  if (config.maxio.apiKey && config.maxio.siteSubdomain) {
    try {
      const sitesCtrl = new SitesController(getMaxioClient());
      const siteResp = await sitesCtrl.readSite();
      const siteObj = siteResp.result?.site as { subdomain?: string; name?: string } | undefined;
      maxioSite = siteObj?.subdomain ?? config.maxio.siteSubdomain;
    } catch {
      maxioSite = null;
    }
  }

  const slackResult = await verifySlackAuth();
  slackOk = slackResult.ok;

  res.json({
    status: 'ok',
    sessions: sessionStore.size(),
    transactions: transactionStore.size(),
    maxioSite,
    slackOk,
    productsCached: cachedProducts.length,
    productCacheAge: productCacheLoadedAt
      ? Math.round((Date.now() - productCacheLoadedAt) / 1000) + 's'
      : 'never',
  });
});

router.get('/products', (_req, res) => {
  res.json(cachedProducts);
});

router.get('/consultants', (_req, res) => {
  res.json(CONSULTANTS);
});

// Allow manual cache refresh without restarting the server
router.post('/products/refresh', async (_req, res) => {
  await loadProductsCache();
  res.json({ status: 'ok', count: cachedProducts.length });
});

export default router;
export { cachedProducts, loadProductsCache };
