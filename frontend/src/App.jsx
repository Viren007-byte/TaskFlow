import React, { useEffect, useRef, useState } from 'react';
import { request } from './api';

const columns = [{ id: 'todo', title: 'To do', color: 'gray' }, { id: 'in_progress', title: 'In progress', color: 'orange' }, { id: 'done', title: 'Done', color: 'green' }];
const initials = name => (name || 'You').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
const dateLabel = date => new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

function Mark() { return <span className="brand-mark" aria-hidden="true"><i/><i/><i/></span>; }
function Icon({ name, size = 20 }) {
  const paths = { grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z', arrow: 'M5 12h14 M13 6l6 6-6 6', plus: 'M12 5v14 M5 12h14', search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', check: 'M5 12l4 4L19 6', logout: 'M9 5H4v14h5 M10 12h11 M17 8l4 4-4 4', clock: 'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01' };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.grid}/></svg>;
}

function TaskCard({ task, busy, openModal, changeStatus, onDrag, onDragEnd }) {
    return <article className={`task-card ${task.status === 'done' ? 'completed' : ''}`} draggable={!busy} onDragStart={event => { event.dataTransfer.setData('text/plain', task._id); onDrag(task._id); }} onDragEnd={onDragEnd}>
      <div className="task-top"><span className={`priority ${task.priority}`}><i/>{task.priority}</span><button className="icon-button task-edit" aria-label={`Edit ${task.title}`} onClick={() => openModal('edit', { ...task, dueDate: task.dueDate?.slice(0, 10) || '' })}>•••</button></div>
      <h3><button className="task-title" onClick={() => openModal('edit', { ...task, dueDate: task.dueDate?.slice(0, 10) || '' })}>{task.title}</button></h3>
      {task.description && <p>{task.description}</p>}
      <div className="task-bottom"><span className="task-date"><Icon name={task.status === 'done' ? 'check' : 'clock'} size={14}/>{task.dueDate ? dateLabel(task.dueDate) : 'No due date'}</span><select aria-label={`Status for ${task.title}`} disabled={busy} value={task.status} onChange={event => changeStatus(task, event.target.value)}>{columns.map(column => <option key={column.id} value={column.id}>{column.title}</option>)}</select></div>
    </article>;
  }


export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState({});
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('all');
  const [view, setView] = useState('board');
  const [tab, setTab] = useState('tasks');
  const [dragged, setDragged] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const dialogRef = useRef(null);
  const selected = projects.find(project => project._id === selectedId);

  function logout() {
    generation.current++;
    localStorage.removeItem('token'); setToken(null); setUser(null);
    setProjects([]); setSelectedId(null); setTasks([]); setActivity([]); setError('');
    setForm({ name: '', email: '', password: '' });
  }
  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const account = await request('/auth/me');
        const data = await request('/projects');
        if (active) { setUser(account); setProjects(data); setSelectedId(data[0]?._id || null); }
      } catch (err) { if (active) { logout(); setError(err.message); } }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    const current = ++generation.current;
    setTasks([]); setActivity([]); setSearch(''); setPriority('all'); setTab('tasks');
    if (!selectedId) return;
    setLoading(true);
    Promise.all([request(`/projects/${selectedId}/tasks`), request(`/projects/${selectedId}/activity`)])
      .then(([items, events]) => { if (generation.current === current) { setTasks(items); setActivity(events); } })
      .catch(err => { if (generation.current === current) setError(err.message); })
      .finally(() => { if (generation.current === current) setLoading(false); });
  }, [selectedId]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    if (modal) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [modal]);

  async function login(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await request(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) });
      localStorage.setItem('token', data.token); setToken(data.token); setForm({ name: '', email: '', password: '' });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  function openModal(type, initial = {}) { setDraft(initial); setModal(type); setError(''); }
  async function refreshActivity(projectId, current) {
    try { const events = await request(`/projects/${projectId}/activity`); if (generation.current === current) setActivity(events); } catch { /* The next project load refreshes activity. */ }
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    const current = generation.current;
    const projectId = selectedId;
    try {
      if (modal === 'project') {
        const project = await request('/projects', { method: 'POST', body: JSON.stringify(draft) });
        setProjects(items => [project, ...items]); setSelectedId(project._id); setNotice('Project created');
      } else if (modal === 'delete') {
        await request(`/tasks/${draft._id}`, { method: 'DELETE' });
        if (current === generation.current) setTasks(items => items.filter(item => item._id !== draft._id));
        setNotice('Task deleted');
      } else {
        const payload = { ...draft, dueDate: draft.dueDate || null };
        const item = await request(modal === 'edit' ? `/tasks/${draft._id}` : `/projects/${projectId}/tasks`, { method: modal === 'edit' ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
        if (current === generation.current) setTasks(items => modal === 'edit' ? items.map(task => task._id === item._id ? item : task) : [item, ...items]);
        setNotice(modal === 'edit' ? 'Task updated' : 'Task added'); refreshActivity(projectId, current);
      }
      setModal(null);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function changeStatus(task, status) {
    if (task.status === status || busy) return;
    const current = generation.current; setBusy(true); setError('');
    try {
      const updated = await request(`/tasks/${task._id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      if (current === generation.current) setTasks(items => items.map(item => item._id === task._id ? updated : item));
      setNotice(`Moved to ${columns.find(column => column.id === status).title.toLowerCase()}`); refreshActivity(selectedId, current);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const visible = tasks.filter(task => `${task.title} ${task.description || ''}`.toLowerCase().includes(search.toLowerCase()) && (priority === 'all' || task.priority === priority));
  const done = tasks.filter(task => task.status === 'done').length;
  const inProgress = tasks.filter(task => task.status === 'in_progress').length;
  const completion = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const now = new Date();
  const overdue = tasks.filter(task => task.status !== 'done' && task.dueDate && new Date(task.dueDate) < new Date(now.getFullYear(), now.getMonth(), now.getDate())).length;


  if (!token) return <div className="auth-layout">
    <section className="auth-story"><a className="brand" href="./"><Mark/>TaskFlow<span className="brand-dot">.</span></a><div className="story-content"><span className="eyebrow light">LESS NOISE. MORE MOMENTUM.</span><h1>Good work<br/>starts with<br/><em>a little flow.</em></h1><p>A shared space for the plans, small wins, and next big thing. Bring your team. Find your rhythm.</p><div className="flow-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-card art-one"><span className="art-dot"/>A clear plan <span>↗</span></div><div className="art-card art-two"><span className="art-check">✓</span>One step closer</div><div className="art-spark">✳</div></div></div><div className="story-footer"><span>MADE FOR MOVING FORWARD</span><span>↗</span></div></section>
    <section className="auth-side"><span className="auth-caption">YOUR NEXT CHAPTER STARTS HERE</span><div className="auth-form"><span className="eyebrow">LET’S GET TO WORK</span><h2>{mode === 'login' ? 'Welcome back.' : 'Make room for good work.'}</h2><p>{mode === 'login' ? 'Sign in and pick up where your team left off.' : 'Create your account. Build something together.'}</p>{error && <div className="error" role="alert">{error}</div>}<form onSubmit={login}>{mode === 'register' && <label>Your name<input autoComplete="name" required minLength={2} maxLength={80} value={form.name} placeholder="Alex Morgan" onChange={event => setForm({ ...form, name: event.target.value })}/></label>}<label>Email address<input type="email" autoComplete="email" required value={form.email} placeholder="you@company.com" onChange={event => setForm({ ...form, email: event.target.value })}/></label><label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 8 : undefined} value={form.password} placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'} onChange={event => setForm({ ...form, password: event.target.value })}/></label><button className="primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}<Icon name="arrow"/></button></form><p className="auth-switch">{mode === 'login' ? 'New around here?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p></div><span className="auth-footnote">A little structure. A lot more possibility.</span></section>
  </div>;

  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="./"><Mark/>TaskFlow<span className="brand-dot">.</span></a><div className="workspace-label"><span className="workspace-avatar">W</span><div>Your workspace<small>Let’s make things happen</small></div><span className="live-dot"/></div><div className="sidebar-heading">WORKSPACE</div><div className="nav-current"><Icon name="grid"/>Projects<span>{projects.length}</span></div><div className="sidebar-heading project-heading">YOUR PROJECTS<button className="icon-button" onClick={() => openModal('project')} aria-label="Create project"><Icon name="plus" size={16}/></button></div><nav aria-label="Projects">{projects.map((project, index) => <button key={project._id} className={`project-nav ${project._id === selectedId ? 'active' : ''}`} onClick={() => setSelectedId(project._id)}><span className={`project-dot color-${index % 4}`}/><span>{project.name}</span>{project._id === selectedId && <span className="nav-arrow">↗</span>}</button>)}</nav><button className="new-project" onClick={() => openModal('project')}><Icon name="plus" size={16}/>New project</button><div className="sidebar-note"><span>ONE THING AT A TIME.</span><p>Small steps.<br/>Real progress.</p><div className="note-line"><i/></div></div><div className="user-profile"><span className="avatar">{initials(user?.name)}</span><div><strong>{user?.name || 'Your account'}</strong><small>Personal workspace</small></div><button className="icon-button" aria-label="Sign out" onClick={logout}><Icon name="logout" size={18}/></button></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb">Workspace<span>/</span><strong>Projects</strong></div><div className="topbar-right"><span className="today">{now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span><span className="avatar small-avatar">{initials(user?.name)}</span><button className="icon-button mobile-logout" aria-label="Sign out" onClick={logout}><Icon name="logout" size={17}/></button></div></header><main className="workspace-main">
      {error && !modal && <div className="error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      <div className="page-heading"><div><span className="eyebrow">THE BIG PICTURE, ONE TASK AT A TIME</span><h1>{selected?.name || 'Your next big thing.'}<span className="heading-dot">.</span></h1><p>{selected?.description || 'Give your ideas a home. Start a project and take the first step.'}</p></div><button className="primary" disabled={!selected || loading} onClick={() => openModal('task', { title: '', description: '', priority: 'medium', dueDate: '' })}><Icon name="plus" size={18}/>Add task</button></div>
      <div className="stats-grid"><div className="stat"><span>Total tasks<Icon name="grid" size={17}/></span><strong>{tasks.length.toString().padStart(2, '0')}</strong><small>Everything on the radar</small></div><div className="stat"><span>In progress<span className="stat-dot orange"/></span><strong>{inProgress.toString().padStart(2, '0')}</strong><small>Good things in motion</small></div><div className="stat"><span>Completed<span className="stat-dot green"/></span><strong>{done.toString().padStart(2, '0')}</strong><small>{overdue ? `${overdue} overdue ${overdue === 1 ? 'task needs' : 'tasks need'} attention` : 'A little closer to the finish'}</small></div><div className="stat progress-stat"><div><span>Project progress</span><strong>{completion}<em>%</em></strong><small>{done} of {tasks.length} tasks complete</small></div><div className="progress-ring" style={{ '--progress': `${completion * 3.6}deg` }}><Icon name="check" size={22}/></div></div></div>
      <div className="board-navigation"><div className="tabs"><button className={tab === 'tasks' ? 'selected' : ''} onClick={() => setTab('tasks')}><Icon name="grid" size={17}/>Task board<span>{tasks.length}</span></button><button className={tab === 'activity' ? 'selected' : ''} onClick={() => setTab('activity')}><Icon name="clock" size={17}/>Activity</button></div><span className="board-hint">A clear plan. A calmer day.</span></div>
      {tab === 'tasks' ? <><div className="board-toolbar"><div className="search-box"><Icon name="search" size={17}/><input aria-label="Search tasks" placeholder="Find a task…" value={search} onChange={event => setSearch(event.target.value)}/>{search && <button className="icon-button" aria-label="Clear search" onClick={() => setSearch('')}>×</button>}</div><div className="toolbar-actions"><select aria-label="Filter by priority" value={priority} onChange={event => setPriority(event.target.value)}><option value="all">All priorities</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select><div className="view-toggle"><button aria-label="Board view" aria-pressed={view === 'board'} className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><Icon name="grid" size={17}/></button><button aria-label="List view" aria-pressed={view === 'list'} className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><Icon name="list" size={19}/></button></div></div></div>
      {loading ? <div className="loading-state" role="status"><span className="spinner"/>Getting your workspace ready…</div> : !selected ? <div className="empty-workspace"><span className="empty-art">↗</span><h2>Every great project starts somewhere.</h2><p>Create a project, add a few tasks, and find your flow.</p><button className="primary" onClick={() => openModal('project')}><Icon name="plus" size={18}/>Create your first project</button></div> : <div className={`task-board ${view === 'list' ? 'list-view' : ''}`}>{columns.map(column => <section key={column.id} className={`board-column ${dropTarget === column.id ? 'drop-active' : ''}`} onDragOver={event => { if (dragged) { event.preventDefault(); setDropTarget(column.id); } }} onDrop={event => { event.preventDefault(); const task = tasks.find(item => item._id === event.dataTransfer.getData('text/plain')); if (task) changeStatus(task, column.id); setDropTarget(null); setDragged(null); }}><div className="column-heading"><h2><span className={`stat-dot ${column.color}`}/>{column.title}<span className="column-count">{visible.filter(task => task.status === column.id).length}</span></h2><button className="icon-button" aria-label={`Add task to ${column.title}`} onClick={() => openModal('task', { title: '', description: '', priority: 'medium', dueDate: '', status: column.id })}><Icon name="plus" size={17}/></button></div><div className="column-tasks">{visible.filter(task => task.status === column.id).map(task => <TaskCard key={task._id} task={task} busy={busy} openModal={openModal} changeStatus={changeStatus} onDrag={setDragged} onDragEnd={() => { setDragged(null); setDropTarget(null); }}/>)}{!visible.some(task => task.status === column.id) && <div className="empty-column"><span>{column.id === 'done' ? '✓' : '+'}</span><p>{search || priority !== 'all' ? 'No matching tasks' : column.id === 'done' ? 'Your next small win goes here.' : 'Room for the next step.'}</p></div>}</div></section>)}</div>}<div className="board-footer"><span><span className="live-dot"/>Connected to your workspace</span><span>Drag tasks between columns, or use the status menu.</span></div></> : <section className="activity-panel"><h2>The latest moves</h2><p className="muted">A running history of your project’s task updates.</p>{loading ? <p role="status">Loading activity…</p> : activity.length ? activity.map(event => <div className="activity-row" key={event._id}><span className="activity-icon"><Icon name={event.action === 'task_created' ? 'plus' : 'check'} size={17}/></span><div><strong>{event.detail || 'Project updated'}</strong><p>{event.action.replaceAll('_', ' ')}</p></div><time dateTime={event.createdAt}>{dateLabel(event.createdAt)}</time></div>) : <div className="empty-column">Your project activity will appear here.</div>}</section>}
      <footer className="workspace-footer"><span>TaskFlow<span className="heading-dot">.</span></span><span>Make space for work that matters.</span></footer>
    </main></div>
    {notice && <div className="toast" role="status"><Icon name="check" size={17}/>{notice}</div>}
    <dialog ref={dialogRef} className="modal" onCancel={event => { if (busy) event.preventDefault(); else setModal(null); }} onClick={event => { if (event.target === event.currentTarget && !busy) setModal(null); }}><div className="modal-content"><div className="modal-heading"><span className="eyebrow">MAKE YOUR NEXT MOVE</span><button className="icon-button" aria-label="Close dialog" disabled={busy} onClick={() => setModal(null)}>×</button></div><h2>{modal === 'project' ? 'A new beginning.' : modal === 'delete' ? 'Delete this task?' : modal === 'edit' ? 'Fine-tune the details.' : 'What’s the next step?'}</h2>{error && <div className="error" role="alert">{error}</div>}<form onSubmit={save}>{modal === 'delete' ? <p className="delete-copy">“{draft.title}” will be permanently removed from this project.</p> : <><label>{modal === 'project' ? 'Project name' : 'Task title'}<input autoFocus key={modal} required minLength={modal === 'project' ? 2 : 1} maxLength={150} value={draft.name ?? draft.title ?? ''} placeholder={modal === 'project' ? 'Give your project a name' : 'Something worth getting done'} onChange={event => setDraft({ ...draft, [modal === 'project' ? 'name' : 'title']: event.target.value })}/></label><label>Description <span className="optional">optional</span><textarea rows={3} value={draft.description || ''} placeholder="A little context goes a long way…" onChange={event => setDraft({ ...draft, description: event.target.value })}/></label>{modal !== 'project' && <div className="form-row"><label>Priority<select value={draft.priority || 'medium'} onChange={event => setDraft({ ...draft, priority: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Due date<input type="date" value={draft.dueDate || ''} onChange={event => setDraft({ ...draft, dueDate: event.target.value })}/></label></div>}</>}<div className="modal-actions">{modal === 'edit' && <button type="button" className="delete-link" disabled={busy} onClick={() => setModal('delete')}>Delete task</button>}<button type="button" className="secondary" disabled={busy} onClick={() => setModal(null)}>Cancel</button><button className={modal === 'delete' ? 'danger' : 'primary'} disabled={busy}>{busy ? 'Saving…' : modal === 'project' ? 'Create project' : modal === 'delete' ? 'Delete task' : modal === 'edit' ? 'Save changes' : 'Add task'}{modal !== 'delete' && <Icon name="arrow" size={17}/>}</button></div></form></div></dialog>
  </div>;
}
