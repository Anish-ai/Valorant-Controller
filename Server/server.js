const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const robot = require('robotjs');  // Uncommented for mouse control
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Configuration
const config = {
    mouseSensitivity: 1.0,
    movementSpeed: 1.0,
    maxMovementSpeed: 2.0,
    minMovementSpeed: 0.5,
};

// Helper function to simulate key press/release (kept as logs)
function handleKey(key, isPressed) {
    console.log(`Key ${key} ${isPressed ? 'pressed' : 'released'}`);
    io.emit('logMessage', `Key ${key} would be ${isPressed ? 'pressed' : 'released'}`);
}

// Helper function to handle mouse movement (now active)
function handleMouseMove(dx, dy) {
    try {
        const mouse = robot.getMousePos();
        const { width, height } = robot.getScreenSize();
        const newX = Math.max(0, Math.min(width, mouse.x + dx / 4));
        const newY = Math.max(0, Math.min(height, mouse.y + dy / 4));
        robot.moveMouse(newX, newY);
        io.emit('logMessage', `Mouse moved to: x=${newX}, y=${newY}`);
    } catch (error) {
        console.error('Error moving mouse:', error);
        io.emit('logMessage', `Error moving mouse: ${error.message}`);
    }
}

io.on('connection', (socket) => {
    console.log('Game controller connected');
    io.emit('logMessage', 'New controller connected to server');
    
    const pressedKeys = new Set();
    let movementInterval = null;

    socket.on('movement', (data) => {
        const { angle, isActive, intensity = 1.0 } = data;
        
        if (movementInterval) {
            clearInterval(movementInterval);
            movementInterval = null;
        }

        pressedKeys.forEach(key => {
            handleKey(key, false);
            pressedKeys.delete(key);
        });

        if (isActive && typeof angle === 'number') {
            let directionMessage = '';
            let keys = [];
            let dx = 0;
            let dy = 0;

            // Calculate dx and dy based on angle
            const radians = (angle * Math.PI) / 180;
            dx = Math.cos(radians) * 10 * intensity * config.mouseSensitivity;
            dy = Math.sin(radians) * 10 * intensity * config.mouseSensitivity;

            // Determine direction for logging
            if (angle >= 315 || angle < 45) {
                directionMessage = 'Right';
                keys.push('d');
            } else if (angle >= 45 && angle < 135) {
                directionMessage = 'Down';
                keys.push('s');
            } else if (angle >= 135 && angle < 225) {
                directionMessage = 'Left';
                keys.push('a');
            } else if (angle >= 225 && angle < 315) {
                directionMessage = 'Up';
                keys.push('w');
            }

            // Handle diagonal movements
            if (angle >= 22.5 && angle < 67.5) {
                directionMessage = 'Down-Right';
                keys = ['s', 'd'];
            } else if (angle >= 112.5 && angle < 157.5) {
                directionMessage = 'Down-Left';
                keys = ['s', 'a'];
            } else if (angle >= 202.5 && angle < 247.5) {
                directionMessage = 'Up-Left';
                keys = ['w', 'a'];
            } else if (angle >= 292.5 && angle < 337.5) {
                directionMessage = 'Up-Right';
                keys = ['w', 'd'];
            }

            // Log the movement direction and intensity
            console.log(`Movement: ${directionMessage} (${angle.toFixed(2)}°) with intensity ${intensity}`);
            io.emit('logMessage', `Movement: ${directionMessage} (${angle.toFixed(1)}°) with intensity ${intensity}`);

            // Log the keys that would be pressed (keeping keyboard simulation as logs)
            keys.forEach(key => {
                handleKey(key, true);
                pressedKeys.add(key);
            });

            // Active mouse movement
            const moveSpeed = config.movementSpeed * intensity;
            movementInterval = setInterval(() => {
                handleMouseMove(dx, dy);
                
                // Log key presses without actually triggering them
                keys.forEach(key => {
                    console.log(`Continuous movement: ${key}`);
                    io.emit('logMessage', `Continuous movement key: ${key}`);
                });
            }, Math.max(16, 50 - (moveSpeed * 20)));
        }
    });

    socket.on('disconnect', () => {
        if (movementInterval) {
            clearInterval(movementInterval);
        }
        
        pressedKeys.forEach(key => {
            handleKey(key, false);
        });
        pressedKeys.clear();
        
        console.log('Game controller disconnected');
        io.emit('logMessage', 'Game controller disconnected');
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Game controller server running on http://0.0.0.0:${PORT}`);
    io.emit('logMessage', `Server started on port ${PORT}`);
});