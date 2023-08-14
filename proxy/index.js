const express = require('express');
const cors = require('cors');
const compression = require('compression'); // Import the compression middleware

const app = express();
const port = 3000;

app.use(cors());
app.use(compression()); // Use the compression middleware

app.get('/proxy', async (req, res) => {
  const { url } = req.query;

  try {
    const response = await fetch(url);

    const contentType = response.headers.get('content-type');
    res.set('Content-Type', contentType);

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(port, () => {
  console.log(`Proxy server is running on port ${port}`);
});