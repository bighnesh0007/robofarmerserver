const express = require('express');
const cors = require('cors');
const axios = require('axios');
const port = 3001;
const multer = require('multer');
const { createCanvas, loadImage } = require('canvas');
require('dotenv').config();


const app = express();

const upload = multer();



app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Helper function to generate a random color
function getRandomColor() {
  const r = Math.floor(Math.random() * 200 + 55).toString(16).padStart(2, '0');
  const g = Math.floor(Math.random() * 200 + 55).toString(16).padStart(2, '0');
  const b = Math.floor(Math.random() * 200 + 55).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

app.post('/process-frame', async (req, res) => {
  try {
    const { frame, index } = req.body;
    const base64Image = frame.split(',')[1]; 

    const response = await axios({
      method: "POST",
      url: "https://detect.roboflow.com/cow-lie-stand-walk/2",
      params: {
        api_key: "77WX0STGxQWEAZ09pDIW"
      },
      data: base64Image,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    res.json({ frame: index, data: response.data });
  } catch (error) {
    console.error('Error processing frame:', error);
    res.status(500).json({ error: 'Error processing frame' });
  }
});

app.post('/detect', upload.single('image'), async (req, res) => {
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const image = req.file.buffer.toString('base64');

    const response = await axios({
      method: 'POST',
      url: 'https://detect.roboflow.com/chicken-detection-and-tracking/11',
      params: {
        api_key: process.env.ROBOFLOW_API_KEY
      },
      data: image,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const predictions = response.data.predictions;

    // Load the image and create a canvas
    const img = await loadImage(req.file.buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');

    // Draw the original image
    ctx.drawImage(img, 0, 0, img.width, img.height);

    // Create a color map for classes
    const colorMap = new Map();

    // Draw bounding boxes and labels
    ctx.lineWidth = 2;
    ctx.font = '14px Arial';

    predictions.forEach(pred => {
      // Get or create a color for this class
      if (!colorMap.has(pred.class)) {
        colorMap.set(pred.class, getRandomColor());
      }
      const color = colorMap.get(pred.class);

      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      // Draw bounding box
      ctx.beginPath();
      ctx.rect(pred.x - pred.width / 2, pred.y - pred.height / 2, pred.width, pred.height);
      ctx.stroke();

      // Prepare label text
      const label = `${pred.class} ${(pred.confidence * 100).toFixed(1)}%`;
      const labelWidth = ctx.measureText(label).width;

      // Draw label background
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(
        pred.x - pred.width / 2, 
        pred.y - pred.height / 2 - 20, 
        labelWidth + 10, 
        20
      );

      // Draw label text
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'white';
      ctx.fillText(
        label, 
        pred.x - pred.width / 2 + 5, 
        pred.y - pred.height / 2 - 5
      );
    });

    // Convert canvas to buffer
    const buffer = canvas.toBuffer('image/png');

    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': buffer.length
    });
    res.end(buffer);

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'An error occurred while processing the image' });
  }
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});