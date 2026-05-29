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
  // Example: 'GELATO_TSHIRT_001': '98465799-1ada-4f68-9cde-cabcd77dbc95'
  // Add your mappings here
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
