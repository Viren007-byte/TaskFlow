import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './core.js';
import { Project, Task, Activity } from './routes.js';

// Stable IDs keep reruns from duplicating projects or overwriting task edits.
const projectIds = ['650000000000000000000001', '650000000000000000000002'];
const accounts = [
  { name: 'Aarav Shah', email: 'aarav@taskflow.example' },
  { name: 'Meera Rao', email: 'meera@taskflow.example' },
];

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seeding is disabled in production.');
  }
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taskflow');
  const password = await bcrypt.hash('TaskflowDemo123!', 12);
  const users = [];
  for (const account of accounts) {
    let user = await User.findOne({ email: account.email });
    if (!user) user = await User.create({ ...account, password });
    users.push(user);
  }

  const projects = [
    {
      name: 'Customer portal launch',
      description: 'Prepare the first release of the customer self-service portal.',
      tasks: [
        ['Review sign-up form copy', 'done', 'medium', 'Check labels and validation messages with the support team.'],
        ['Build account settings page', 'in_progress', 'high', 'Add profile editing and email preferences.'],
        ['Test password reset emails', 'todo', 'high', 'Check expired links and delivery to the test inbox.'],
        ['Write release checklist', 'todo', 'low', 'Include smoke tests, backup steps and the rollback contact.'],
      ],
    },
    {
      name: 'Support knowledge base',
      description: 'Turn recurring support questions into short, useful help articles.',
      tasks: [
        ['Group last month’s support questions', 'done', 'medium', 'Sort questions into billing, accounts and troubleshooting.'],
        ['Draft the getting-started guide', 'in_progress', 'medium', 'Walk through creating a workspace and inviting a teammate.'],
        ['Review billing FAQ with support', 'todo', 'high', 'Confirm refund and invoice examples before publishing.'],
      ],
    },
  ];

  for (const [index, entry] of projects.entries()) {
    const project = await Project.findOneAndUpdate(
      { _id: projectIds[index] },
      { $setOnInsert: { name: entry.name, description: entry.description, owner: users[0]._id, members: [users[1]._id] } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    for (const [taskIndex, [title, status, priority, description]] of entry.tasks.entries()) {
      const taskId = new mongoose.Types.ObjectId(`6600000000000000000000${index}${taskIndex}`);
      await Task.updateOne({ _id: taskId }, { $setOnInsert: {
        project: project._id, title, status, priority, description,
        assignee: users[taskIndex % users.length]._id,
        dueDate: new Date(Date.now() + (taskIndex + 1) * 86400000),
      } }, { upsert: true });
    }
    await Activity.updateOne(
      { _id: new mongoose.Types.ObjectId(`67000000000000000000000${index}`) },
      { $setOnInsert: { project: project._id, actor: users[0]._id, action: 'project_created', detail: entry.name } },
      { upsert: true },
    );
  }
  console.log('Demo workspace ready. Existing accounts and task edits were preserved.');
  console.log('New demo accounts use password: TaskflowDemo123!');
  for (const account of accounts) console.log(`  ${account.email}`);
}

try {
  await seed();
} catch (error) {
  console.error(`Seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
