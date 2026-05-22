const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { MongoClient, GridFSBucket } = require('mongodb');

const app = express();
app.use(cors());

const MONGO_URL = 'mongodb://admin:StrongPassword123!@localhost:27017';
const MONGO_DB = 'infratrack_files';
const PORT = 3001;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

let db;
let bucket;

async function initMongo() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db(MONGO_DB);
  bucket = new GridFSBucket(db, { bucketName: 'ticket_images' });
  console.log('Connected to MongoDB at', MONGO_URL, 'database', MONGO_DB);
}

app.post('/upload-picture', upload.single('picture'), async (req, res) => {
  const { ticket_id, user_id } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ success: false, message: 'No picture file uploaded.' });
  }

  if (!ticket_id || !user_id) {
    return res.status(400).json({ success: false, message: 'ticket_id and user_id are required.' });
  }

  try {
    const uploadStream = bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype,
      metadata: {
        ticket_id: String(ticket_id),
        user_id: String(user_id),
        uploaded_at: new Date().toISOString()
      }
    });

    uploadStream.end(file.buffer);

    uploadStream.on('finish', uploadedFile => {
      res.json({
        success: true,
        file_id: uploadedFile._id.toString(),
        filename: uploadedFile.filename,
        metadata: uploadedFile.metadata
      });
    });

    uploadStream.on('error', err => {
      console.error('GridFS upload error:', err);
      res.status(500).json({ success: false, message: 'Failed to store picture in MongoDB.' });
    });
  } catch (err) {
    console.error('Upload picture error:', err);
    res.status(500).json({ success: false, message: err.message || 'Upload failed.' });
  }
});

app.get('/picture/:ticket_id/:user_id', async (req, res) => {
  const { ticket_id, user_id } = req.params;

  try {
    const filesCollection = db.collection('ticket_images.files');
    const file = await filesCollection.findOne({
      'metadata.ticket_id': String(ticket_id),
      'metadata.user_id': String(user_id)
    });

    if (!file) {
      return res.status(404).json({ success: false, message: 'Picture not found.' });
    }

    const downloadStream = bucket.openDownloadStream(file._id);
    res.setHeader('Content-Type', file.contentType || 'image/jpeg');
    downloadStream.pipe(res);
  } catch (err) {
    console.error('Picture fetch error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to retrieve picture.' });
  }
});

app.listen(PORT, async () => {
  try {
    await initMongo();
    console.log(`Mongo upload server listening on port ${PORT}`);
  } catch (err) {
    console.error('Failed to start MongoDB upload server:', err);
    process.exit(1);
  }
});
