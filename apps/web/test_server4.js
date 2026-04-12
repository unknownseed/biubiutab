const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync('test_render4.html'));
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(3008, () => {
    console.log('Server running on http://localhost:3008');
});
