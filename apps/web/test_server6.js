const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync('test_render6.html'));
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(3010, () => {
    console.log('Server running on http://localhost:3010');
});
