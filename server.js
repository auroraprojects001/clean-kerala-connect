// ==================== IMPORTS ====================
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');

// ==================== SETUP ====================
const app = express();
const PORT = 3004;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

// ==================== DATABASE ====================
const db = new sqlite3.Database('./waste.db', (err) => {
    if (err) {
        console.error('❌ Database error:', err.message);
    } else {
        console.log('✅ Connected to SQLite database');
        createTables();
    }
});

function createTables() {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        address TEXT,
        district TEXT,
        pincode TEXT,
        password TEXT,
        tree_coins INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('❌ Error creating users table:', err.message);
        } else {
            console.log('✅ Users table ready');
            createDemoUser();
        }
    });

    // Requests table
    db.run(`CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        request_id TEXT UNIQUE,
        biodegradable TEXT,
        non_biodegradable TEXT,
        recyclable TEXT,
        pickup_date TEXT,
        pickup_time TEXT,
        status TEXT DEFAULT 'pending',
        coins_earned INTEGER DEFAULT 10,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
        if (err) {
            console.error('❌ Error creating requests table:', err.message);
        } else {
            console.log('✅ Requests table ready');
        }
    });
}

function createDemoUser() {
    const demoPassword = bcrypt.hashSync('demo123', 10);
    db.get('SELECT id FROM users WHERE phone = ?', ['9876543210'], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO users (phone, name, email, password, tree_coins) 
                    VALUES (?, ?, ?, ?, ?)`,
                ['9876543210', 'Demo User', 'demo@kerala.com', demoPassword, 150],
                (err) => {
                    if (err) {
                        console.log('⚠️ Could not create demo user:', err.message);
                    } else {
                        console.log('✅ Demo user created: 9876543210 / demo123');
                    }
                }
            );
        }
    });
}

// ==================== API ROUTES ====================

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running!' });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'Clean Kerala Connect API'
    });
});

// Check location
app.get('/api/check-location', (req, res) => {
    res.json({ 
        isKerala: true, 
        message: 'Welcome to Kerala!' 
    });
});

// Verify OTP
app.post('/api/verify-otp', (req, res) => {
    res.json({ 
        success: true, 
        message: 'OTP verified successfully' 
    });
});

// ========== AUTHENTICATION ROUTES ==========

// User Login
app.post('/api/login', (req, res) => {
    const { phone, password } = req.body;
    
    console.log('📥 Login attempt for:', phone);
    
    if (!phone || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Phone and password required' 
        });
    }
    
    db.get('SELECT * FROM users WHERE phone = ?', [phone], (err, user) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ 
                success: false, 
                message: 'Server error' 
            });
        }
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        // Demo user special handling
        if (phone === '9876543210' && password === 'demo123') {
            const { password: _, ...userWithoutPassword } = user;
            console.log('✅ Demo login successful');
            return res.json({ 
                success: true, 
                user: userWithoutPassword 
            });
        }
        
        // Regular user password check
        if (!user.password) {
            return res.status(401).json({ 
                success: false, 
                message: 'Please reset your password' 
            });
        }
        
        if (bcrypt.compareSync(password, user.password)) {
            const { password: _, ...userWithoutPassword } = user;
            console.log('✅ Login successful for:', phone);
            res.json({ 
                success: true, 
                user: userWithoutPassword 
            });
        } else {
            res.status(401).json({ 
                success: false, 
                message: 'Invalid password' 
            });
        }
    });
});

// User Registration
app.post('/api/create-account', (req, res) => {
    const { name, phone, email, password } = req.body;
    
    console.log('📥 Registration attempt:', { name, phone });
    
    // Validation
    if (!name || !phone || !password) {
        return res.status(400).json({ 
            success: false,
            error: 'Name, phone, and password are required' 
        });
    }
    
    if (phone.length !== 10 || !/^\d+$/.test(phone)) {
        return res.status(400).json({ 
            success: false,
            error: 'Phone must be 10 digits' 
        });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ 
            success: false,
            error: 'Password must be at least 6 characters' 
        });
    }
    
    // Check if user exists
    db.get('SELECT id FROM users WHERE phone = ?', [phone], (err, existing) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ 
                success: false,
                error: 'Server error' 
            });
        }
        
        if (existing) {
            return res.status(400).json({ 
                success: false,
                error: 'Phone already registered' 
            });
        }
        
        // Hash password
        const hashedPassword = bcrypt.hashSync(password, 10);
        
        // Create user
        db.run(`INSERT INTO users (name, phone, email, password, tree_coins) 
                VALUES (?, ?, ?, ?, ?)`,
            [name, phone, email || null, hashedPassword, 0],
            function(err) {
                if (err) {
                    console.error('Insert error:', err.message);
                    return res.status(500).json({ 
                        success: false,
                        error: 'Registration failed' 
                    });
                }
                
                console.log('✅ User created with ID:', this.lastID);
                
                // Get created user
                db.get('SELECT id, name, phone, email, tree_coins FROM users WHERE id = ?', 
                    [this.lastID], 
                    (err, newUser) => {
                        if (err || !newUser) {
                            return res.json({ 
                                success: true, 
                                userId: this.lastID,
                                user: { name, phone, email: email || null, tree_coins: 0 },
                                message: 'Account created!' 
                            });
                        }
                        
                        res.json({ 
                            success: true, 
                            userId: newUser.id,
                            user: newUser,
                            message: 'Account created successfully!' 
                        });
                    }
                );
            }
        );
    });
});

// Guest registration
app.post('/api/register', (req, res) => {
    const { phone, name, email, address, district, pincode } = req.body;
    
    db.run(`INSERT OR IGNORE INTO users (phone, name, email, address, district, pincode, tree_coins) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [phone, name, email || null, address || '', district, pincode, 0],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Registration failed' });
            }
            res.json({ 
                success: true, 
                userId: this.lastID,
                coins: 0 
            });
        }
    );
});

// Submit waste request
app.post('/api/submit-request', (req, res) => {
    const { userId, wasteData, date, time } = req.body;
    
    const requestId = 'KL-WM-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
    
    db.run(`INSERT INTO requests (user_id, request_id, biodegradable, non_biodegradable, recyclable, pickup_date, pickup_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, requestId, 
         JSON.stringify(wasteData.bio || []),
         JSON.stringify(wasteData.nonBio || []),
         JSON.stringify(wasteData.recycle || []),
         date, time],
        function(err) {
            if (err) {
                console.error('Request error:', err.message);
                return res.status(500).json({ error: 'Failed to submit' });
            }
            
            // Award coins
            db.run('UPDATE users SET tree_coins = COALESCE(tree_coins, 0) + 10 WHERE id = ?', 
                [userId], 
                (err) => {
                    if (err) {
                        console.error('Coin error:', err.message);
                    }
                    
                    res.json({
                        success: true,
                        requestId,
                        coinsEarned: 10,
                        message: 'Request submitted!'
                    });
                }
            );
        }
    );
});

// Get user info
app.get('/api/user/:phone', (req, res) => {
    const { phone } = req.params;
    
    db.get('SELECT id, name, phone, email, tree_coins FROM users WHERE phone = ?', 
        [phone], 
        (err, user) => {
            if (err || !user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            db.all('SELECT * FROM requests WHERE user_id = ?', [user.id], (err, requests) => {
                res.json({ 
                    user, 
                    requests: requests || [] 
                });
            });
        }
    );
});

// Get all users (for testing)
app.get('/api/users', (req, res) => {
    db.all('SELECT id, name, phone, email, tree_coins FROM users', [], (err, users) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ users: users || [] });
    });
});

// ==================== SERVE FRONTEND ====================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 CLEAN KERALA CONNECT - SERVER STARTED');
    console.log('='.repeat(50));
    console.log(`🌐 Local URL:  http://localhost:${PORT}`);
    console.log(`📡 API Health: http://localhost:${PORT}/api/health`);
    console.log('='.repeat(50));
    console.log('👤 DEMO ACCOUNT:');
    console.log('   📱 Phone: 9876543210');
    console.log('   🔑 Password: demo123');
    console.log('='.repeat(50));
    console.log('📊 Database: waste.db');
    console.log('🔄 Server ready! Open browser to start.');
    console.log('='.repeat(50) + '\n');
});

// Error handling
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});