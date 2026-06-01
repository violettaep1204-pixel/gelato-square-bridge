const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

app.use(express.json());

const GELATO_API_KEY = process.env.GELATO_API_KEY;
const SQUARE_WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
const GELATO_API_URL = 'https://order.gelatoapis.com/v1/orders';

// Product mapping: Square Catalog Object ID -> Gelato Product UID
// Update this with your actual product mappings from Square to Gelato
const PRODUCT_MAP = {
  // Format: 'SQUARE_CATALOG_ID': 'GELATO_PRODUCT_UID'
  'XBG4JS4SNU73KS5K2B7ZGMDS': '863c39b8-3862-44d1-8245-42a9d4cd2808', // Clover Kaleida Flexi Case (Samsung)
  'LKEVQ7ZVY3IURZOYQBYW7CNI': '92421142-b107-4621-8219-f6ac2de72bfc', // Product 2
  'RYQ7XPNOFTYSDGIK4Q5CVKGA': 'ccfff7fe-0e3e-4285-a555-ed38f905e7d3', // Product 3
  'MSIYVZ3R37WA656YEF4TMESY': '1ba6ec47-e2d1-4323-8cbc-5d9e75a8ed9d', // Product 4
  'WOZ2FDRCFY2P5GC7TTLXJE27': 'a20a310c-4ea3-4988-95dc-21cb56571a4c', // Product 5
  'XHH22DRRMJCP5WBKBMTFQE7Z': '149e0790-49e5-417d-b4e0-28a1e4d44bfb', // Product 6
  'U7GPLISRPDPURID7WCVFSSPQ': '72b89475-d52f-4e90-a60f-104db2cfa54f', // Product 7
  'IOM3CHCRBR6D5II43KYGHK2Z': 'dc93e4bf-dd4d-4e1f-a872-fe9427f4de43', // Product 8
  'QERD2OTQL3Z5NRAT4CZ4DZDV': '1ec9db61-f1de-4b1e-948a-f846e0d15f1a', // Product 9
  'TONSV7A3VLGS55AVDUNEKRAB': '30ce28bb-c80b-4323-b5b7-f004122feb70', // Product 10
  'B47YQ2U5JRLIVIYEBATYWU4P': '40abe99a-b06e-4ee4-8acb-83ecfd5a125c', // Product 11
  'EUJ7K23ZLB5A5OJH6GUGTBH5': '9ca62e0a-f1d2-40f9-be03-d2d2fb68b645', // Product 12
  'DCUH6OHS5RS6D4GQNMBULS46': 'b6a81ce5-ccb0-4bf2-8130-9bb50b35f09d', // Product 13
  'Y4UECA2DGR2EWKXFKNTGSV5F': 'fdc3b440-6336-4e21-aa73-652f59bee96c', // Product 14
  '5AFN6LFWG5VJSVH2IHO2L7F6': 'b1b376f0-df8c-4c2d-a6ff-56064df8ed10', // Product 15
  // Add more mappings here
};

// Helper function to get Gelato Product UID from Square catalog object ID
function getGelatoProductUid(squareCatalogId) {
  return PRODUCT_MAP[squareCatalogId] || null;
}

app.post('/webhook/square', async (req, res) => {
  // TODO: Add robust signature verification for Square Webhooks
  
  const orderData = req.body.data.object.order;
  if (!orderData) return res.status(400).send('No order data found');
  if (!orderData.line_items || orderData.line_items.length === 0) return res.status(400).send('No line items found');

  try {
    // Extract customer details from order
    const fulfillment = orderData.fulfillments?.[0];
    const recipientAddress = fulfillment?.delivery_details?.recipient?.address || {};
    const customerName = fulfillment?.delivery_details?.recipient?.display_name || 'Customer';
    const customerEmail = orderData.customer_id || 'unknown@example.com';

    // Map line items to Gelato format, filtering unmapped products
    const lines = orderData.line_items
      .map(item => {
        const gelatoProductUid = getGelatoProductUid(item.catalog_object_id);
        if (!gelatoProductUid) {
          console.warn(`No Gelato mapping found for Square item: ${item.catalog_object_id}. Skipping.`);
          return null;
        }
        return {
          itemReferenceId: item.uid,
          productUid: gelatoProductUid,
          quantity: parseInt(item.quantity || 1)
        };
      })
      .filter(item => item !== null);

    if (lines.length === 0) {
      console.warn(`Order ${orderData.id} has no mapped Gelato products`);
      return res.status(400).send('No mapped Gelato products in order');
    }

    // Build Gelato Order Payload
    const gelatoOrderPayload = {
      orderReferenceId: orderData.id,
      currency: orderData.total_money?.currency || 'USD',
      recipient: {
        name: customerName,
        address1: recipientAddress.address_line_1 || '123 Main St',
        address2: recipientAddress.address_line_2 || '',
        city: recipientAddress.locality || 'Unknown',
        state: recipientAddress.administrative_district_level_1 || 'CA',
        country: recipientAddress.country || 'US',
        zip: recipientAddress.postal_code || '00000',
        email: customerEmail
      },
      lines: lines
    };

    // Send to Gelato API
    const response = await axios.post(GELATO_API_URL, gelatoOrderPayload, {
      headers: {
        'X-API-KEY': GELATO_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log('Gelato Order Created:', response.data);
    res.status(200).send('Order forwarded successfully');
  } catch (error) {
    console.error('Error forwarding order to Gelato:', error.response?.data || error.message);
    res.status(500).send('Error processing order');
  }
});

app.listen(port, () => console.log(`Bridge listening on port ${port}`));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
