const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

app.use(express.json());

const GELATO_API_KEY = process.env.GELATO_API_KEY;
const SQUARE_WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
const GELATO_API_URL = 'https://order.gelatoapis.com/v1/orders';

app.post('/webhook/square', async (req, res) => {
  // TODO: Add robust signature verification for Square Webhooks
  
  const orderData = req.body.data.object.order;
  if (!orderData) return res.status(400).send('No order data found');

  try {
    // 1. Map Square Order to Gelato Format
    const gelatoOrderPayload = {
      orderReferenceId: orderData.id,
      currency: orderData.total_money.currency,
      recipient: {
        name: "Customer Name", // Map to Square's recipient data
        address1: "123 Main St", // Map to Square's shipping address
        city: "Sterling Heights",
        state: "MI",
        country: "US",
        zip: "48310",
        email: "customer@example.com"
      },
      lines: orderData.line_items.map(item => ({
        itemReferenceId: item.uid,
        productUid: "YOUR_GELATO_PRODUCT_UID", // Map Square SKU to Gelato Product ID
        quantity: parseInt(item.quantity)
      }))
    };

    // 2. Send to Gelato API
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
