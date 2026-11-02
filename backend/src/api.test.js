import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import mongoose from 'mongoose';

test('demo login, project permissions, task changes and repeatable seed', { timeout: 60000 }, async () => {
  const mongoUri = `mongodb://127.0.0.1:27017/taskflow_test_${process.pid}`;
  const env = { ...process.env, MONGO_URI: mongoUri, JWT_SECRET: 'test-secret-only-for-isolated-smoke-test', PORT: '4197', NODE_ENV: 'test' };
  let server;
  const call = async (path, method = 'GET', body, token) => {
    const response = await fetch(`http://127.0.0.1:4197/api${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  };
  const seed = () => {
    const result = spawnSync(process.execPath, ['src/seed.js'], { env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  try {
    seed();
    server = spawn(process.execPath, ['src/server.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('API startup timed out')), 10000);
      server.stdout.on('data', () => { clearTimeout(timer); resolve(); });
      server.once('error', error => { clearTimeout(timer); reject(error); });
      server.once('exit', code => { clearTimeout(timer); reject(new Error(`API exited: ${code}`)); });
    });
    assert.equal((await call('/health')).status, 200);
    assert.equal((await call('/projects')).status, 401);
    assert.equal((await call('/auth/login', 'POST', { email: 'aarav@taskflow.example', password: 'wrong' })).status, 401);
    const owner = await call('/auth/login', 'POST', { email: 'aarav@taskflow.example', password: 'TaskflowDemo123!' });
    assert.equal(owner.status, 200);
    const token = owner.data.token;
    assert.equal((await call('/auth/me', 'GET', undefined, token)).data.email, 'aarav@taskflow.example');
    const projects = (await call('/projects', 'GET', undefined, token)).data;
    assert.equal(projects.length, 2);
    let total = 0;
    for (const project of projects) total += (await call(`/projects/${project._id}/tasks`, 'GET', undefined, token)).data.length;
    assert.equal(total, 7);
    const member = await call('/auth/login', 'POST', { email: 'meera@taskflow.example', password: 'TaskflowDemo123!' });
    assert.equal(member.status, 200);
    assert.equal((await call('/projects', 'GET', undefined, member.data.token)).data.length, 2);
    assert.equal((await call(`/projects/${projects[0]._id}`, 'DELETE', undefined, member.data.token)).status, 403);
    const outsider = await call('/auth/register', 'POST', { name: 'Test outsider', email: 'outsider@taskflow.example', password: 'OutsideTest123!' });
    assert.equal(outsider.status, 201);
    assert.equal((await call(`/projects/${projects[0]._id}/tasks`, 'GET', undefined, outsider.data.token)).status, 404);
    const tasks = (await call(`/projects/${projects[0]._id}/tasks`, 'GET', undefined, token)).data;
    assert.equal((await call(`/tasks/${tasks[0]._id}`, 'PATCH', { title: 'Edited demo task' }, token)).status, 200);
    seed();
    const afterSeed = (await call(`/projects/${projects[0]._id}/tasks`, 'GET', undefined, token)).data;
    assert.equal(afterSeed.length, tasks.length);
    assert.ok(afterSeed.some(task => task.title === 'Edited demo task'));
    const created = await call(`/projects/${projects[0]._id}/tasks`, 'POST', { title: 'Smoke test task', status: 'in_progress', priority: 'high', dueDate: '2026-12-10' }, token);
    assert.equal(created.status, 201);
    assert.equal(created.data.status, 'in_progress');
    assert.equal(created.data.priority, 'high');
    assert.ok(created.data.dueDate.startsWith('2026-12-10'));
    const edited = await call(`/tasks/${created.data._id}`, 'PATCH', { description: 'Updated in the task editor', dueDate: null, priority: 'low' }, token);
    assert.equal(edited.status, 200);
    assert.equal(edited.data.dueDate, null);
    assert.equal(edited.data.priority, 'low');
    assert.equal((await call(`/tasks/${created.data._id}`, 'PATCH', { status: 'done' }, token)).data.status, 'done');
    assert.equal((await call(`/tasks/${created.data._id}`, 'DELETE', undefined, token)).status, 200);
  } finally {
    if (server && server.exitCode === null) {
      await new Promise(resolve => { server.once('exit', resolve); server.kill(); });
    }
    try {
      await mongoose.connect(mongoUri);
      await mongoose.connection.dropDatabase();
    } finally {
      await mongoose.disconnect();
    }
  }
});
