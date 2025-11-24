import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

// Load environment variables
dotenv.config();

// Import models
import User from "../models/User.js";
import Team from "../models/Team.js";
import Task from "../models/Task.js";
import Equipment from "../models/Equipment.js";

// Configuration
const NUM_ADMINS = 1;
const NUM_USERS = 100;
const NUM_TEAMS = 15;
const NUM_TASKS = 300;
const NUM_EQUIPMENT = 80;
const TEAM_SIZE_MIN = 4;
const TEAM_SIZE_MAX = 15;
const TASKS_PER_TEAM_MIN = 10;
const TASKS_PER_TEAM_MAX = 30;

// Tunisian Names in French/Latin letters
const tunisianFirstNames = [
  "Mohamed",
  "Ahmed",
  "Ali",
  "Hassan",
  "Hussein",
  "Omar",
  "Youssef",
  "Ibrahim",
  "Khaled",
  "Saad",
  "Abdullah",
  "Abderrahman",
  "Abdelaziz",
  "Faisal",
  "Tarek",
  "Majed",
  "Nabil",
  "Rami",
  "Sami",
  "Walid",
  "Fatma",
  "Aicha",
  "Khadija",
  "Zeineb",
  "Mariem",
  "Sara",
  "Nour",
  "Houda",
  "Amel",
  "Rania",
  "Leila",
  "Salma",
  "Dina",
  "Mona",
  "Hala",
  "Nadia",
  "Samira",
  "Karima",
  "Jamila",
  "Wafa",
  "Emad",
  "Jamal",
  "Kamal",
  "Fouad",
  "Rachid",
  "Mounir",
  "Bachir",
  "Anis",
  "Farid",
  "Slim",
  "Amine",
  "Bilel",
  "Chaker",
  "Dhia",
  "Eya",
  "Fares",
  "Ghazi",
  "Hatem",
  "Ines",
  "Jihed",
  "Karim",
  "Lina",
  "Maher",
  "Nesrine",
  "Oussama",
  "Raed",
  "Sihem",
  "Taha",
  "Wiem",
  "Yassine",
];

const tunisianLastNames = [
  "Ben Ali",
  "Trabelsi",
  "Sfaxien",
  "Kairouani",
  "Tunisien",
  "Hammami",
  "Jerbi",
  "Benzarti",
  "Khalifi",
  "Cherif",
  "Hachemi",
  "Alaoui",
  "Andaloussi",
  "Maghrebi",
  "Fassi",
  "Rbati",
  "Zitouni",
  "Jemii",
  "Tabib",
  "Mohandess",
  "Ostaz",
  "Kateb",
  "Chaer",
  "Fannan",
  "Bouali",
  "Bouhassan",
  "Bouomar",
  "Bouyoussef",
  "Bouibrahim",
  "Boukhaled",
  "Bousaad",
  "Bouabdullah",
  "Haddad",
  "Najjar",
  "Khayyat",
  "Hallaq",
  "Banna",
  "Tajer",
  "Fallah",
  "Sayyad",
  "Mahfoudh",
  "Mansouri",
  "Masmoudi",
  "Mekki",
  "Mestiri",
  "Moalla",
  "Ouali",
  "Rekik",
];

const itTeamNames = [
  "Frontend Engineering Team",
  "Backend Engineering Team",
  "Full Stack Development Team",
  "Mobile Application Development Team",
  "DevOps & Infrastructure Team",
  "Cloud Solutions Engineering Team",
  "Data Science & Analytics Team",
  "Machine Learning Engineering Team",
  "AI Research & Development Team",
  "Platform Engineering Team",
  "Quality Assurance Engineering Team",
  "Security & Compliance Team",
  "Product Design & User Experience Team",
  "Database Engineering Team",
  "API Development Team",
  "Microservices Architecture Team",
  "Integration Solutions Team",
  "Performance Engineering Team",
  "Release Engineering Team",
  "Site Reliability Engineering Team",
  "Network Operations Team",
  "Business Intelligence Team",
  "Automation & Testing Team",
  "Cybersecurity Operations Team",
  "Digital Innovation Lab",
  "Technical Architecture Team",
  "Software Engineering Team",
  "Solutions Architecture Team",
  "Technology Research Team",
  "Enterprise Applications Team",
  "Systems Integration Team",
  "Advanced Analytics Team",
  "Customer Solutions Engineering Team",
  "Product Development Team",
  "Technical Operations Team",
  "Infrastructure Automation Team",
  "Application Security Team",
  "Data Engineering Pipeline Team",
  "Enterprise Platform Team",
  "Digital Transformation Team",
];

const tunisianCities = [
  "Tunis",
  "Sfax",
  "Sousse",
  "Kairouan",
  "Bizerte",
  "Gabes",
  "Ariana",
  "Gafsa",
  "Monastir",
  "Mahdia",
  "Tataouine",
  "Tozeur",
  "Kef",
  "Jendouba",
  "Beja",
  "Siliana",
  "Zaghouan",
  "Nabeul",
  "Kasserine",
  "Medenine",
];

const itTaskTitles = [
  "Develop User Authentication System",
  "Implement Payment Gateway Integration",
  "Create Responsive Dashboard UI",
  "Optimize Database Performance",
  "Build Mobile Application API",
  "Design Landing Page Mockups",
  "Setup CI/CD Pipeline",
  "Implement Real-time Notifications",
  "Create Data Visualization Charts",
  "Develop Admin Panel Interface",
  "Build Search Functionality",
  "Implement File Upload System",
  "Create User Profile Management",
  "Setup Monitoring and Logging",
  "Develop Chat Feature",
  "Implement Email Templates",
  "Build Report Generation System",
  "Create API Documentation",
  "Setup Load Balancing",
  "Implement Security Audit",
  "Develop Backup System",
  "Create Unit Tests Suite",
  "Build Integration Tests",
  "Implement Performance Monitoring",
  "Design System Architecture",
  "Create Database Schema",
  "Implement Caching Strategy",
  "Build Microservices Architecture",
  "Setup Container Orchestration",
  "Implement GraphQL API",
  "Create Progressive Web App",
  "Build Machine Learning Model",
  "Implement Data Pipeline",
  "Setup Kubernetes Cluster",
  "Create Docker Images",
  "Implement OAuth Integration",
];

const itTaskDescriptions = [
  "Develop and implement a comprehensive solution to enhance system functionality and user experience",
  "Create robust and scalable features that meet business requirements and technical specifications",
  "Design and build user-friendly interfaces following modern UI/UX best practices",
  "Optimize system performance and ensure high availability and reliability",
  "Implement secure and efficient backend services with proper error handling",
  "Create responsive and accessible frontend components using modern frameworks",
  "Setup automated deployment pipelines and infrastructure as code",
  "Develop comprehensive testing strategies including unit, integration, and e2e tests",
  "Implement monitoring, logging, and alerting systems for production environments",
  "Create detailed documentation and maintain code quality standards",
];

const itEquipmentNames = [
  "MacBook Pro 16-inch",
  "Dell XPS 15",
  "ThinkPad X1 Carbon",
  "iMac 27-inch",
  "Surface Studio",
  "Samsung 4K Monitor",
  "LG UltraWide Monitor",
  "ASUS Gaming Monitor",
  "Dell UltraSharp Monitor",
  "iPhone 14 Pro",
  "Samsung Galaxy S23",
  "Google Pixel 7",
  "iPad Pro",
  "Surface Pro",
  "HP LaserJet Printer",
  "Canon ImageClass Printer",
  "Epson EcoTank Printer",
  "Logitech MX Master Mouse",
  "Apple Magic Mouse",
  "Razer DeathAdder Mouse",
  "Mechanical Keyboard RGB",
  "Apple Magic Keyboard",
  "Logitech MX Keys",
  "Sony WH-1000XM4 Headphones",
  "AirPods Pro",
  "Bose QuietComfort Headphones",
  "Thunderbolt Docking Station",
  "USB-C Hub",
  "KVM Switch",
  "Webcam 4K",
  "Ring Light",
  "Microphone Blue Yeti",
  "Conference Speaker",
];

// Helper functions
const getRandomItem = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

const getRandomSubset = (array, min, max) => {
  const size = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(size, array.length));
};

// Function to get unique team names
const getUniqueTeamNames = (count) => {
  if (count > itTeamNames.length) {
    throw new Error(
      `Cannot create ${count} unique teams. Only ${itTeamNames.length} team names available.`
    );
  }

  // Shuffle the array and take the first 'count' items
  const shuffled = [...itTeamNames].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

const generateTunisianName = () => {
  const firstName = getRandomItem(tunisianFirstNames);
  const lastName = getRandomItem(tunisianLastNames);
  return `${firstName} ${lastName}`;
};

const generateTunisianEmail = (name) => {
  const nameParts = name.toLowerCase().split(" ");
  const firstName = nameParts[0].replace(/[^a-z]/g, "");
  const lastName = nameParts
    .slice(1)
    .join("")
    .replace(/[^a-z]/g, "");

  const domains = [
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "company.tn",
    "tech.tn",
  ];
  const domain = getRandomItem(domains);

  return `${firstName}.${lastName}${Math.floor(
    Math.random() * 100
  )}@${domain}`;
};

const generateTunisianPhone = () => {
  // Tunisian phone number formats:
  // Mobile: +216 XX XXX XXX (where XX can be 20-29, 50-59, 90-99)
  // Landline: +216 7X XXX XXX (where X is any digit)

  const mobileOperators = [
    "20",
    "21",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
    "29",
    "50",
    "51",
    "52",
    "53",
    "54",
    "55",
    "56",
    "57",
    "58",
    "59",
    "90",
    "91",
    "92",
    "93",
    "94",
    "95",
    "96",
    "97",
    "98",
    "99",
  ];
  const landlineAreaCodes = [
    "70",
    "71",
    "72",
    "73",
    "74",
    "75",
    "76",
    "77",
    "78",
    "79",
  ];

  const isMobile = Math.random() > 0.3; // 70% chance of mobile number

  if (isMobile) {
    const operator = getRandomItem(mobileOperators);
    const number1 = Math.floor(Math.random() * 900) + 100; // 3 digits
    const number2 = Math.floor(Math.random() * 900) + 100; // 3 digits
    return `+216 ${operator} ${number1} ${number2}`;
  } else {
    const areaCode = getRandomItem(landlineAreaCodes);
    const number1 = Math.floor(Math.random() * 900) + 100; // 3 digits
    const number2 = Math.floor(Math.random() * 900) + 100; // 3 digits
    return `+216 ${areaCode} ${number1} ${number2}`;
  }
};

// Generate dates within the last year
const getRandomDate = (months = 12) => {
  const date = new Date();
  date.setMonth(date.getMonth() - Math.floor(Math.random() * months));
  date.setDate(Math.floor(Math.random() * 28) + 1);
  return date;
};

// Get a random future date
const getRandomFutureDate = (maxDays = 60) => {
  const date = new Date();
  date.setDate(
    date.getDate() + Math.floor(Math.random() * maxDays) + 1
  );
  return date;
};

// Function to seed database
async function seedDatabase() {
  try {
    // Connect to MongoDB
    const MONGODB_URI =
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/team-management";
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Clear existing data
    console.log("Clearing existing collections...");
    await User.deleteMany({});
    await Team.deleteMany({});
    await Task.deleteMany({});
    await Equipment.deleteMany({});
    console.log("✅ Cleared existing collections");

    // Create admin users
    console.log("Creating admin users...");
    const adminIds = [];
    for (let i = 0; i < NUM_ADMINS; i++) {
      const hashedPassword = await bcrypt.hash("password123", 10);
      const name = generateTunisianName();
      const newAdmin = new User({
        name: name,
        email: generateTunisianEmail(name),
        password: hashedPassword,
        role: "admin",
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          name
        )}&background=random`,
        isDeleted: false,
        phone: generateTunisianPhone(),
      });
      const savedAdmin = await newAdmin.save();
      adminIds.push(savedAdmin._id);
    }
    console.log(`✅ Created ${adminIds.length} admin users`);

    // Create regular users
    console.log("Creating regular users...");
    const userIds = [];
    for (let i = 0; i < NUM_USERS; i++) {
      const hashedPassword = await bcrypt.hash("password123", 10);
      const name = generateTunisianName();
      const newUser = new User({
        name: name,
        email: generateTunisianEmail(name),
        password: hashedPassword,
        role: "user",
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          name
        )}&background=random`,
        isDeleted: Math.random() < 0.05, // 5% chance of being marked as deleted
        phone: generateTunisianPhone(),
      });
      const savedUser = await newUser.save();
      userIds.push(savedUser._id);
    }
    console.log(`✅ Created ${userIds.length} regular users`);

    // Create teams with leaders and members
    console.log("Creating teams with members...");
    const teamIds = [];
    const teamLeaderIds = [];

    // Get unique team names for all teams we're going to create
    const uniqueTeamNames = getUniqueTeamNames(NUM_TEAMS);

    // Use subset of users for team assignments
    const availableUserIds = userIds.filter((id) => {
      const user = userIds.find((u) => u.equals(id));
      return !user || !user.isDeleted;
    });

    for (let i = 0; i < NUM_TEAMS; i++) {
      // Get users for this team, excluding those already assigned as team leaders
      const availableForTeam = availableUserIds.filter(
        (id) => !teamLeaderIds.some((leaderId) => leaderId.equals(id))
      );

      if (availableForTeam.length < TEAM_SIZE_MIN) {
        console.log("Not enough available users for more teams");
        break;
      }

      // Select team members
      const teamSize =
        Math.floor(
          Math.random() * (TEAM_SIZE_MAX - TEAM_SIZE_MIN + 1)
        ) + TEAM_SIZE_MIN;
      const teamMembers = getRandomSubset(
        availableForTeam,
        teamSize,
        teamSize
      );

      // Choose a team leader
      const teamLeaderId = teamMembers[0];
      teamLeaderIds.push(teamLeaderId);

      // Update team leader role
      await User.findByIdAndUpdate(teamLeaderId, {
        role: "team_leader",
      });

      // Create member objects with roles
      const members = teamMembers.map((userId, index) => ({
        user: userId,
        role: index === 0 ? "Team Leader" : "Team Member",
        joinedAt: getRandomDate(6),
      }));

      // Create the team
      const teamName = uniqueTeamNames[i]; // Use the pre-selected unique name
      const specializations = [
        "React & Node.js",
        "Python & Django",
        "Java & Spring",
        "Angular & .NET",
        "Vue.js & Laravel",
        "Mobile Development",
        "Cloud Computing",
        "DevOps & CI/CD",
        "Machine Learning",
        "Data Analytics",
        "Cybersecurity",
        "UI/UX Design",
        "Quality Assurance",
        "Database Management",
        "API Development",
      ];

      const newTeam = new Team({
        name: teamName,
        description: `Professional IT team specializing in ${getRandomItem(
          specializations
        )} based in ${getRandomItem(
          tunisianCities
        )}, Tunisia. Focused on delivering high-quality software solutions and innovative technology products.`,
        members: members,
        createdAt: getRandomDate(12),
        updatedAt: getRandomDate(3),
      });

      const savedTeam = await newTeam.save();
      teamIds.push(savedTeam._id);

      // Update all members with teamId
      for (let j = 0; j < teamMembers.length; j++) {
        await User.findByIdAndUpdate(teamMembers[j], {
          teamId: savedTeam._id,
          role: j === 0 ? "team_leader" : "team_member",
        });
      }
    }
    console.log(
      `✅ Created ${teamIds.length} teams with leaders and members`
    );

    // Create tasks
    console.log("Creating tasks...");
    const taskPriorities = ["low", "medium", "high"];
    const taskStatuses = ["pending", "in_progress", "completed"];

    const createdTasks = [];

    // Create tasks for each team
    for (const teamId of teamIds) {
      // Get members of this team
      const team = await Team.findById(teamId).populate(
        "members.user"
      );
      const teamMemberIds = team.members.map(
        (member) => member.user._id
      );

      // Create random number of tasks for this team
      const numTasks =
        Math.floor(
          Math.random() *
            (TASKS_PER_TEAM_MAX - TASKS_PER_TEAM_MIN + 1)
        ) + TASKS_PER_TEAM_MIN;

      for (let i = 0; i < numTasks; i++) {
        const status = getRandomItem(taskStatuses);
        const dueDate = getRandomFutureDate(90);
        const createdAt = getRandomDate(6);

        // Only set completedAt if status is completed
        let completedAt = null;
        if (status === "completed") {
          completedAt = new Date();
          completedAt.setTime(
            createdAt.getTime() +
              Math.random() *
                (new Date().getTime() - createdAt.getTime())
          );
        }

        // Decide if task is assigned to someone
        const hasAssignee = Math.random() > 0.1; // 90% chance of having an assignee
        const assignedTo = hasAssignee
          ? getRandomItem(teamMemberIds)
          : null;

        const newTask = new Task({
          title: getRandomItem(itTaskTitles),
          description: getRandomItem(itTaskDescriptions),
          status: status,
          priority: getRandomItem(taskPriorities),
          dueDate: dueDate,
          assignedTo: assignedTo,
          teamId: teamId,
          createdAt: createdAt,
          updatedAt: new Date(),
          completedAt: completedAt,
        });

        const savedTask = await newTask.save();
        createdTasks.push(savedTask);
      }
    }
    console.log(`✅ Created ${createdTasks.length} tasks`);

    // Create equipment
    console.log("Creating equipment...");
    const equipmentTypes = [
      "Laptop",
      "Monitor",
      "Mobile Device",
      "Printer",
      "Keyboard",
      "Mouse",
      "Headset",
      "Docking Station",
      "Tablet",
      "Conference Equipment",
      "Projector",
      "Camera",
    ];
    const equipmentStatuses = [
      "available",
      "assigned",
      "maintenance",
    ];

    const createdEquipment = [];

    for (let i = 0; i < NUM_EQUIPMENT; i++) {
      const status = getRandomItem(equipmentStatuses);
      const type = getRandomItem(equipmentTypes);

      // For assigned equipment, assign to a user and potentially a team
      let assignedTo = null;
      let teamId = null;

      if (status === "assigned") {
        // Get a random user
        assignedTo = getRandomItem([...adminIds, ...userIds]);

        // If user has a team, possibly assign to that team
        const user = await User.findById(assignedTo);
        if (user && user.teamId) {
          teamId = user.teamId;
        }
      }

      const newEquipment = new Equipment({
        name: getRandomItem(itEquipmentNames),
        type: type,
        status: status,
        assignedTo: assignedTo,
        teamId: teamId,
        assignedDate: assignedTo ? getRandomDate(3) : null,
        returnDate: null,
        description: `High-quality IT equipment for professional use in ${getRandomItem(
          tunisianCities
        )} office. Latest technology for optimal productivity and performance.`,
        serialNumber: `TN${Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0")}${Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0")}`,
        purchaseDate: getRandomDate(24),
        notes:
          Math.random() > 0.5
            ? `Purchased from ${getRandomItem([
                "TechStore Tunisia",
                "IT Solutions Tunis",
                "Digital Equipment Sfax",
                "Tech Hub Sousse",
              ])} in ${getRandomItem(tunisianCities)}`
            : null,
      });

      const savedEquipment = await newEquipment.save();
      createdEquipment.push(savedEquipment);
    }
    console.log(
      `✅ Created ${createdEquipment.length} equipment items`
    );

    // Summary
    console.log(
      "\n✨ Database seeded successfully with Tunisian IT company data!"
    );
    console.log(`
    Summary:
    - ${adminIds.length} admin users
    - ${userIds.length} regular users  
    - ${teamIds.length} IT teams
    - ${createdTasks.length} tasks
    - ${createdEquipment.length} equipment items
    `);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log("Database connection closed");
  }
}

// Run the seed function
seedDatabase();
