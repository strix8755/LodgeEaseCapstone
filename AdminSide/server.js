const express = require('express');
const path = require('path');
const app = express();

// Serve static files from the AdminSide directory
app.use(express.static(path.join(__dirname)));

// Specific route for Tailwind CSS
app.get('/dist/tailwind.css', (req, res) => {
    res.type('text/css');
    res.sendFile(path.join(__dirname, 'dist', 'tailwind.css'));
});

app.listen(5502, () => {
    console.log('Server running on http://localhost:5502');
});
