const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt'); // Make sure bcrypt or bcryptjs is installed. package.json had "bcrypt": "^6.0.0" and "bcryptjs": "^3.0.2". User model uses `bcrypt`.

// Robust .env loading
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
    console.log(`Loading .env from: ${envPath}`);
    require('dotenv').config({ path: envPath });
} else {
    console.log(`.env not found at ${envPath}, trying default...`);
    require('dotenv').config();
}

const User = require('./src/models/User');

const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is missing');
        }
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: process.env.MONGO_DB_NAME,
        });
        console.log('MongoDB Connected');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

const seedUser = async () => {
    await connectDB();

    try {
        const passwordRaw = '123456';
        // Note: The User model has a pre-save hook to hash the password.
        // So we can pass the raw password if we use `new User(...)` and `.save()`.

        const timestamp = Date.now();
        const userData = {
            username: `test_client_${timestamp}`,
            password: passwordRaw,
            email: `test_client_${timestamp}@example.com`,
            name: 'Nguyen Van A',
            role: 'client',
            phone: '0987654321',
            gender: 'male',
            birthDate: new Date('1990-01-01'),
            addresses: [
                {
                    name: 'Nguyen Van A',
                    phone: '0987654321',
                    address: '123 Street, District 1, Ho Chi Minh City',
                    type: 'home',
                    isDefault: true
                },
                {
                    name: 'Nguyen Van A (Work)',
                    phone: '0987654321',
                    address: '456 Tech Park, District 9, Ho Chi Minh City',
                    type: 'work',
                    isDefault: false
                }
            ],
            avatarUrl: 'https://i.pravatar.cc/150?img=3'
        };

        const newUser = new User(userData);
        await newUser.save();

        console.log('User created successfully:');
        console.log({
            username: newUser.username,
            email: newUser.email,
            password: passwordRaw,
            _id: newUser._id
        });

    } catch (error) {
        console.error('Error seeding user:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Done.');
    }
};

seedUser();
