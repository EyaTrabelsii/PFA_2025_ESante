import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const testUsers = [
  {
    name: 'John Doe',
    email: 'john.doe@teamflow.com',
    password: 'password123',
    role: 'team_member'
  },
  {
    name: 'Jane Smith',
    email: 'jane.smith@teamflow.com',
    password: 'password123',
    role: 'team_member'
  },
  {
    name: 'Bob Johnson',
    email: 'bob.johnson@teamflow.com',
    password: 'password123',
    role: 'team_member'
  },
  {
    name: 'Alice Williams',
    email: 'alice.williams@teamflow.com',
    password: 'password123',
    role: 'team_member'
  },
  {
    name: 'Charlie Brown',
    email: 'charlie.brown@teamflow.com',
    password: 'password123',
    role: 'team_leader'
  }
];

const createTestUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create users
    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        console.log(`User ${userData.email} already exists, skipping...`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Create user
      const user = new User({
        ...userData,
        password: hashedPassword,
        isActive: true
      });

      await user.save();
      console.log(`Created user: ${userData.name} (${userData.email})`);
    }

    console.log('\nTest users created successfully!');
    console.log('All users have password: password123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating test users:', error);
    process.exit(1);
  }
};

createTestUsers(); 