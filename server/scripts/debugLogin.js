import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const debugLogin = async () => {
  try {
    console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'NOT SET!');
    console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'NOT SET!');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find admin user
    const user = await User.findOne({ email: 'admin@teamflow.com' });
    if (!user) {
      console.log('Admin user not found!');
      process.exit(1);
    }

    console.log('Admin user found:', {
      id: user._id,
      email: user.email,
      role: user.role,
      hasPassword: !!user.password
    });

    // Test password
    const isMatch = await bcrypt.compare('admin123', user.password);
    console.log('Password match:', isMatch);

    if (!isMatch) {
      console.log('Password does not match! The user might have been created with a different password.');
      console.log('Updating password to admin123...');
      
      const hashedPassword = await bcrypt.hash('admin123', 10);
      user.password = hashedPassword;
      await user.save();
      
      console.log('Password updated successfully!');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

debugLogin(); 