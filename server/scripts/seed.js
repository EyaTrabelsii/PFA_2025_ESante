import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

// Import models
import User from '../models/User.js';
import Team from '../models/Team.js';
import Task from '../models/Task.js';
import Equipment from '../models/Equipment.js';

// Sample data matching frontend mock data
const userData = [
  { id: 'user1', name: 'John Doe', email: 'john@example.com', password: 'password123', role: 'admin', avatar: 'https://i.pravatar.cc/150?img=1' },
  { id: 'user2', name: 'Jane Smith', email: 'jane@example.com', password: 'password123', role: 'user', avatar: 'https://i.pravatar.cc/150?img=5' },
  { id: 'user3', name: 'Bob Johnson', email: 'bob@example.com', password: 'password123', role: 'user', avatar: 'https://i.pravatar.cc/150?img=3' },
  { id: 'user4', name: 'Alice Williams', email: 'alice@example.com', password: 'password123', role: 'user', avatar: 'https://i.pravatar.cc/150?img=9' },
  { id: 'user5', name: 'Charlie Brown', email: 'charlie@example.com', password: 'password123', role: 'user', avatar: 'https://i.pravatar.cc/150?img=12' },
  { id: 'user6', name: 'Diana Prince', email: 'diana@example.com', password: 'password123', role: 'user', avatar: 'https://i.pravatar.cc/150?img=25' }
];

const teamData = [
  {
    id: 'team1',
    name: 'Development Team',
    description: 'Frontend and backend developers responsible for building and maintaining our core products.',
    members: ['user1', 'user2', 'user3'],
    memberRoles: {
      'user1': 'Team Lead',
      'user2': 'Frontend Developer',
      'user3': 'Backend Developer'
    }
  },
  {
    id: 'team2',
    name: 'Design Team',
    description: 'UI/UX designers who create beautiful and intuitive user interfaces.',
    members: ['user4', 'user5'],
    memberRoles: {
      'user4': 'Design Lead',
      'user5': 'UI Designer'
    }
  },
  {
    id: 'team3',
    name: 'Marketing Team',
    description: 'Handles all marketing campaigns, social media, and brand management.',
    members: ['user6'],
    memberRoles: {
      'user6': 'Marketing Director'
    }
  }
];

const taskData = [
  {
    id: 'task1',
    title: 'Redesign Homepage',
    description: 'Update the homepage with the new branding guidelines and improve UX.',
    status: 'completed',
    priority: 'high',
    dueDate: '2023-06-15T17:00:00Z',
    assignedTo: 'user4',
    teamId: 'team2',
    createdAt: '2023-06-01T09:00:00Z',
    completedAt: '2023-06-14T16:00:00Z'
  },
  {
    id: 'task2',
    title: 'Fix Login Bug',
    description: 'Users are experiencing intermittent login failures - investigate and fix.',
    status: 'in_progress',
    priority: 'high',
    dueDate: '2023-06-20T17:00:00Z',
    assignedTo: 'user3',
    teamId: 'team1',
    createdAt: '2023-06-10T11:00:00Z'
  },
  {
    id: 'task3',
    title: 'Implement New API Endpoint',
    description: 'Create a new RESTful API endpoint for the analytics dashboard.',
    status: 'pending',
    priority: 'medium',
    dueDate: '2023-06-25T17:00:00Z',
    assignedTo: 'user3',
    teamId: 'team1',
    createdAt: '2023-06-12T14:00:00Z'
  },
  {
    id: 'task4',
    title: 'Create Social Media Campaign',
    description: 'Design and implement a social media campaign for the summer launch.',
    status: 'in_progress',
    priority: 'medium',
    dueDate: '2023-06-30T17:00:00Z',
    assignedTo: 'user6',
    teamId: 'team3',
    createdAt: '2023-06-05T10:00:00Z'
  },
  {
    id: 'task5',
    title: 'Optimize Database Queries',
    description: 'Improve performance of slow running database queries in the reporting module.',
    status: 'completed',
    priority: 'high',
    dueDate: '2023-06-10T17:00:00Z',
    assignedTo: 'user3',
    teamId: 'team1',
    createdAt: '2023-06-02T11:00:00Z',
    completedAt: '2023-06-09T16:30:00Z'
  },
  {
    id: 'task6',
    title: 'Prepare Investor Presentation',
    description: 'Create slides for the upcoming investor meeting.',
    status: 'pending',
    priority: 'high',
    dueDate: '2023-06-28T12:00:00Z',
    assignedTo: 'user1',
    teamId: 'team1',
    createdAt: '2023-06-15T09:00:00Z'
  },
  {
    id: 'task7',
    title: 'Create New Icons Set',
    description: 'Design a new icon set for the application based on the updated brand guidelines.',
    status: 'in_progress',
    priority: 'low',
    dueDate: '2023-07-05T17:00:00Z',
    assignedTo: 'user5',
    teamId: 'team2',
    createdAt: '2023-06-20T11:00:00Z'
  },
  {
    id: 'task8',
    title: 'User Testing Session',
    description: 'Prepare and moderate a user testing session for the new features.',
    status: 'completed',
    priority: 'medium',
    dueDate: '2023-06-12T17:00:00Z',
    assignedTo: 'user4',
    teamId: 'team2',
    createdAt: '2023-06-05T13:00:00Z',
    completedAt: '2023-06-12T15:00:00Z'
  },
  {
    id: 'task9',
    title: 'Update Privacy Policy',
    description: 'Review and update the privacy policy to comply with new regulations.',
    status: 'pending',
    priority: 'high',
    dueDate: '2023-06-22T17:00:00Z',
    assignedTo: 'user1',
    teamId: 'team1',
    createdAt: '2023-06-10T16:00:00Z'
  },
  {
    id: 'task10',
    title: 'Launch Email Campaign',
    description: 'Design and send email campaign for the new product launch.',
    status: 'completed',
    priority: 'medium',
    dueDate: '2023-06-18T17:00:00Z',
    assignedTo: 'user6',
    teamId: 'team3',
    createdAt: '2023-06-08T10:00:00Z',
    completedAt: '2023-06-17T11:00:00Z'
  },
  {
    id: 'task11',
    title: 'Implement Dark Mode',
    description: 'Add dark mode support to the application.',
    status: 'in_progress',
    priority: 'low',
    dueDate: '2023-07-10T17:00:00Z',
    assignedTo: 'user2',
    teamId: 'team1',
    createdAt: '2023-06-25T09:00:00Z'
  },
  {
    id: 'task12',
    title: 'Mobile Responsive Design',
    description: 'Ensure all pages are responsive on mobile devices.',
    status: 'pending',
    priority: 'high',
    dueDate: '2023-07-02T17:00:00Z',
    assignedTo: 'user2',
    teamId: 'team1',
    createdAt: '2023-06-22T14:00:00Z'
  }
];

const equipmentData = [
  {
    id: 'equip1',
    name: 'MacBook Pro 16"',
    type: 'Laptop',
    status: 'assigned',
    assignedTo: 'user1',
    serialNumber: 'MBP20220001',
    purchaseDate: '2022-01-15T00:00:00Z',
    notes: 'M1 Max, 64GB RAM, 1TB SSD'
  },
  {
    id: 'equip2',
    name: 'Dell 27" Monitor',
    type: 'Monitor',
    status: 'available',
    serialNumber: 'DLM20220034',
    purchaseDate: '2022-03-05T00:00:00Z',
    notes: '4K, USB-C Hub'
  },
  {
    id: 'equip3',
    name: 'iPhone 13 Pro',
    type: 'Mobile Device',
    status: 'assigned',
    assignedTo: 'user6',
    serialNumber: 'IP13P2022056',
    purchaseDate: '2022-02-20T00:00:00Z'
  },
  {
    id: 'equip4',
    name: 'HP LaserJet Pro',
    type: 'Printer',
    status: 'maintenance',
    serialNumber: 'HPLJ2021089',
    purchaseDate: '2021-11-10T00:00:00Z',
    notes: 'Paper jam issue, waiting for parts'
  },
  {
    id: 'equip5',
    name: 'Logitech MX Master 3',
    type: 'Mouse',
    status: 'assigned',
    assignedTo: 'user3',
    serialNumber: 'LMX2022112',
    purchaseDate: '2022-04-18T00:00:00Z'
  },
  {
    id: 'equip6',
    name: 'iPad Pro 12.9"',
    type: 'Tablet',
    status: 'assigned',
    assignedTo: 'user4',
    serialNumber: 'IP12P2022023',
    purchaseDate: '2022-01-25T00:00:00Z',
    notes: '256GB, Wi-Fi + Cellular'
  },
  {
    id: 'equip7',
    name: 'Cisco Conference System',
    type: 'Conference Equipment',
    status: 'available',
    serialNumber: 'CSC2021045',
    purchaseDate: '2021-10-15T00:00:00Z',
    notes: 'Main conference room'
  },
  {
    id: 'equip8',
    name: 'Keychron K3 Keyboard',
    type: 'Keyboard',
    status: 'assigned',
    assignedTo: 'user2',
    serialNumber: 'KK32022078',
    purchaseDate: '2022-05-02T00:00:00Z'
  }
];

// Function to seed database
async function seedDatabase() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/team-management';
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Team.deleteMany({});
    await Task.deleteMany({});
    await Equipment.deleteMany({});
    console.log('Cleared existing collections');

    // Create users with hashed passwords
    const createdUsers = {};
    for (const user of userData) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const newUser = new User({
        name: user.name,
        email: user.email,
        password: hashedPassword,
        role: user.role,
        avatar: user.avatar
      });
      const savedUser = await newUser.save();
      createdUsers[user.id] = savedUser._id;
    }
    console.log('Users created:', Object.keys(createdUsers).length);

    // Create teams with references to users
    const createdTeams = {};
    for (const team of teamData) {
      const memberIds = team.members.map(memberId => createdUsers[memberId]);
      
      // Create team membership data with roles
      const members = memberIds.map((userId, index) => ({
        user: userId,
        role: team.memberRoles[team.members[index]] || 'Member'
      }));

      const newTeam = new Team({
        name: team.name,
        description: team.description,
        members: members
      });
      const savedTeam = await newTeam.save();
      createdTeams[team.id] = savedTeam._id;
      
      // Update users with team reference
      for (const userId of memberIds) {
        await User.findByIdAndUpdate(userId, {
          $push: { teams: savedTeam._id }
        });
      }
    }
    console.log('Teams created:', Object.keys(createdTeams).length);

    // Create tasks
    const createdTasks = [];
    for (const task of taskData) {
      const newTask = new Task({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: new Date(task.dueDate),
        assignedTo: createdUsers[task.assignedTo],
        team: createdTeams[task.teamId],
        createdAt: new Date(task.createdAt),
        completedAt: task.completedAt ? new Date(task.completedAt) : undefined
      });
      const savedTask = await newTask.save();
      createdTasks.push(savedTask);
    }
    console.log('Tasks created:', createdTasks.length);

    // Create equipment
    const createdEquipment = [];
    for (const equipment of equipmentData) {
      const newEquipment = new Equipment({
        name: equipment.name,
        type: equipment.type,
        status: equipment.status,
        assignedTo: equipment.assignedTo ? createdUsers[equipment.assignedTo] : undefined,
        serialNumber: equipment.serialNumber,
        purchaseDate: new Date(equipment.purchaseDate),
        notes: equipment.notes
      });
      const savedEquipment = await newEquipment.save();
      createdEquipment.push(savedEquipment);
    }
    console.log('Equipment created:', createdEquipment.length);

    console.log('Database seeded successfully!');
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the seed function
seedDatabase(); 