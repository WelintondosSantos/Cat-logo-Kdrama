const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Paths
const DATA_FILE = path.join(__dirname, '../data/dramas.json');
const IMG_DIR = path.join(__dirname, '../assets/img');

// Configure Multer for Image Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, IMG_DIR);
    },
    filename: (req, file, cb) => {
        // Use the original name, or sanitize it
        // We expect the frontend to send the desired filename
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// Routes

// 1. List Images
app.get('/api/images', (req, res) => {
    fs.readdir(IMG_DIR, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to list images' });
        }
        // Filter for webp only? Or all images? Let's return all.
        const images = files.filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f));
        res.json(images);
    });
});

// 2. Upload Image
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ message: 'Image uploaded successfully', filename: req.file.filename });
});

// 3. Delete Image
app.delete('/api/images/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(IMG_DIR, filename);

    // Security check to prevent directory traversal
    if (!filename.match(/^[a-zA-Z0-9_\-.]+$/)) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    fs.unlink(filepath, (err) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ error: 'File not found' });
            }
            return res.status(500).json({ error: 'Failed to delete file' });
        }
        res.json({ message: 'File deleted successfully' });
    });
});

// 4. Save JSON directly
app.post('/api/save-json', (req, res) => {
    const newData = req.body;

    if (!Array.isArray(newData)) {
        return res.status(400).json({ error: 'Invalid data format. Expected array.' });
    }

    fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 4), (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to save JSON file' });
        }
        res.json({ message: 'JSON file saved successfully' });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`- Images: ${IMG_DIR}`);
    console.log(`- Data: ${DATA_FILE}`);
});
